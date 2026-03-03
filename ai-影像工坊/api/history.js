import { del, list, put } from "@vercel/blob";
import { get as edgeConfigGet } from "@vercel/edge-config";
import pg from "pg";

const { Pool } = pg;

const HISTORY_PREFIX = "history";
const LATEST_PREFIX = `${HISTORY_PREFIX}/latest/`;
const SNAPSHOT_PREFIX = `${HISTORY_PREFIX}/snapshots/`;
const IMAGE_PREFIX = `${HISTORY_PREFIX}/images/`;
const HISTORY_TABLE = "history_records";
const TASK_STATUSES = new Set(["planning", "concept", "shooting", "completed", "failed"]);
const DATABASE_MODES = new Set(["blob", "hybrid", "postgres"]);
const blobAdapter = globalThis.__HISTORY_BLOB_ADAPTER__ || { put, list, del };
const fetchAdapter = globalThis.__HISTORY_FETCH_ADAPTER__ || fetch;
const edgeConfigAdapter = globalThis.__HISTORY_EDGE_CONFIG_ADAPTER__ || { get: edgeConfigGet };
const pgAdapter = globalThis.__HISTORY_PG_ADAPTER__ || null;
const DEFAULT_REQUEST_BODY_LIMIT_BYTES = 12 * 1024 * 1024;
const DEFAULT_MAX_FRAMES_PER_RECORD = 80;
const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_IMAGE_BYTES = 48 * 1024 * 1024;
const MAX_REQUEST_BODY_LIMIT_BYTES = 64 * 1024 * 1024;
const MAX_MAX_FRAMES_PER_RECORD = 500;
const MAX_MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES_LIMIT = 256 * 1024 * 1024;

const toPositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

const POLICY_CACHE_MS = toPositiveInt(process.env.HISTORY_EDGE_CONFIG_CACHE_MS, 10_000, 600_000);
let policyCache = {
  expireAt: 0,
  value: null,
};
let pgPool = null;
let pgPoolUrl = "";
let pgInitPromise = null;

const FRAME_COLLECTION_FIELDS = ["conceptFrames", "renderFrames"];

const sanitizeId = (value) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  return cleaned || `h_${Date.now()}`;
};

const toText = (value, fallback = "") => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(lowered)) return true;
    if (["0", "false", "no", "off"].includes(lowered)) return false;
  }
  return fallback;
};

const normalizeDatabaseMode = (value, fallback = "blob") => {
  const mode = String(value || "").trim().toLowerCase();
  if (DATABASE_MODES.has(mode)) return mode;
  return fallback;
};

const readPostgresUrl = () =>
  toText(process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.PRISMA_DATABASE_URL, "");

const isPostgresConfigured = () => Boolean(pgAdapter || readPostgresUrl());

const getPostgresClient = () => {
  if (pgAdapter?.query) return pgAdapter;

  const connectionString = readPostgresUrl();
  if (!connectionString) return null;

  if (pgPool && pgPoolUrl === connectionString) return pgPool;

  if (pgPool) {
    pgPool
      .end()
      .catch(() => undefined);
  }

  const shouldUseSsl = /sslmode=require/i.test(connectionString) || /\.prisma\.io[:/]/i.test(connectionString);
  pgPool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    ...(shouldUseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  pgPoolUrl = connectionString;
  pgInitPromise = null;
  return pgPool;
};

const pgQuery = async (text, values = []) => {
  const client = getPostgresClient();
  if (!client || typeof client.query !== "function") {
    throw Object.assign(new Error("POSTGRES_URL/DATABASE_URL 未配置"), { status: 503 });
  }
  return client.query(text, values);
};

const ensurePostgresSchema = async () => {
  if (pgAdapter?.ensureReady) {
    await pgAdapter.ensureReady();
    return;
  }

  if (pgInitPromise) {
    await pgInitPromise;
    return;
  }

  pgInitPromise = (async () => {
    await pgQuery(
      `
      CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
        id TEXT PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        created_at_iso TEXT NOT NULL,
        updated_at_iso TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        user_input TEXT NOT NULL,
        client_ip TEXT NOT NULL,
        task_status TEXT NOT NULL,
        source TEXT NOT NULL,
        preview_image_url TEXT NOT NULL DEFAULT '',
        plan_json JSONB NOT NULL
      );
      `
    );
    await pgQuery(
      `
      CREATE INDEX IF NOT EXISTS ${HISTORY_TABLE}_updated_idx
      ON ${HISTORY_TABLE} (updated_at DESC, id DESC);
      `
    );
  })().catch((error) => {
    pgInitPromise = null;
    throw error;
  });

  await pgInitPromise;
};

const clampLimits = (source) => {
  const maxImageBytes = toPositiveInt(source.maxImageBytes, DEFAULT_MAX_IMAGE_BYTES, MAX_MAX_IMAGE_BYTES);
  const maxTotalImageBytes = Math.max(
    maxImageBytes,
    toPositiveInt(source.maxTotalImageBytes, DEFAULT_MAX_TOTAL_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES_LIMIT)
  );

  return {
    requestBodyLimitBytes: toPositiveInt(
      source.requestBodyLimitBytes,
      DEFAULT_REQUEST_BODY_LIMIT_BYTES,
      MAX_REQUEST_BODY_LIMIT_BYTES
    ),
    maxFramesPerRecord: toPositiveInt(source.maxFramesPerRecord, DEFAULT_MAX_FRAMES_PER_RECORD, MAX_MAX_FRAMES_PER_RECORD),
    maxImageBytes,
    maxTotalImageBytes,
  };
};

const readBlobTokenConfigured = () => Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || "").trim());

const buildEnvPolicy = () => {
  const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
  const isProduction = nodeEnv === "production";
  const historyGatewayToken = String(process.env.HISTORY_GATEWAY_TOKEN || process.env.AI_GATEWAY_TOKEN || "").trim();
  const allowAnonInProd = toBoolean(process.env.HISTORY_ALLOW_ANON_IN_PROD, false);
  const postgresConfigured = isPostgresConfigured();
  const databaseMode = normalizeDatabaseMode(process.env.HISTORY_DATABASE_MODE, postgresConfigured ? "hybrid" : "blob");
  const limits = clampLimits({
    requestBodyLimitBytes: process.env.HISTORY_MAX_BODY_BYTES,
    maxFramesPerRecord: process.env.HISTORY_MAX_FRAMES_PER_RECORD,
    maxImageBytes: process.env.HISTORY_MAX_IMAGE_BYTES,
    maxTotalImageBytes: process.env.HISTORY_MAX_TOTAL_IMAGE_BYTES,
  });

  return {
    source: "env",
    edgeConfig: {
      configured: Boolean(String(process.env.EDGE_CONFIG || "").trim()),
      connected: false,
      used: false,
      reason: "",
    },
    enabled: true,
    readOnly: false,
    databaseMode,
    historyGatewayToken,
    allowAnonInProd,
    requireHistoryToken: Boolean(historyGatewayToken) || (isProduction && !allowAnonInProd),
    postgres: {
      configured: postgresConfigured,
      connected: false,
      ready: false,
      reason: postgresConfigured ? "" : "missing POSTGRES_URL/DATABASE_URL/PRISMA_DATABASE_URL",
    },
    ...limits,
  };
};

const mergeWithEdgePolicy = (base, patch = {}) => {
  const allowAnonInProd = toBoolean(patch.allowAnonInProd, base.allowAnonInProd);
  const requireHistoryToken = toBoolean(
    patch.requireHistoryToken ?? patch.requireToken,
    Boolean(base.historyGatewayToken) || (String(process.env.NODE_ENV || "").toLowerCase() === "production" && !allowAnonInProd)
  );
  const limits = clampLimits({
    requestBodyLimitBytes: patch.requestBodyLimitBytes ?? patch.maxBodyBytes ?? base.requestBodyLimitBytes,
    maxFramesPerRecord: patch.maxFramesPerRecord ?? base.maxFramesPerRecord,
    maxImageBytes: patch.maxImageBytes ?? base.maxImageBytes,
    maxTotalImageBytes: patch.maxTotalImageBytes ?? base.maxTotalImageBytes,
  });

  return {
    ...base,
    enabled: toBoolean(patch.enabled, base.enabled),
    readOnly: toBoolean(patch.readOnly, base.readOnly),
    databaseMode: normalizeDatabaseMode(patch.databaseMode, base.databaseMode),
    allowAnonInProd,
    requireHistoryToken,
    ...limits,
  };
};

const readEdgePolicyPatch = async () => {
  const primary = await edgeConfigAdapter.get("history.policy");
  if (primary && typeof primary === "object" && !Array.isArray(primary)) return primary;

  const secondary = await edgeConfigAdapter.get("history_policy");
  if (secondary && typeof secondary === "object" && !Array.isArray(secondary)) return secondary;

  const [
    enabled,
    readOnly,
    allowAnonInProd,
    requireHistoryToken,
    databaseMode,
    requestBodyLimitBytes,
    maxFramesPerRecord,
    maxImageBytes,
    maxTotalImageBytes,
  ] = await Promise.all([
    edgeConfigAdapter.get("history.enabled"),
    edgeConfigAdapter.get("history.readOnly"),
    edgeConfigAdapter.get("history.allowAnonInProd"),
    edgeConfigAdapter.get("history.requireHistoryToken"),
    edgeConfigAdapter.get("history.databaseMode"),
    edgeConfigAdapter.get("history.maxBodyBytes"),
    edgeConfigAdapter.get("history.maxFramesPerRecord"),
    edgeConfigAdapter.get("history.maxImageBytes"),
    edgeConfigAdapter.get("history.maxTotalImageBytes"),
  ]);

  return {
    enabled,
    readOnly,
    allowAnonInProd,
    requireHistoryToken,
    databaseMode,
    requestBodyLimitBytes,
    maxFramesPerRecord,
    maxImageBytes,
    maxTotalImageBytes,
  };
};

const getRuntimePolicy = async () => {
  const now = Date.now();
  if (policyCache.value && now < policyCache.expireAt) return policyCache.value;

  const base = buildEnvPolicy();
  const edgeConfigured = base.edgeConfig.configured;
  let runtime = base;

  if (edgeConfigured) {
    try {
      const patch = await readEdgePolicyPatch();
      const hasPatch = Object.values(patch).some((value) => value !== undefined && value !== null && value !== "");
      runtime = mergeWithEdgePolicy(base, patch);
      runtime.edgeConfig = {
        configured: true,
        connected: true,
        used: hasPatch,
        reason: "",
      };
      runtime.source = hasPatch ? "edge_config" : "env";
    } catch (error) {
      runtime.edgeConfig = {
        configured: true,
        connected: false,
        used: false,
        reason: String(error?.message || "edge config read failed"),
      };
    }
  } else {
    runtime.edgeConfig = {
      configured: false,
      connected: false,
      used: false,
      reason: "EDGE_CONFIG 未配置",
    };
  }

  policyCache = {
    expireAt: now + POLICY_CACHE_MS,
    value: runtime,
  };

  return runtime;
};

const normalizeTaskStatus = (value, fallback = "concept") => {
  const status = String(value || "").trim().toLowerCase();
  if (TASK_STATUSES.has(status)) return status;
  return fallback;
};

const normalizeIp = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "unknown";
  if (raw.includes(",")) return normalizeIp(raw.split(",")[0]);
  return raw.replace(/^::ffff:/, "");
};

const extractClientIp = (req) => {
  if (!req) return "unknown";
  const fromForwarded = req.headers?.["x-forwarded-for"];
  const fromRealIp = req.headers?.["x-real-ip"];
  const fromCf = req.headers?.["cf-connecting-ip"];
  const fromVercel = req.headers?.["x-vercel-forwarded-for"];
  const fromSocket = req.socket?.remoteAddress;
  return normalizeIp(fromForwarded || fromRealIp || fromCf || fromVercel || fromSocket);
};

const parseRawJson = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error("请求体 JSON 无效"), { status: 400 });
  }
};

const parseJsonBody = async (req, requestBodyLimitBytes = DEFAULT_REQUEST_BODY_LIMIT_BYTES) => {
  if (!req || req.method !== "POST") return {};
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    const bodySize = Buffer.byteLength(req.body);
    if (bodySize > requestBodyLimitBytes) {
      throw Object.assign(new Error(`请求体过大，超过 ${requestBodyLimitBytes} bytes`), { status: 413 });
    }
    return parseRawJson(req.body);
  }
  if (typeof req?.[Symbol.asyncIterator] !== "function") return {};

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > requestBodyLimitBytes) {
      throw Object.assign(new Error(`请求体过大，超过 ${requestBodyLimitBytes} bytes`), { status: 413 });
    }
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return parseRawJson(raw);
};

const sendJson = (res, status, payload = {}) => {
  res.status(status).json(payload);
};

const readHeader = (req, name) => {
  const headers = req?.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
};

const extractGatewayToken = (req) => {
  const byHeader = readHeader(req, "x-gateway-token");
  if (typeof byHeader === "string" && byHeader.trim()) return byHeader.trim();

  const authorization = readHeader(req, "authorization");
  if (typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return "";
};

const isAuthorized = (req, policy) => {
  if (!policy?.requireHistoryToken) return true;
  if (!policy?.historyGatewayToken) return false;
  return extractGatewayToken(req) === policy.historyGatewayToken;
};

const getAuthErrorMessage = (policy) => {
  if (policy?.requireHistoryToken && !policy?.historyGatewayToken) {
    return "HISTORY_GATEWAY_TOKEN/AI_GATEWAY_TOKEN 未配置：生产环境默认要求历史接口鉴权。";
  }
  return "Unauthorized";
};

const getAction = (req, body) => {
  if (req.method === "GET") return String(req.query?.action || "list");
  return String(body?.action || "upsert");
};

const dataUrlToBuffer = (input) => {
  const match = String(input || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  try {
    return { mime, buffer: Buffer.from(base64, "base64") };
  } catch {
    return null;
  }
};

const mimeToExt = (mime) => {
  const value = String(mime || "").toLowerCase();
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  return "bin";
};

const normalizeHistoryItem = (source = {}) => {
  const now = Date.now();
  const id = sanitizeId(source.id || source.timestamp || now);
  const timestamp = toPositiveInt(source.timestamp, now);
  const updatedAt = toPositiveInt(source.updatedAt, now);
  const userInput = toText(source.userInput, "").slice(0, 8000);
  const ownerId = sanitizeId(source.ownerId || "guest");
  const clientIp = normalizeIp(source.clientIp);
  const taskStatus = normalizeTaskStatus(source.taskStatus, "concept");
  const plan = source.plan && typeof source.plan === "object" ? source.plan : {};

  return {
    id,
    timestamp,
    updatedAt,
    createdAtIso: new Date(timestamp).toISOString(),
    updatedAtIso: new Date(updatedAt).toISOString(),
    userInput,
    ownerId,
    clientIp,
    taskStatus,
    source: "vercel_blob",
    plan,
  };
};

const cloneJson = (input) => JSON.parse(JSON.stringify(input || {}));

const persistImages = async (recordId, planLike, policy) => {
  const maxFramesPerRecord = toPositiveInt(
    policy?.maxFramesPerRecord,
    DEFAULT_MAX_FRAMES_PER_RECORD,
    MAX_MAX_FRAMES_PER_RECORD
  );
  const maxImageBytes = toPositiveInt(policy?.maxImageBytes, DEFAULT_MAX_IMAGE_BYTES, MAX_MAX_IMAGE_BYTES);
  const maxTotalImageBytes = Math.max(
    maxImageBytes,
    toPositiveInt(policy?.maxTotalImageBytes, DEFAULT_MAX_TOTAL_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES_LIMIT)
  );
  const plan = cloneJson(planLike);
  const frameGroups = FRAME_COLLECTION_FIELDS.map((field) => ({
    field,
    frames: Array.isArray(plan?.[field]) ? plan[field] : [],
  }));
  const totalFrames = frameGroups.reduce((sum, group) => sum + group.frames.length, 0);
  if (!totalFrames) return plan;
  if (totalFrames > maxFramesPerRecord) {
    throw Object.assign(new Error(`图片帧数量超过上限 ${maxFramesPerRecord}`), { status: 400 });
  }

  let totalImageBytes = 0;

  for (const group of frameGroups) {
    for (let i = 0; i < group.frames.length; i++) {
      const frame = group.frames[i];
      const parsed = dataUrlToBuffer(frame?.imageUrl);
      if (!parsed) continue;
      const imageBytes = Number(parsed.buffer?.byteLength || 0);
      if (imageBytes > maxImageBytes) {
        throw Object.assign(new Error(`单张图片超过上限 ${maxImageBytes} bytes`), { status: 413 });
      }
      totalImageBytes += imageBytes;
      if (totalImageBytes > maxTotalImageBytes) {
        throw Object.assign(new Error(`图片总大小超过上限 ${maxTotalImageBytes} bytes`), { status: 413 });
      }

      const ext = mimeToExt(parsed.mime);
      const path = `${IMAGE_PREFIX}${recordId}/${group.field}-${Date.now()}-${i + 1}.${ext}`;
      const uploaded = await blobAdapter.put(path, parsed.buffer, {
        access: "public",
        addRandomSuffix: true,
        contentType: parsed.mime,
        cacheControlMaxAge: 60 * 60 * 24 * 30,
      });

      frame.imageUrl = uploaded.url;
    }
    plan[group.field] = group.frames;
  }

  return plan;
};

const previewImage = (item) => {
  for (const field of ["renderFrames", "conceptFrames"]) {
    const frames = Array.isArray(item?.plan?.[field]) ? item.plan[field] : [];
    const first = frames.find((f) => typeof f?.imageUrl === "string" && f.imageUrl);
    if (first?.imageUrl) return first.imageUrl;
  }
  return "";
};

const latestPathname = (id) => `${LATEST_PREFIX}${id}.json`;
const snapshotPathname = (id, ts) => `${SNAPSHOT_PREFIX}${id}/${ts}.json`;
const shouldUsePostgres = (policy) => {
  const mode = normalizeDatabaseMode(policy?.databaseMode, "blob");
  return mode === "hybrid" || mode === "postgres";
};

const writeRecord = async (sourceItem, req, policy) => {
  const normalized = normalizeHistoryItem(sourceItem);
  const requestIp = extractClientIp(req);
  const effectiveIp = normalized.clientIp === "unknown" ? requestIp : normalized.clientIp;
  const plan = await persistImages(normalized.id, normalized.plan, policy);
  const nextUpdatedAt = Date.now();
  const payload = {
    ...normalized,
    updatedAt: nextUpdatedAt,
    updatedAtIso: new Date(nextUpdatedAt).toISOString(),
    clientIp: effectiveIp,
    plan,
    previewImageUrl: previewImage({ plan }),
  };
  const body = JSON.stringify(payload);

  await Promise.all([
    blobAdapter.put(latestPathname(payload.id), body, {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    }),
    blobAdapter.put(snapshotPathname(payload.id, payload.updatedAt), body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    }),
  ]);

  if (shouldUsePostgres(policy)) {
    try {
      await upsertPostgresRecord(payload);
    } catch (error) {
      if (normalizeDatabaseMode(policy?.databaseMode, "blob") === "postgres") {
        throw Object.assign(new Error(`Postgres 写入失败: ${String(error?.message || error)}`), { status: 503 });
      }
    }
  }

  return payload;
};

const readJson = async (url) => {
  const response = await fetchAdapter(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`读取记录失败: ${response.status}`);
  return response.json();
};

const mapPostgresRowToHistoryItem = (row = {}) => {
  const timestamp = toPositiveInt(row.timestamp, Date.now());
  const updatedAt = toPositiveInt(row.updated_at, timestamp);
  const rawPlan = row.plan_json;
  const plan =
    rawPlan && typeof rawPlan === "object" ? rawPlan : (() => {
      try {
        return rawPlan ? JSON.parse(String(rawPlan)) : {};
      } catch {
        return {};
      }
    })();

  return {
    id: sanitizeId(row.id || timestamp),
    timestamp,
    updatedAt,
    createdAtIso: toText(row.created_at_iso, new Date(timestamp).toISOString()),
    updatedAtIso: toText(row.updated_at_iso, new Date(updatedAt).toISOString()),
    userInput: toText(row.user_input, ""),
    ownerId: sanitizeId(row.owner_id || "guest"),
    clientIp: normalizeIp(row.client_ip),
    taskStatus: normalizeTaskStatus(row.task_status, "completed"),
    source: toText(row.source, "vercel_blob"),
    plan,
    previewImageUrl: toText(row.preview_image_url, ""),
  };
};

const encodePostgresCursor = (updatedAt, id) => `${toPositiveInt(updatedAt, 0)}:${sanitizeId(id)}`;

const decodePostgresCursor = (cursorRaw) => {
  const cursor = String(cursorRaw || "").trim();
  if (!cursor.includes(":")) return null;
  const [updatedAtRaw, idRaw] = cursor.split(":");
  const updatedAt = toPositiveInt(updatedAtRaw, 0);
  const id = sanitizeId(idRaw);
  if (!updatedAt || !id) return null;
  return { updatedAt, id };
};

const upsertPostgresRecord = async (item) => {
  await ensurePostgresSchema();
  await pgQuery(
    `
      INSERT INTO ${HISTORY_TABLE} (
        id, timestamp, updated_at, created_at_iso, updated_at_iso,
        owner_id, user_input, client_ip, task_status, source, preview_image_url, plan_json
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        timestamp = EXCLUDED.timestamp,
        updated_at = EXCLUDED.updated_at,
        created_at_iso = EXCLUDED.created_at_iso,
        updated_at_iso = EXCLUDED.updated_at_iso,
        owner_id = EXCLUDED.owner_id,
        user_input = EXCLUDED.user_input,
        client_ip = EXCLUDED.client_ip,
        task_status = EXCLUDED.task_status,
        source = EXCLUDED.source,
        preview_image_url = EXCLUDED.preview_image_url,
        plan_json = EXCLUDED.plan_json;
    `,
    [
      item.id,
      item.timestamp,
      item.updatedAt,
      item.createdAtIso,
      item.updatedAtIso,
      item.ownerId,
      item.userInput,
      item.clientIp,
      item.taskStatus,
      item.source,
      item.previewImageUrl || "",
      JSON.stringify(item.plan || {}),
    ]
  );
};

const listPostgresRecords = async ({ limit = 60, cursor = undefined } = {}) => {
  await ensurePostgresSchema();
  const safeLimit = toPositiveInt(limit, 60, 200);
  const parsedCursor = decodePostgresCursor(cursor);
  const fetchLimit = safeLimit + 1;

  let rows = [];
  if (parsedCursor) {
    const result = await pgQuery(
      `
      SELECT *
      FROM ${HISTORY_TABLE}
      WHERE (updated_at < $1 OR (updated_at = $1 AND id < $2))
      ORDER BY updated_at DESC, id DESC
      LIMIT $3;
      `,
      [parsedCursor.updatedAt, parsedCursor.id, fetchLimit]
    );
    rows = Array.isArray(result?.rows) ? result.rows : [];
  } else {
    const result = await pgQuery(
      `
      SELECT *
      FROM ${HISTORY_TABLE}
      ORDER BY updated_at DESC, id DESC
      LIMIT $1;
      `,
      [fetchLimit]
    );
    rows = Array.isArray(result?.rows) ? result.rows : [];
  }

  const hasMore = rows.length > safeLimit;
  const sliced = hasMore ? rows.slice(0, safeLimit) : rows;
  const items = sliced.map(mapPostgresRowToHistoryItem);
  const last = items[items.length - 1];

  return {
    items,
    cursor: hasMore && last ? encodePostgresCursor(last.updatedAt, last.id) : "",
    hasMore,
  };
};

const deletePostgresRecord = async (idRaw) => {
  const id = sanitizeId(idRaw);
  await ensurePostgresSchema();
  const result = await pgQuery(`DELETE FROM ${HISTORY_TABLE} WHERE id = $1;`, [id]);
  return {
    id,
    deleted: Number(result?.rowCount || 0),
  };
};

const listLatestRecords = async ({ limit = 60, cursor = undefined } = {}) => {
  const result = await blobAdapter.list({
    prefix: LATEST_PREFIX,
    limit: toPositiveInt(limit, 60, 200),
    ...(cursor ? { cursor } : {}),
  });

  const items = await Promise.all(
    (result?.blobs || []).map(async (blob) => {
      try {
        return await readJson(blob.url);
      } catch {
        return null;
      }
    })
  );

  const sorted = items
    .filter(Boolean)
    .sort((a, b) => Number(b.updatedAt || b.timestamp || 0) - Number(a.updatedAt || a.timestamp || 0));

  return {
    items: sorted,
    cursor: result?.cursor || "",
    hasMore: Boolean(result?.hasMore),
  };
};

const collectBlobUrlsByPrefix = async (prefix) => {
  let cursor = undefined;
  const urls = [];
  let guard = 0;

  while (guard < 20) {
    const page = await blobAdapter.list({
      prefix,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });

    for (const blob of page?.blobs || []) {
      if (blob?.url) urls.push(blob.url);
    }

    if (!page?.hasMore || !page?.cursor) break;
    cursor = page.cursor;
    guard += 1;
  }

  return urls;
};

const deleteRecord = async (idRaw) => {
  const id = sanitizeId(idRaw);
  const [latestUrls, snapshotUrls, imageUrls] = await Promise.all([
    collectBlobUrlsByPrefix(latestPathname(id)),
    collectBlobUrlsByPrefix(`${SNAPSHOT_PREFIX}${id}/`),
    collectBlobUrlsByPrefix(`${IMAGE_PREFIX}${id}/`),
  ]);

  const urls = [...latestUrls, ...snapshotUrls, ...imageUrls];
  if (urls.length) await blobAdapter.del(urls);
  return { id, deleted: urls.length };
};

const listRecords = async ({ limit = 60, cursor = undefined, policy } = {}) => {
  if (shouldUsePostgres(policy)) {
    try {
      return await listPostgresRecords({ limit, cursor });
    } catch (error) {
      if (normalizeDatabaseMode(policy?.databaseMode, "blob") === "postgres") {
        throw Object.assign(new Error(`Postgres 读取失败: ${String(error?.message || error)}`), { status: 503 });
      }
    }
  }
  return listLatestRecords({ limit, cursor });
};

const deleteRecordWithPolicy = async (idRaw, policy) => {
  const blobResult = await deleteRecord(idRaw);
  if (shouldUsePostgres(policy)) {
    try {
      await deletePostgresRecord(idRaw);
    } catch (error) {
      if (normalizeDatabaseMode(policy?.databaseMode, "blob") === "postgres") {
        throw Object.assign(new Error(`Postgres 删除失败: ${String(error?.message || error)}`), { status: 503 });
      }
    }
  }
  return blobResult;
};

const probePostgres = async (policy) => {
  const configured = isPostgresConfigured();
  const mode = normalizeDatabaseMode(policy?.databaseMode, configured ? "hybrid" : "blob");
  if (!configured) {
    return {
      mode,
      configured: false,
      connected: false,
      ready: false,
      reason: "missing POSTGRES_URL/DATABASE_URL/PRISMA_DATABASE_URL",
    };
  }

  try {
    await ensurePostgresSchema();
    await pgQuery("SELECT 1;");
    return {
      mode,
      configured: true,
      connected: true,
      ready: true,
      reason: "",
    };
  } catch (error) {
    return {
      mode,
      configured: true,
      connected: false,
      ready: false,
      reason: String(error?.message || "postgres check failed"),
    };
  }
};

const healthCheck = async (policy) => {
  const auth = {
    required: Boolean(policy?.requireHistoryToken),
    configured: Boolean(policy?.historyGatewayToken),
    allowAnonInProd: Boolean(policy?.allowAnonInProd),
  };
  const runtime = {
    source: toText(policy?.source, "env"),
    enabled: Boolean(policy?.enabled),
    readOnly: Boolean(policy?.readOnly),
    databaseMode: normalizeDatabaseMode(policy?.databaseMode, "blob"),
    requestBodyLimitBytes: toPositiveInt(
      policy?.requestBodyLimitBytes,
      DEFAULT_REQUEST_BODY_LIMIT_BYTES,
      MAX_REQUEST_BODY_LIMIT_BYTES
    ),
    maxFramesPerRecord: toPositiveInt(
      policy?.maxFramesPerRecord,
      DEFAULT_MAX_FRAMES_PER_RECORD,
      MAX_MAX_FRAMES_PER_RECORD
    ),
    maxImageBytes: toPositiveInt(policy?.maxImageBytes, DEFAULT_MAX_IMAGE_BYTES, MAX_MAX_IMAGE_BYTES),
    maxTotalImageBytes: toPositiveInt(
      policy?.maxTotalImageBytes,
      DEFAULT_MAX_TOTAL_IMAGE_BYTES,
      MAX_TOTAL_IMAGE_BYTES_LIMIT
    ),
  };
  const database = await probePostgres(policy);
  const edgeConfig = policy?.edgeConfig || {
    configured: false,
    connected: false,
    used: false,
    reason: "EDGE_CONFIG 未配置",
  };
  const configured = readBlobTokenConfigured();
  if (!configured) {
    return {
      ok: true,
      auth,
      runtime,
      database,
      edgeConfig,
      storage: {
        provider: "vercel_blob",
        configured: false,
        connected: false,
        reason: "missing BLOB_READ_WRITE_TOKEN",
      },
    };
  }

  try {
    await blobAdapter.list({ prefix: LATEST_PREFIX, limit: 1 });
    return {
      ok: true,
      auth,
      runtime,
      database,
      edgeConfig,
      storage: {
        provider: "vercel_blob",
        configured: true,
        connected: true,
      },
    };
  } catch (error) {
    return {
      ok: true,
      auth,
      runtime,
      database,
      edgeConfig,
      storage: {
        provider: "vercel_blob",
        configured: true,
        connected: false,
        reason: String(error?.message || "blob check failed"),
      },
    };
  }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "OPTIONS") {
      return sendJson(res, 204, {});
    }

    const policy = await getRuntimePolicy();
    const body = await parseJsonBody(req, policy.requestBodyLimitBytes);
    const action = getAction(req, body);
    const hasBlobToken = readBlobTokenConfigured();

    if (req.method === "GET" && action === "health") {
      const data = await healthCheck(policy);
      return sendJson(res, 200, data);
    }

    if (!policy.enabled) {
      return sendJson(res, 503, {
        ok: false,
        error: "历史服务已被运行时策略禁用",
      });
    }

    if (!isAuthorized(req, policy)) {
      return sendJson(res, 401, {
        ok: false,
        error: getAuthErrorMessage(policy),
      });
    }

    if (!hasBlobToken) {
      return sendJson(res, 503, {
        ok: false,
        error: "BLOB_READ_WRITE_TOKEN 未配置，历史云存储不可用",
      });
    }

    if (normalizeDatabaseMode(policy.databaseMode, "blob") === "postgres" && !isPostgresConfigured()) {
      return sendJson(res, 503, {
        ok: false,
        error: "历史策略要求 Postgres，但 POSTGRES_URL/DATABASE_URL 未配置",
      });
    }

    if (policy.readOnly && ((req.method === "POST" && (action === "upsert" || action === "delete")) || req.method === "DELETE")) {
      return sendJson(res, 503, {
        ok: false,
        error: "历史服务当前为只读模式",
      });
    }

    if (req.method === "GET" && action === "list") {
      const limit = toPositiveInt(req.query?.limit, 60, 200);
      const cursor = toText(req.query?.cursor, "") || undefined;
      const data = await listRecords({ limit, cursor, policy });
      return sendJson(res, 200, { ok: true, ...data });
    }

    if (req.method === "POST" && action === "upsert") {
      const raw = body?.item && typeof body.item === "object" ? body.item : body;
      if (!raw || typeof raw !== "object") {
        return sendJson(res, 400, { ok: false, error: "item is required" });
      }
      if (!raw.plan || typeof raw.plan !== "object") {
        return sendJson(res, 400, { ok: false, error: "item.plan is required" });
      }
      const saved = await writeRecord(raw, req, policy);
      return sendJson(res, 200, { ok: true, item: saved });
    }

    if ((req.method === "POST" && action === "delete") || req.method === "DELETE") {
      const id = body?.id || req.query?.id;
      if (!id) return sendJson(res, 400, { ok: false, error: "id is required" });
      const result = await deleteRecordWithPolicy(id, policy);
      return sendJson(res, 200, { ok: true, ...result });
    }

    return sendJson(res, 400, { ok: false, error: "Unsupported action" });
  } catch (error) {
    return sendJson(res, Number(error?.status || 500), {
      ok: false,
      error: String(error?.message || "history service failed"),
    });
  }
}
