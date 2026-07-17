import { pathToFileURL } from "node:url";

export const DEFAULT_ENDPOINT = "https://www.cameraclaw.cn/api/beke19";
export const DEFAULT_READ_TIMEOUT_MS = 10_000;
export const DEFAULT_POST_TIMEOUT_MS = 300_000;
export const DEFAULT_RETRY_DELAY_MS = 20_000;
export const DEFAULT_READ_RETRY_DELAY_MS = 1_000;
export const MAX_REFRESH_ATTEMPTS = 2;
export const MAX_PREFLIGHT_ATTEMPTS = 2;

const EXPECTED_TARGETS = Object.freeze([18, 19.5, 21, 23, 30]);
const EXPECTED_MODEL_VERSION = "probability-synthesis-v5-90d-targets-18-19p5-21-23-30";
const EXPECTED_RUNTIME_VERSION = "research-runtime-targets-18-19p5-21-23-30-v6-90d-contract";
const EXPECTED_ANALYSIS_PROVIDER = "TokenPlanProvider";
const EXPECTED_ANALYSIS_MODEL_ID = "mimo-v2.5-pro";
const EXPECTED_PROMPT_VERSIONS = Object.freeze([
  "quant-research-context-v1.9.0-90d-targets-18-19p5-21-23-30",
  "bull-research-context-v1.6.0-90d-targets-18-19p5-21-23-30",
  "bear-research-context-v1.6.0-90d-targets-18-19p5-21-23-30",
  "professional-conclusion-context-v1.12.0-90d-targets-18-19p5-21-23-30",
]);
const REQUIRED_ANALYSIS_STAGES = Object.freeze([
  "quant",
  "bull",
  "bear",
  "professional_editor",
  "deterministic_critic",
]);
const EXPECTED_HORIZON_DAYS = 90;
const DAY_MS = 86_400_000;
const EXPECTED_TARGET_KEYS = Object.freeze(EXPECTED_TARGETS.map(String));
const EXPECTED_HISTORY_KEYS = new Set(EXPECTED_TARGETS.map((target) => `p${target}`));
const MAX_READ_TIMEOUT_MS = 30_000;
const MAX_POST_TIMEOUT_MS = 300_000;
const MAX_RETRY_DELAY_MS = 60_000;

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function integerSetting(env, name, fallback, { minimum = 0, maximum } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || (maximum !== undefined && value > maximum)) {
    const range = maximum === undefined ? `at least ${minimum}` : `between ${minimum} and ${maximum}`;
    throw new Error(`${name} must be an integer ${range}`);
  }
  return value;
}

function booleanSetting(env, name, fallback = false) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  if (raw === true || raw === "true" || raw === "1") return true;
  if (raw === false || raw === "false" || raw === "0") return false;
  throw new Error(`${name} must be true or false`);
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireTimestamp(value, label) {
  const timestamp = requireString(value, label);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return timestamp;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a JSON array`);
  }
  return value;
}

function equalOrderedValues(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function validateTargetKeys(value, label) {
  const targetMap = requireObject(value, label);
  const keys = Object.keys(targetMap).sort((left, right) => Number(left) - Number(right));
  if (!equalOrderedValues(keys, EXPECTED_TARGET_KEYS)) {
    throw new Error(`${label} keys must be exactly ${EXPECTED_TARGET_KEYS.join(",")}`);
  }
  return targetMap;
}

function validateTargetViews(value, label) {
  const targetViews = validateTargetKeys(value, label);
  for (const target of EXPECTED_TARGETS) {
    const view = requireObject(targetViews[String(target)], `${label}.${target}`);
    if (view.target !== target) {
      throw new Error(`${label}.${target} target must be ${target}`);
    }
  }
}

function validateTargetExplanations(value, label) {
  const explanations = validateTargetKeys(value, label);
  for (const target of EXPECTED_TARGETS) {
    requireString(explanations[String(target)], `${label}.${target}`);
  }
}

function validateModelGeneratedAnalysis(snapshot, label) {
  const analysis = requireObject(snapshot.analysis, `${label} analysis`);
  const generation = requireObject(analysis.generation, `${label} analysis.generation`);
  if (generation.mode !== "model_loop") {
    throw new Error(`${label} analysis.generation mode must be model_loop`);
  }
  if (generation.provider !== EXPECTED_ANALYSIS_PROVIDER) {
    throw new Error(`${label} analysis.generation provider must be ${EXPECTED_ANALYSIS_PROVIDER}`);
  }
  if (generation.modelId !== EXPECTED_ANALYSIS_MODEL_ID) {
    throw new Error(`${label} analysis.generation modelId must be ${EXPECTED_ANALYSIS_MODEL_ID}`);
  }
  requireString(generation.contextId, `${label} analysis.generation contextId`);

  const promptVersions = requireArray(
    generation.promptVersions,
    `${label} analysis.generation promptVersions`,
  );
  if (!equalOrderedValues(promptVersions, EXPECTED_PROMPT_VERSIONS)) {
    throw new Error(
      `${label} analysis.generation promptVersions must exactly match the current release contract`,
    );
  }

  const stages = requireArray(generation.stages, `${label} analysis.generation stages`);
  for (const requiredStage of REQUIRED_ANALYSIS_STAGES) {
    if (!stages.includes(requiredStage)) {
      throw new Error(`${label} analysis.generation stages must include ${requiredStage}`);
    }
  }
  const fallbackStage = stages.find(
    (stage) => typeof stage === "string" && /fallback/i.test(stage),
  );
  if (fallbackStage) {
    throw new Error(`${label} analysis.generation stages must not include fallback stage ${fallbackStage}`);
  }
}

function validateTargetPublicationContract(snapshot, label) {
  if (snapshot.modelVersion !== EXPECTED_MODEL_VERSION) {
    throw new Error(`${label} modelVersion must be ${EXPECTED_MODEL_VERSION}`);
  }
  const dataVersion = requireString(snapshot.dataVersion, `${label} dataVersion`);
  if (!dataVersion.split("+").includes(EXPECTED_RUNTIME_VERSION)) {
    throw new Error(`${label} dataVersion must include ${EXPECTED_RUNTIME_VERSION}`);
  }
  const predictions = requireArray(snapshot.predictions, `${label} predictions`);
  const issuedAtValues = new Set();
  const horizonEndValues = new Set();
  const predictionTargets = predictions.map((prediction, index) => {
    const record = requireObject(prediction, `${label} predictions[${index}]`);
    const probability = record.probability;
    const question = requireObject(record.forecastQuestion, `${label} predictions[${index}].forecastQuestion`);
    const issuedAt = Date.parse(requireTimestamp(question.issuedAt, `${label} predictions[${index}] issuedAt`));
    const horizonEnd = Date.parse(requireTimestamp(question.horizonEnd, `${label} predictions[${index}] horizonEnd`));
    const resolvedAtIssue = question.status === "resolved_at_issue" && probability === 100;
    if (!Number.isFinite(probability) || (!resolvedAtIssue && (probability < 5 || probability > 95))) {
      throw new Error(`${label} predictions[${index}] probability must be within the publish range`);
    }
    if (
      question.barrier !== record.target
      || question.horizonDays !== EXPECTED_HORIZON_DAYS
      || !String(question.questionId).endsWith(`-${record.target}-90d-first-touch`)
      || question.priceMeasure !== "regular_session_high"
      || question.event !== "first_touch"
      || question.tradingCalendar !== "XNYS"
      || question.timezone !== "America/New_York"
      || question.corporateActionPolicy !== "split_adjusted_barrier"
      || horizonEnd - issuedAt !== EXPECTED_HORIZON_DAYS * DAY_MS
    ) {
      throw new Error(`${label} predictions[${index}] must use the current 90-day first-touch contract`);
    }
    issuedAtValues.add(question.issuedAt);
    horizonEndValues.add(question.horizonEnd);
    return record.target;
  });
  if (!equalOrderedValues(predictionTargets, EXPECTED_TARGETS)) {
    throw new Error(`${label} predictions targets must be exactly ${EXPECTED_TARGETS.join(",")} in order`);
  }
  if (issuedAtValues.size !== 1 || horizonEndValues.size !== 1) {
    throw new Error(`${label} predictions must share one 90-day issue and end time`);
  }
  for (let index = 1; index < predictions.length; index += 1) {
    if (predictions[index].probability > predictions[index - 1].probability) {
      throw new Error(
        `${label} probabilities must satisfy ${EXPECTED_TARGETS.map((target) => `P${target}`).join(" >= ")}`,
      );
    }
  }

  const analysis = requireObject(snapshot.analysis, `${label} analysis`);
  validateTargetViews(analysis.targetViews, `${label} analysis.targetViews`);
  validateTargetExplanations(analysis.targetExplanations, `${label} analysis.targetExplanations`);

  const history = requireArray(snapshot.history, `${label} history`);
  if (history.length === 0) throw new Error(`${label} history must contain at least one point`);

  for (const [index, rawPoint] of history.entries()) {
    const point = requireObject(rawPoint, `${label} history[${index}]`);
    const unexpectedProbabilityKey = Object.keys(point).find(
      (key) => /^p\d+(?:\.\d+)?$/.test(key) && !EXPECTED_HISTORY_KEYS.has(key),
    );
    if (unexpectedProbabilityKey) {
      throw new Error(`${label} history contains unsupported probability key ${unexpectedProbabilityKey}`);
    }
    for (const key of EXPECTED_HISTORY_KEYS) {
      if (!Number.isFinite(point[key])) {
        throw new Error(`${label} history[${index}] ${key} must be finite`);
      }
    }
  }
}

function readPublicationEnvelope(payload, label) {
  const root = requireObject(payload, label);
  if (root.ok !== true) throw new Error(`${label} ok must be true`);

  const state = requireObject(root.state, `${label} state`);
  const snapshot = requireObject(state.snapshot, `${label} snapshot`);
  const run = requireObject(state.run, `${label} run`);
  const runtime = requireObject(root.runtime, `${label} runtime`);

  if (snapshot.project !== "beke19") throw new Error(`${label} project must be beke19`);
  const runId = requireString(snapshot.runId, `${label} runId`);
  const updatedAt = requireTimestamp(snapshot.updatedAt, `${label} updatedAt`);
  const nextUpdateAt = requireTimestamp(snapshot.nextUpdateAt, `${label} nextUpdateAt`);
  const runStatus = requireString(run.status, `${label} run status`);

  return {
    payload: root,
    snapshot,
    runId,
    updatedAt,
    nextUpdateAt,
    source: runtime.source,
    runStatus,
  };
}

function validatePublishedPayload(payload, label, {
  requireSuccessfulRun = true,
} = {}) {
  const publication = readPublicationEnvelope(payload, label);
  validateTargetPublicationContract(publication.snapshot, label);
  if (publication.source !== "static-fallback") {
    validateModelGeneratedAnalysis(publication.snapshot, label);
  }

  const { runStatus } = publication;
  if (requireSuccessfulRun && runStatus !== "success") {
    throw new Error(`${label} run status must be success`);
  }

  return publication;
}

function isDefinitiveUnpublishedResponse(payload, previousRunId) {
  try {
    const publication = readPublicationEnvelope(payload, "failed refresh");
    return publication.runId === previousRunId
      && (publication.source !== "server-harness" || publication.runStatus !== "success");
  } catch {
    return false;
  }
}

function validateRefreshPayload(payload, previousRunId) {
  const publication = validatePublishedPayload(payload, "refresh");
  if (publication.source !== "server-harness") {
    throw new Error(`refresh source must be server-harness (received ${publication.source ?? "missing"})`);
  }
  if (publication.runId === previousRunId) {
    throw new Error("refresh must publish a new runId");
  }
  return publication;
}

function validateVerificationPayload(payload, expectedRunId) {
  const publication = validatePublishedPayload(payload, "verification");
  if (publication.source !== "server-harness") {
    throw new Error(`verification source must be server-harness (received ${publication.source ?? "missing"})`);
  }
  if (publication.runId !== expectedRunId) {
    throw new Error(`verification runId must match the published run (${expectedRunId})`);
  }
  return publication;
}

async function parseResponseJson(response, label) {
  if (!response || typeof response.text !== "function") {
    throw new Error(`${label} did not return an HTTP response`);
  }

  const body = await response.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status} with invalid JSON`);
    throw new Error(`${label} returned invalid JSON`);
  }

  if (!response.ok) {
    const reason = typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.runtime?.degraded?.reason === "string"
        ? payload.runtime.degraded.reason
        : "request rejected";
    throw new Error(`${label} returned HTTP ${response.status}: ${reason}`);
  }
  return payload;
}

async function requestJson(fetchImpl, endpoint, { method, headers, timeoutMs, label }) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`${label} request failed: ${errorMessage(error)}`);
  }
  return parseResponseJson(response, label);
}

function uncachedReadEndpoint(endpoint, key) {
  const url = new URL(endpoint);
  url.searchParams.set("watchdog", key);
  return url.toString();
}

function refreshEndpoint(endpoint) {
  const url = new URL(endpoint);
  url.searchParams.set("action", "refresh");
  return url.toString();
}

function watchdogConfig(env) {
  return {
    endpoint: env.BEKE19_ENDPOINT || DEFAULT_ENDPOINT,
    forceRefresh: booleanSetting(env, "FORCE_REFRESH"),
    readTimeoutMs: integerSetting(env, "BEKE19_READ_TIMEOUT_MS", DEFAULT_READ_TIMEOUT_MS, {
      minimum: 1,
      maximum: MAX_READ_TIMEOUT_MS,
    }),
    postTimeoutMs: integerSetting(env, "BEKE19_POST_TIMEOUT_MS", DEFAULT_POST_TIMEOUT_MS, {
      minimum: 1,
      maximum: MAX_POST_TIMEOUT_MS,
    }),
    retryDelayMs: integerSetting(env, "BEKE19_RETRY_DELAY_MS", DEFAULT_RETRY_DELAY_MS, {
      minimum: 0,
      maximum: MAX_RETRY_DELAY_MS,
    }),
  };
}

export async function runBeke19Watchdog({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  logger = console,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const config = watchdogConfig(env);
  const nowMs = Number(now());
  if (!Number.isFinite(nowMs)) throw new Error("watchdog clock returned an invalid timestamp");

  let preflight;
  let preflightError;
  for (let attempt = 1; attempt <= MAX_PREFLIGHT_ATTEMPTS; attempt += 1) {
    try {
      const preflightPayload = await requestJson(
        fetchImpl,
        uncachedReadEndpoint(config.endpoint, `${nowMs}-preflight-${attempt}`),
        {
          method: "GET",
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
          timeoutMs: config.readTimeoutMs,
          label: `preflight attempt ${attempt}`,
        },
      );
      preflight = validatePublishedPayload(preflightPayload, "preflight", {
        requireSuccessfulRun: false,
      });
      break;
    } catch (error) {
      preflightError = error;
      logger.warn(`preflight ${attempt}/${MAX_PREFLIGHT_ATTEMPTS} failed: ${errorMessage(error)}`);
      if (attempt < MAX_PREFLIGHT_ATTEMPTS) await sleep(DEFAULT_READ_RETRY_DELAY_MS);
    }
  }
  if (!preflight) throw preflightError;

  if (!config.forceRefresh && Date.parse(preflight.nextUpdateAt) > nowMs) {
    logger.info(`not due: nextUpdateAt=${preflight.nextUpdateAt} runId=${preflight.runId}`);
    return { status: "not-due", nextUpdateAt: preflight.nextUpdateAt };
  }
  if (config.forceRefresh) {
    logger.info(`forced refresh: nextUpdateAt=${preflight.nextUpdateAt} runId=${preflight.runId}`);
  }

  const token = requireString(env.BEKE19_REFRESH_TOKEN, "BEKE19_REFRESH_TOKEN");
  const idempotencyBase = requireString(
    env.BEKE19_IDEMPOTENCY_KEY || `beke19-watchdog-${nowMs}`,
    "BEKE19_IDEMPOTENCY_KEY",
  );
  const failures = [];

  for (let attempt = 1; attempt <= MAX_REFRESH_ATTEMPTS; attempt += 1) {
    const idempotencyKey = `${idempotencyBase}-attempt-${attempt}`;
    let safeToRetry = false;
    try {
      const refreshPayload = await requestJson(fetchImpl, refreshEndpoint(config.endpoint), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        timeoutMs: config.postTimeoutMs,
        label: `refresh attempt ${attempt}`,
      });
      let refresh;
      try {
        refresh = validateRefreshPayload(refreshPayload, preflight.runId);
      } catch (error) {
        safeToRetry = isDefinitiveUnpublishedResponse(refreshPayload, preflight.runId);
        throw error;
      }

      const verificationPayload = await requestJson(
        fetchImpl,
        uncachedReadEndpoint(config.endpoint, `${nowMs}-verify-${attempt}-${refresh.runId}`),
        {
          method: "GET",
          headers: { Accept: "application/json", "Cache-Control": "no-cache" },
          timeoutMs: config.readTimeoutMs,
          label: "verification",
        },
      );
      const verification = validateVerificationPayload(verificationPayload, refresh.runId);
      logger.info(
        `published: attempt=${attempt} runId=${verification.runId} updatedAt=${verification.updatedAt} source=${verification.source}`,
      );
      return {
        status: "published",
        attempts: attempt,
        runId: verification.runId,
        updatedAt: verification.updatedAt,
      };
    } catch (error) {
      const reason = errorMessage(error);
      failures.push(`attempt ${attempt}: ${reason}`);
      logger.warn(`attempt ${attempt}/${MAX_REFRESH_ATTEMPTS} failed: ${reason}`);
      if (attempt >= MAX_REFRESH_ATTEMPTS) continue;

      await sleep(config.retryDelayMs);
      let reconciliationPayload;
      try {
        reconciliationPayload = await requestJson(
          fetchImpl,
          uncachedReadEndpoint(config.endpoint, `${nowMs}-reconcile-${attempt}`),
          {
            method: "GET",
            headers: { Accept: "application/json", "Cache-Control": "no-cache" },
            timeoutMs: config.readTimeoutMs,
            label: "reconciliation",
          },
        );
      } catch (reconciliationError) {
        throw new Error(
          `refresh outcome is ambiguous; refusing a duplicate POST because reconciliation failed: ${errorMessage(reconciliationError)}`,
        );
      }
      const reconciliation = validatePublishedPayload(
        reconciliationPayload,
        "reconciliation",
        { requireSuccessfulRun: false },
      );
      if (reconciliation.runId !== preflight.runId) {
        const verified = validateVerificationPayload(reconciliationPayload, reconciliation.runId);
        logger.info(
          `published after reconciliation: attempt=${attempt} runId=${verified.runId} updatedAt=${verified.updatedAt}`,
        );
        return {
          status: "published",
          attempts: attempt,
          runId: verified.runId,
          updatedAt: verified.updatedAt,
          reconciled: true,
        };
      }
      if (!safeToRetry) {
        throw new Error("refresh outcome is ambiguous; refusing a duplicate POST while the published runId is unchanged");
      }
      logger.info(`confirmed unpublished after attempt ${attempt}; retrying with a new idempotency key`);
    }
  }

  throw new Error(`BEKE19 refresh failed after ${MAX_REFRESH_ATTEMPTS} attempts: ${failures.join(" | ")}`);
}

async function main() {
  try {
    const result = await runBeke19Watchdog();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
