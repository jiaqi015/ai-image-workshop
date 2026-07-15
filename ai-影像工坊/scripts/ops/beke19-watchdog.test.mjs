import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_POST_TIMEOUT_MS,
  DEFAULT_READ_RETRY_DELAY_MS,
  DEFAULT_READ_TIMEOUT_MS,
  DEFAULT_RETRY_DELAY_MS,
  MAX_PREFLIGHT_ATTEMPTS,
  runBeke19Watchdog,
} from "./beke19-watchdog.mjs";

const NOW = Date.parse("2026-07-15T04:00:00.000Z");
const OLD_RUN_ID = "run-old";
const NEW_RUN_ID = "run-new";

function response(status, payload) {
  return new Response(payload === undefined ? undefined : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function snapshotPayload({
  nextUpdateAt = "2026-07-15T03:11:00.000Z",
  runId = OLD_RUN_ID,
  updatedAt = "2026-07-14T13:11:00.000Z",
  source = "server-harness",
  runStatus = "success",
} = {}) {
  return {
    ok: true,
    state: {
      snapshot: {
        project: "beke19",
        runId,
        updatedAt,
        nextUpdateAt,
      },
      run: { status: runStatus },
    },
    runtime: { source },
  };
}

function successfulRefreshPayload() {
  return snapshotPayload({
    nextUpdateAt: "2026-07-15T10:00:00.000Z",
    runId: NEW_RUN_ID,
    updatedAt: "2026-07-15T04:00:01.000Z",
  });
}

function createLogger() {
  const entries = [];
  return {
    entries,
    info(message) {
      entries.push(["info", message]);
    },
    warn(message) {
      entries.push(["warn", message]);
    },
    error(message) {
      entries.push(["error", message]);
    },
  };
}

test("does nothing when the published nextUpdateAt has not arrived", async () => {
  const requests = [];
  const logger = createLogger();
  const result = await runBeke19Watchdog({
    env: { BEKE19_REFRESH_TOKEN: "secret" },
    now: () => NOW,
    logger,
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      return response(200, snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" }));
    },
  });

  assert.equal(result.status, "not-due");
  assert.equal(result.nextUpdateAt, "2026-07-15T04:30:00.000Z");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, "GET");
  assert.match(requests[0].url, /watchdog=.*-preflight/);
  assert.equal(requests[0].options.headers["Cache-Control"], "no-cache");
  assert.equal(requests[0].options.signal.aborted, false);
});

test("FORCE_REFRESH bypasses the due-time guard for workflow_dispatch", async () => {
  const requests = [];
  const queue = [
    response(200, snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" })),
    response(200, successfulRefreshPayload()),
    response(200, successfulRefreshPayload()),
  ];

  const result = await runBeke19Watchdog({
    env: {
      BEKE19_REFRESH_TOKEN: "secret",
      BEKE19_IDEMPOTENCY_KEY: "workflow-manual",
      FORCE_REFRESH: "true",
    },
    now: () => NOW,
    logger: createLogger(),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      return queue.shift();
    },
  });

  assert.equal(result.status, "published");
  assert.equal(result.attempts, 1);
  assert.equal(requests.length, 3);
  assert.equal(requests[1].options.method, "POST");
});

test("FORCE_REFRESH can recover from a static fallback preflight", async () => {
  const queue = [
    response(200, snapshotPayload({ source: "static-fallback", runStatus: "failed" })),
    response(200, successfulRefreshPayload()),
    response(200, successfulRefreshPayload()),
  ];

  const result = await runBeke19Watchdog({
    env: {
      BEKE19_REFRESH_TOKEN: "secret",
      FORCE_REFRESH: "true",
    },
    now: () => NOW,
    logger: createLogger(),
    fetchImpl: async () => queue.shift(),
  });

  assert.equal(result.status, "published");
  assert.equal(result.runId, NEW_RUN_ID);
});

test("refreshes a due snapshot and verifies the newly published run", async () => {
  const requests = [];
  const logger = createLogger();
  const sleepCalls = [];
  const queue = [
    response(200, snapshotPayload()),
    response(200, successfulRefreshPayload()),
    response(200, successfulRefreshPayload()),
  ];

  const result = await runBeke19Watchdog({
    env: {
      BEKE19_REFRESH_TOKEN: "secret",
      BEKE19_IDEMPOTENCY_KEY: "workflow-123",
    },
    now: () => NOW,
    logger,
    sleep: async (milliseconds) => sleepCalls.push(milliseconds),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      return queue.shift();
    },
  });

  assert.deepEqual(result, {
    status: "published",
    attempts: 1,
    runId: NEW_RUN_ID,
    updatedAt: "2026-07-15T04:00:01.000Z",
  });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[1].options.headers.Authorization, "Bearer secret");
  assert.equal(requests[1].options.headers["Idempotency-Key"], "workflow-123-attempt-1");
  assert.equal(requests[2].options.method, "GET");
  assert.match(requests[2].url, /watchdog=.*-verify-1-run-new/);
  assert.deepEqual(sleepCalls, []);
});

test("retries once with a different idempotency key after a rejected refresh", async () => {
  const requests = [];
  const logger = createLogger();
  const sleepCalls = [];
  const queue = [
    response(200, snapshotPayload()),
    response(200, snapshotPayload({ source: "last-known-good" })),
    response(200, snapshotPayload()),
    response(200, successfulRefreshPayload()),
    response(200, successfulRefreshPayload()),
  ];

  const result = await runBeke19Watchdog({
    env: {
      BEKE19_REFRESH_TOKEN: "secret",
      BEKE19_IDEMPOTENCY_KEY: "workflow-456",
      BEKE19_RETRY_DELAY_MS: "37",
    },
    now: () => NOW,
    logger,
    sleep: async (milliseconds) => sleepCalls.push(milliseconds),
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      return queue.shift();
    },
  });

  assert.equal(result.status, "published");
  assert.equal(result.attempts, 2);
  assert.deepEqual(sleepCalls, [37]);
  assert.equal(requests[1].options.headers["Idempotency-Key"], "workflow-456-attempt-1");
  assert.equal(requests[2].options.method, "GET");
  assert.equal(requests[3].options.headers["Idempotency-Key"], "workflow-456-attempt-2");
  assert.match(logger.entries.find(([level]) => level === "warn")[1], /attempt 1\/2 failed/);
});

test("fails after two attempts when refresh never satisfies the publication contract", async () => {
  const logger = createLogger();
  const queue = [
    response(200, snapshotPayload()),
    response(200, snapshotPayload({ source: "last-known-good" })),
    response(200, snapshotPayload()),
    response(200, snapshotPayload({ source: "last-known-good", runStatus: "failed" })),
  ];

  await assert.rejects(
    runBeke19Watchdog({
      env: {
        BEKE19_REFRESH_TOKEN: "secret",
        BEKE19_IDEMPOTENCY_KEY: "workflow-789",
        BEKE19_RETRY_DELAY_MS: "0",
      },
      now: () => NOW,
      logger,
      sleep: async () => {},
      fetchImpl: async () => queue.shift(),
    }),
    /failed after 2 attempts.*source must be server-harness.*run status must be success/s,
  );
});

test("rejects malformed preflight JSON instead of accidentally refreshing", async () => {
  let requests = 0;
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => {
        requests += 1;
        return new Response("not json", { status: 200 });
      },
    }),
    /preflight attempt 2 returned invalid JSON/,
  );
  assert.equal(requests, 2);
});

test("does not duplicate an ambiguous refresh after its client timeout", async () => {
  let refreshRequests = 0;
  const fetchImpl = async (url, options = {}) => {
    if (options.method === "GET") return response(200, snapshotPayload());
    refreshRequests += 1;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    });
  };

  await assert.rejects(
    runBeke19Watchdog({
      env: {
        BEKE19_REFRESH_TOKEN: "secret",
        BEKE19_IDEMPOTENCY_KEY: "workflow-timeout",
        BEKE19_POST_TIMEOUT_MS: "5",
        BEKE19_RETRY_DELAY_MS: "0",
      },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl,
    }),
    /outcome is ambiguous; refusing a duplicate POST/,
  );
  assert.equal(refreshRequests, 1);
});

test("accepts a timed-out refresh when reconciliation finds the new publication", async () => {
  let refreshRequests = 0;
  let published = false;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === "GET") {
      return response(200, published ? successfulRefreshPayload() : snapshotPayload());
    }
    refreshRequests += 1;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        published = true;
        reject(options.signal.reason);
      }, { once: true });
    });
  };

  const result = await runBeke19Watchdog({
    env: {
      BEKE19_REFRESH_TOKEN: "secret",
      BEKE19_POST_TIMEOUT_MS: "5",
      BEKE19_RETRY_DELAY_MS: "0",
    },
    now: () => NOW,
    logger: createLogger(),
    sleep: async () => {},
    fetchImpl,
  });

  assert.equal(result.status, "published");
  assert.equal(result.reconciled, true);
  assert.equal(result.runId, NEW_RUN_ID);
  assert.equal(refreshRequests, 1);
});

test("retries a transient preflight read before deciding whether refresh is due", async () => {
  const sleepCalls = [];
  let requests = 0;
  const result = await runBeke19Watchdog({
    env: { BEKE19_REFRESH_TOKEN: "secret" },
    now: () => NOW,
    logger: createLogger(),
    sleep: async (milliseconds) => sleepCalls.push(milliseconds),
    fetchImpl: async () => {
      requests += 1;
      if (requests === 1) throw new Error("temporary read failure");
      return response(200, snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" }));
    },
  });

  assert.equal(result.status, "not-due");
  assert.equal(requests, 2);
  assert.deepEqual(sleepCalls, [DEFAULT_READ_RETRY_DELAY_MS]);
});

test("uses bounded defaults that fit two refresh attempts inside the workflow budget", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/beke19-refresh.yml", import.meta.url), "utf8");
  const workflowMinutes = Number(workflow.match(/timeout-minutes:\s*(\d+)/)?.[1]);
  const workflowBudgetMs = workflowMinutes * 60_000;
  assert.equal(DEFAULT_READ_TIMEOUT_MS, 10_000);
  assert.equal(DEFAULT_POST_TIMEOUT_MS, 300_000);
  assert.equal(workflowMinutes, 12);
  const worstCaseMs = (
    DEFAULT_READ_TIMEOUT_MS * MAX_PREFLIGHT_ATTEMPTS
    + DEFAULT_READ_RETRY_DELAY_MS * (MAX_PREFLIGHT_ATTEMPTS - 1)
    + DEFAULT_POST_TIMEOUT_MS * 2
    + DEFAULT_RETRY_DELAY_MS
    + DEFAULT_READ_TIMEOUT_MS * 2
  );
  assert.ok(worstCaseMs <= workflowBudgetMs - 50_000);
});
