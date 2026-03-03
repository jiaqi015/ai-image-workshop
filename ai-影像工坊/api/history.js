import { del, list, put } from "@vercel/blob";

const HISTORY_PREFIX = "history";
const LATEST_PREFIX = `${HISTORY_PREFIX}/latest/`;
const SNAPSHOT_PREFIX = `${HISTORY_PREFIX}/snapshots/`;
const IMAGE_PREFIX = `${HISTORY_PREFIX}/images/`;

const toPositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
};

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

const parseJsonBody = async (req) => {
  if (!req || req.method !== "POST") return {};
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const sendJson = (res, status, payload = {}) => {
  res.status(status).json(payload);
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
  const plan = source.plan && typeof source.plan === "object" ? source.plan : {};

  return {
    id,
    timestamp,
    updatedAt,
    userInput,
    ownerId,
    source: "vercel_blob",
    plan,
  };
};

const cloneJson = (input) => JSON.parse(JSON.stringify(input || {}));

const persistImages = async (recordId, planLike) => {
  const plan = cloneJson(planLike);
  const frames = Array.isArray(plan?.conceptFrames) ? plan.conceptFrames : [];
  if (!frames.length) return plan;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const parsed = dataUrlToBuffer(frame?.imageUrl);
    if (!parsed) continue;

    const ext = mimeToExt(parsed.mime);
    const path = `${IMAGE_PREFIX}${recordId}/${Date.now()}-${i + 1}.${ext}`;
    const uploaded = await put(path, parsed.buffer, {
      access: "public",
      addRandomSuffix: true,
      contentType: parsed.mime,
      cacheControlMaxAge: 60 * 60 * 24 * 30,
    });

    frame.imageUrl = uploaded.url;
  }

  plan.conceptFrames = frames;
  return plan;
};

const previewImage = (item) => {
  const frames = Array.isArray(item?.plan?.conceptFrames) ? item.plan.conceptFrames : [];
  const first = frames.find((f) => typeof f?.imageUrl === "string" && f.imageUrl);
  return first?.imageUrl || "";
};

const latestPathname = (id) => `${LATEST_PREFIX}${id}.json`;
const snapshotPathname = (id, ts) => `${SNAPSHOT_PREFIX}${id}/${ts}.json`;

const writeRecord = async (sourceItem) => {
  const normalized = normalizeHistoryItem(sourceItem);
  const plan = await persistImages(normalized.id, normalized.plan);
  const payload = {
    ...normalized,
    updatedAt: Date.now(),
    plan,
    previewImageUrl: previewImage({ plan }),
  };
  const body = JSON.stringify(payload);

  await Promise.all([
    put(latestPathname(payload.id), body, {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    }),
    put(snapshotPathname(payload.id, payload.updatedAt), body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
    }),
  ]);

  return payload;
};

const readJson = async (url) => {
  const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`读取记录失败: ${response.status}`);
  return response.json();
};

const listLatestRecords = async ({ limit = 60, cursor = undefined } = {}) => {
  const result = await list({
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
    const page = await list({
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
  if (urls.length) await del(urls);
  return { id, deleted: urls.length };
};

const healthCheck = async () => {
  const configured = Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || "").trim());
  if (!configured) {
    return {
      ok: true,
      storage: {
        provider: "vercel_blob",
        configured: false,
        connected: false,
        reason: "missing BLOB_READ_WRITE_TOKEN",
      },
    };
  }

  try {
    await list({ prefix: LATEST_PREFIX, limit: 1 });
    return {
      ok: true,
      storage: {
        provider: "vercel_blob",
        configured: true,
        connected: true,
      },
    };
  } catch (error) {
    return {
      ok: true,
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

    const body = await parseJsonBody(req);
    const action = getAction(req, body);
    const hasToken = Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || "").trim());

    if (req.method === "GET" && action === "health") {
      const data = await healthCheck();
      return sendJson(res, 200, data);
    }

    if (!hasToken) {
      return sendJson(res, 503, {
        ok: false,
        error: "BLOB_READ_WRITE_TOKEN 未配置，历史云存储不可用",
      });
    }

    if (req.method === "GET" && action === "list") {
      const limit = toPositiveInt(req.query?.limit, 60, 200);
      const cursor = toText(req.query?.cursor, "") || undefined;
      const data = await listLatestRecords({ limit, cursor });
      return sendJson(res, 200, { ok: true, ...data });
    }

    if (req.method === "POST" && action === "upsert") {
      const raw = body?.item && typeof body.item === "object" ? body.item : body;
      const saved = await writeRecord(raw);
      return sendJson(res, 200, { ok: true, item: saved });
    }

    if ((req.method === "POST" && action === "delete") || req.method === "DELETE") {
      const id = body?.id || req.query?.id;
      if (!id) return sendJson(res, 400, { ok: false, error: "id is required" });
      const result = await deleteRecord(id);
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
