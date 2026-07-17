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
const CURRENT_TARGETS = [18, 19.5, 21, 23, 30];
const RETIRED_TARGETS = [18, 19, 20];
const LEGACY_TARGETS = [17, 18, 19];
const CURRENT_MODEL_VERSION = "probability-synthesis-v5-90d-targets-18-19p5-21-23-30";
const CURRENT_RUNTIME_VERSION = "research-runtime-targets-18-19p5-21-23-30-v6-90d-contract";
const CURRENT_PROMPT_VERSIONS = [
  "quant-research-context-v1.9.0-90d-targets-18-19p5-21-23-30",
  "bull-research-context-v1.6.0-90d-targets-18-19p5-21-23-30",
  "bear-research-context-v1.6.0-90d-targets-18-19p5-21-23-30",
  "professional-conclusion-context-v1.12.0-90d-targets-18-19p5-21-23-30",
];
const REQUIRED_ANALYSIS_STAGES = [
  "quant",
  "bull",
  "bear",
  "professional_editor",
  "deterministic_critic",
];

function response(status, payload) {
  return new Response(payload === undefined ? undefined : JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function keyedTargets(targets, valueFactory) {
  return Object.fromEntries(targets.map((target) => [String(target), valueFactory(target)]));
}

function historyPoint(targets = CURRENT_TARGETS) {
  return {
    publishedAt: "2026-07-14T13:11:00.000Z",
    ...Object.fromEntries(targets.map((target, index) => [`p${target}`, 60 - index * 12])),
  };
}

function forecastQuestion(target, issuedAt) {
  return {
    questionId: `BEKE-${issuedAt}-${target}-90d-first-touch`,
    issuedAt,
    horizonEnd: new Date(Date.parse(issuedAt) + 90 * 86_400_000).toISOString(),
    horizonDays: 90,
    barrier: target,
    priceMeasure: "regular_session_high",
    event: "first_touch",
    tradingCalendar: "XNYS",
    timezone: "America/New_York",
    corporateActionPolicy: "split_adjusted_barrier",
    status: "open",
  };
}

function modelGeneration(overrides = {}) {
  return {
    mode: "model_loop",
    provider: "TokenPlanProvider",
    modelId: "mimo-v2.5-pro",
    contextId: "ctx-watchdog-test",
    promptVersions: [...CURRENT_PROMPT_VERSIONS],
    stages: [...REQUIRED_ANALYSIS_STAGES],
    ...overrides,
  };
}

function snapshotPayload({
  nextUpdateAt = "2026-07-15T03:11:00.000Z",
  runId = OLD_RUN_ID,
  updatedAt = "2026-07-14T13:11:00.000Z",
  source = "server-harness",
  runStatus = "success",
  predictionTargets = CURRENT_TARGETS,
  targetViewTargets = predictionTargets,
  targetExplanationTargets = predictionTargets,
  history = [historyPoint(predictionTargets)],
  generation = modelGeneration(),
} = {}) {
  return {
    ok: true,
    state: {
      snapshot: {
        project: "beke19",
        runId,
        modelVersion: CURRENT_MODEL_VERSION,
        dataVersion: `${CURRENT_RUNTIME_VERSION}+watchdog-test`,
        updatedAt,
        nextUpdateAt,
        predictions: predictionTargets.map((target, index) => ({
          target,
          probability: 60 - index * 12,
          forecastQuestion: forecastQuestion(target, updatedAt),
        })),
        analysis: {
          targetViews: keyedTargets(targetViewTargets, (target) => ({ target })),
          targetExplanations: keyedTargets(targetExplanationTargets, (target) => `${target} 美元目标说明`),
          generation,
        },
        history,
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
    response(200, snapshotPayload({
      source: "static-fallback",
      runStatus: "failed",
      generation: {
        mode: "deterministic_fallback",
        provider: "PublishedProfessionalSnapshot",
        contextId: "ctx-static-fallback",
        promptVersions: [],
        stages: ["professional_editor", "deterministic_critic"],
      },
    })),
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

for (const invalidGenerationCase of [
  {
    name: "rejects a non-model analysis from server-harness",
    generation: modelGeneration({ mode: "deterministic_fallback" }),
    expected: /analysis\.generation mode must be model_loop/,
  },
  {
    name: "rejects a server-harness analysis from a non-TokenPlan provider",
    generation: modelGeneration({ provider: "DeterministicResearchPanel" }),
    expected: /analysis\.generation provider must be TokenPlanProvider/,
  },
  {
    name: "rejects a server-harness analysis from the wrong model",
    generation: modelGeneration({ modelId: "mimo-v2.5-lite" }),
    expected: /analysis\.generation modelId must be mimo-v2\.5-pro/,
  },
  {
    name: "rejects analysis prompts from the retired target contract",
    generation: modelGeneration({
      promptVersions: ["professional-conclusion-context-v1.7.0-90d-targets-18-19p5-21"],
    }),
    expected: /promptVersions must exactly match the current release contract/,
  },
  {
    name: "rejects a stale professional prompt even when its target marker is current",
    generation: modelGeneration({
      promptVersions: [
        ...CURRENT_PROMPT_VERSIONS.slice(0, 3),
        "professional-conclusion-context-v1.11.0-90d-targets-18-19p5-21-23-30",
      ],
    }),
    expected: /promptVersions must exactly match the current release contract/,
  },
  {
    name: "rejects an incomplete model stage ledger",
    generation: modelGeneration({
      stages: REQUIRED_ANALYSIS_STAGES.filter((stage) => stage !== "professional_editor"),
    }),
    expected: /stages must include professional_editor/,
  },
  {
    name: "rejects a mixed AI and deterministic target fallback publication",
    generation: modelGeneration({
      stages: [...REQUIRED_ANALYSIS_STAGES, "deterministic_target_fallback"],
    }),
    expected: /stages must not include fallback stage deterministic_target_fallback/,
  },
]) {
  test(invalidGenerationCase.name, async () => {
    await assert.rejects(
      runBeke19Watchdog({
        env: { BEKE19_REFRESH_TOKEN: "secret" },
        now: () => NOW,
        logger: createLogger(),
        sleep: async () => {},
        fetchImpl: async () => response(200, snapshotPayload({
          nextUpdateAt: "2026-07-15T04:30:00.000Z",
          generation: invalidGenerationCase.generation,
        })),
      }),
      invalidGenerationCase.expected,
    );
  });
}

test("accepts decimal target object keys after numeric normalization", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  assert.deepEqual(
    Object.keys(payload.state.snapshot.analysis.targetViews),
    ["18", "21", "23", "30", "19.5"],
  );

  const result = await runBeke19Watchdog({
    env: { BEKE19_REFRESH_TOKEN: "secret" },
    now: () => NOW,
    logger: createLogger(),
    fetchImpl: async () => response(200, payload),
  });

  assert.equal(result.status, "not-due");
});

test("rejects a target view whose embedded target does not match its key", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  payload.state.snapshot.analysis.targetViews["23"].target = 21;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /preflight analysis\.targetViews\.23 target must be 23/,
  );
});

test("rejects an empty explanation in the complete five-target map", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  payload.state.snapshot.analysis.targetExplanations["30"] = "";

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /preflight analysis\.targetExplanations\.30 must be a non-empty string/,
  );
});

test("rejects the retired 18/19/20 target contract during preflight even when the run says success", async () => {
  let requests = 0;
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => {
        requests += 1;
        return response(200, snapshotPayload({
          predictionTargets: RETIRED_TARGETS,
          nextUpdateAt: "2026-07-15T04:30:00.000Z",
        }));
      },
    }),
    /preflight predictions targets must be exactly 18,19.5,21,23,30 in order/,
  );
  assert.equal(requests, MAX_PREFLIGHT_ATTEMPTS);
});

test("rejects a five-target publication that still carries the retired 120-day horizon", async () => {
  const payload = snapshotPayload();
  payload.state.snapshot.predictions = payload.state.snapshot.predictions.map((prediction) => ({
    ...prediction,
    forecastQuestion: {
      ...prediction.forecastQuestion,
      questionId: prediction.forecastQuestion.questionId.replace("-90d-", "-120d-"),
      horizonDays: 120,
      horizonEnd: new Date(
        Date.parse(prediction.forecastQuestion.issuedAt) + 120 * 86_400_000,
      ).toISOString(),
    },
  }));

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      fetchImpl: async () => response(200, payload),
    }),
    /current 90-day first-touch contract/,
  );
});

test("rejects the retired probability model version", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  payload.state.snapshot.modelVersion = "probability-synthesis-v3-90d-targets-18-19-20";

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /preflight modelVersion must be probability-synthesis-v5-90d-targets-18-19p5-21-23-30/,
  );
});

test("rejects a publication without the current runtime marker", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  payload.state.snapshot.dataVersion = "research-runtime-targets-18-19-20-v4-90d-contract+watchdog-test";

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /preflight dataVersion must include research-runtime-targets-18-19p5-21-23-30-v6-90d-contract/,
  );
});

test("rejects a refresh response that publishes the retired target contract", async () => {
  let postRequests = 0;
  const queue = [
    response(200, snapshotPayload()),
    response(200, snapshotPayload({
      predictionTargets: RETIRED_TARGETS,
      runId: NEW_RUN_ID,
      updatedAt: "2026-07-15T04:00:01.000Z",
    })),
    response(200, snapshotPayload({
      predictionTargets: RETIRED_TARGETS,
      runId: NEW_RUN_ID,
      updatedAt: "2026-07-15T04:00:01.000Z",
    })),
  ];

  await assert.rejects(
    runBeke19Watchdog({
      env: {
        BEKE19_REFRESH_TOKEN: "secret",
        BEKE19_RETRY_DELAY_MS: "0",
      },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async (_url, options = {}) => {
        if (options.method === "POST") postRequests += 1;
        return queue.shift();
      },
    }),
    /refresh predictions targets must be exactly 18,19.5,21,23,30 in order|reconciliation predictions targets must be exactly 18,19.5,21,23,30 in order/,
  );
  assert.equal(postRequests, 1);
});

test("rejects a verification read whose analysis target keys drift from the five-target contract", async () => {
  const queue = [
    response(200, snapshotPayload()),
    response(200, successfulRefreshPayload()),
    response(200, snapshotPayload({
      runId: NEW_RUN_ID,
      updatedAt: "2026-07-15T04:00:01.000Z",
      targetViewTargets: RETIRED_TARGETS,
    })),
    response(200, snapshotPayload({
      runId: NEW_RUN_ID,
      updatedAt: "2026-07-15T04:00:01.000Z",
      targetViewTargets: RETIRED_TARGETS,
    })),
  ];

  await assert.rejects(
    runBeke19Watchdog({
      env: {
        BEKE19_REFRESH_TOKEN: "secret",
        BEKE19_RETRY_DELAY_MS: "0",
      },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => queue.shift(),
    }),
    /verification analysis\.targetViews keys must be exactly 18,19.5,21,23,30|reconciliation analysis\.targetViews keys must be exactly 18,19.5,21,23,30/,
  );
});

test("rejects retired target keys in analysis target explanations", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        targetExplanationTargets: RETIRED_TARGETS,
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight analysis\.targetExplanations keys must be exactly 18,19.5,21,23,30/,
  );
});

test("rejects reconciliation when a timed-out refresh exposes legacy history", async () => {
  let published = false;
  const fetchImpl = async (_url, options = {}) => {
    if (options.method === "GET") {
      return response(200, published
        ? snapshotPayload({
          runId: NEW_RUN_ID,
          updatedAt: "2026-07-15T04:00:01.000Z",
          history: [historyPoint(LEGACY_TARGETS)],
        })
        : snapshotPayload());
    }
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        published = true;
        reject(options.signal.reason);
      }, { once: true });
    });
  };

  await assert.rejects(
    runBeke19Watchdog({
      env: {
        BEKE19_REFRESH_TOKEN: "secret",
        BEKE19_POST_TIMEOUT_MS: "5",
        BEKE19_RETRY_DELAY_MS: "0",
      },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl,
    }),
    /reconciliation history contains unsupported probability key p17/,
  );
});

test("rejects retired p19 and p20 history keys", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        history: [historyPoint(RETIRED_TARGETS)],
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight history contains unsupported probability key p19/,
  );
});

test("rejects retired p20 even when the current history ladder is complete", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        history: [{ ...historyPoint(CURRENT_TARGETS), p20: 30 }],
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight history contains unsupported probability key p20/,
  );
});

test("requires a finite p19.5 in every history point", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        history: [historyPoint(CURRENT_TARGETS), historyPoint([18, 21])],
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight history\[1\] p19\.5 must be finite/,
  );
});

test("requires a finite p21 in every history point", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        history: [historyPoint([18, 19.5])],
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight history\[0\] p21 must be finite/,
  );
});

test("requires a finite p23 in every history point", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        history: [historyPoint([18, 19.5, 21])],
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight history\[0\] p23 must be finite/,
  );
});

test("requires a finite p30 in every history point", async () => {
  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, snapshotPayload({
        history: [historyPoint([18, 19.5, 21, 23])],
        nextUpdateAt: "2026-07-15T04:30:00.000Z",
      })),
    }),
    /preflight history\[0\] p30 must be finite/,
  );
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
  assert.equal(workflowMinutes, 15);
  const worstCaseMs = (
    DEFAULT_READ_TIMEOUT_MS * MAX_PREFLIGHT_ATTEMPTS
    + DEFAULT_READ_RETRY_DELAY_MS * (MAX_PREFLIGHT_ATTEMPTS - 1)
    + DEFAULT_POST_TIMEOUT_MS * 2
    + DEFAULT_RETRY_DELAY_MS
    + DEFAULT_READ_TIMEOUT_MS * 2
  );
  assert.ok(worstCaseMs <= workflowBudgetMs - 50_000);
});
