import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_POST_TIMEOUT_MS,
  DEFAULT_READ_RETRY_DELAY_MS,
  DEFAULT_READ_TIMEOUT_MS,
  DEFAULT_RETRY_DELAY_MS,
  MAX_PREFLIGHT_ATTEMPTS,
  addXnysCalendarDays,
  runBeke19Watchdog,
  xnysCalendarDayDifference,
  xnysIssueSessionDate,
  xnysMarketDate,
  xnysRegularCloseMinutes,
} from "./beke19-watchdog.mjs";

const NOW = Date.parse("2026-07-15T04:00:00.000Z");
const OLD_RUN_ID = "run-old";
const NEW_RUN_ID = "run-new";
const CURRENT_TARGETS = [18, 19.5, 21, 23, 30];
const RETIRED_TARGETS = [18, 19, 20];
const LEGACY_TARGETS = [17, 18, 19];
const CURRENT_MODEL_VERSION = "probability-synthesis-v5-90d-targets-18-19p5-21-23-30";
const CURRENT_RUNTIME_VERSION = "research-runtime-targets-18-19p5-21-23-30-v10-measurable-criteria";
const CURRENT_TIMING_MODEL_VERSION = "event-confluence-validation-v4";
const CURRENT_PROMPT_VERSIONS = [
  "quant-research-context-v2.3.0-measurable-criteria-90d-targets-18-19p5-21-23-30",
  "bull-research-context-v1.8.0-confluence-path-90d-targets-18-19p5-21-23-30",
  "bear-research-context-v1.8.0-confluence-path-90d-targets-18-19p5-21-23-30",
  "professional-conclusion-context-v1.19.0-measurable-criteria-90d-targets-18-19p5-21-23-30",
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
    horizonEnd: addXnysCalendarDays(issuedAt, 90),
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

const TARGET_CONFLUENCE_POLICIES = {
  18: {
    minimumSignals: 2,
    signalKinds: ["market_absorption", "property_state", "discount_rate_adr"],
    mandatoryKinds: ["market_absorption"],
  },
  19.5: {
    minimumSignals: 3,
    signalKinds: ["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"],
    mandatoryKinds: ["market_absorption", "company_fundamentals"],
  },
  21: {
    minimumSignals: 3,
    signalKinds: ["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"],
    mandatoryKinds: ["market_absorption", "company_fundamentals", "property_state"],
  },
  23: {
    minimumSignals: 4,
    signalKinds: ["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"],
    mandatoryKinds: ["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"],
  },
  30: {
    minimumSignals: 4,
    signalKinds: ["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"],
    mandatoryKinds: ["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"],
  },
};

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function milestoneContract(issuedAt, dateOverrides = {}) {
  const issueDate = dateOverrides.issueDate ?? xnysIssueSessionDate(issuedAt);
  const horizonDate = dateOverrides.horizonDate
    ?? xnysMarketDate(addXnysCalendarDays(issuedAt, 90));
  const setupId = `technical-setup-${issueDate}`;
  const macroId = `macro-release-${addDays(issueDate, 7)}`;
  const earningsId = `earnings-${addDays(issueDate, 14)}`;
  const propertyId = `property-release-${addDays(issueDate, 21)}`;
  const conditionalId = `adr-conditional-${issueDate}`;
  const confirmationId = `technical-confirmation-${addDays(issueDate, 28)}`;
  const horizonId = `forecast-horizon-${horizonDate}`;
  return {
    milestones: [
      { id: setupId, kind: "technical_checkpoint", certainty: "official_schedule", start: issueDate, end: issueDate },
      { id: conditionalId, kind: "china_adr_event", certainty: "conditional_trigger", start: addDays(issueDate, 3), end: horizonDate },
      { id: macroId, kind: "macro_release", certainty: "official_schedule", start: addDays(issueDate, 7), end: addDays(issueDate, 8) },
      { id: earningsId, kind: "earnings", certainty: "historical_estimate", start: addDays(issueDate, 14), end: addDays(issueDate, 16) },
      { id: propertyId, kind: "property_release", certainty: "official_schedule", start: addDays(issueDate, 21), end: addDays(issueDate, 21) },
      { id: confirmationId, kind: "technical_checkpoint", certainty: "official_schedule", start: addDays(issueDate, 28), end: addDays(issueDate, 28) },
      { id: horizonId, kind: "technical_checkpoint", certainty: "official_schedule", start: horizonDate, end: horizonDate },
    ],
    setupId,
    macroId,
    earningsId,
    propertyId,
    conditionalId,
    confirmationId,
    horizonId,
    issueDate,
    horizonDate,
  };
}

function pathForecast(target, probability, issuedAt, dateOverrides) {
  const contract = milestoneContract(issuedAt, dateOverrides);
  const policy = TARGET_CONFLUENCE_POLICIES[target] ?? TARGET_CONFLUENCE_POLICIES[18];
  const catalystIds = target === 18
    ? [contract.macroId, contract.propertyId]
    : target === 30
      ? [contract.macroId, contract.earningsId, contract.propertyId, contract.conditionalId]
      : [contract.macroId, contract.earningsId, contract.propertyId];
  const stages = [
    { phase: "setup", label: "价格基线", milestoneIds: [contract.setupId] },
    { phase: "catalyst", label: "事件结果", milestoneIds: catalystIds },
    { phase: "confirmation", label: "收盘确认", milestoneIds: [contract.confirmationId] },
  ];
  const basisMilestoneIds = stages.flatMap((stage) => stage.milestoneIds);
  const milestoneById = new Map(contract.milestones.map((milestone) => [milestone.id, milestone]));
  const checkpointIds = [...basisMilestoneIds, contract.horizonId]
    .sort((left, right) => milestoneById.get(left).start.localeCompare(milestoneById.get(right).start));
  return {
    schemaVersion: "milestone-path-v4",
    modelName: CURRENT_TIMING_MODEL_VERSION,
    timingBasis: "multi_event_confluence",
    target,
    terminalProbability: probability,
    status: "open",
    confluenceWindow: {
      start: contract.issueDate,
      end: milestoneById.get(contract.confirmationId).end,
      label: "多事件共振观察窗口",
      confidence: "中",
      basisMilestoneIds,
    },
    confluenceRule: {
      ...policy,
      summary: `${target} 美元确认条件：${policy.minimumSignals} 类信号达标。`,
      validationCriteria: policy.signalKinds.map((kind, index) => ({
        id: `${String(target).replace(".", "p")}-${kind}`,
        kind,
        milestoneIds: kind === "market_absorption"
          ? [contract.setupId, contract.confirmationId]
          : kind === "company_fundamentals"
            ? [contract.earningsId]
            : kind === "property_state"
              ? [contract.propertyId]
              : [contract.macroId],
        statement: `判定线 ${index + 1} ≥ ${index + 1}`,
      })),
      peakRiskRule: {
        activation: "after_first_touch",
        windowSessions: 5,
        minimumSignals: 2,
        criteria: [
          { id: `${target}-risk-1`, statement: "触达后成交量 ≥ 20 日均量 1.5 倍，且收盘位置 ≤ 当日振幅 25% 分位" },
          { id: `${target}-risk-2`, statement: "触达后 5 日相对 KWEB 收益 ≤ -3 个百分点" },
          { id: `${target}-risk-3`, statement: "连续 2 日收盘 ≤ 目标价" },
        ],
      },
      exhaustionSignals: [
        "触达后成交量 ≥ 20 日均量 1.5 倍，且收盘位置 ≤ 当日振幅 25% 分位",
        "触达后 5 日相对 KWEB 收益 ≤ -3 个百分点",
        "连续 2 日收盘 ≤ 目标价",
      ],
    },
    stages,
    checkpoints: checkpointIds.map((milestoneId) => ({
      milestoneId,
      start: milestoneById.get(milestoneId).start,
      end: milestoneById.get(milestoneId).end,
    })),
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
  milestoneDateOverrides,
} = {}) {
  const milestoneState = milestoneContract(updatedAt, milestoneDateOverrides);
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
        milestones: milestoneState.milestones,
        predictions: predictionTargets.map((target, index) => ({
          target,
          probability: 60 - index * 12,
          forecastQuestion: forecastQuestion(target, updatedAt),
          pathForecast: pathForecast(
            target,
            60 - index * 12,
            updatedAt,
            milestoneDateOverrides,
          ),
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

test("uses the completed XNYS issue session and New York horizon date across UTC midnight", async () => {
  const issuedAt = "2026-07-25T00:30:00.000Z";
  const payload = snapshotPayload({
    updatedAt: issuedAt,
    nextUpdateAt: "2026-07-25T01:30:00.000Z",
    milestoneDateOverrides: {
      issueDate: "2026-07-24",
      horizonDate: "2026-10-22",
    },
  });
  const prediction = payload.state.snapshot.predictions[0];
  const milestoneById = new Map(
    payload.state.snapshot.milestones.map((milestone) => [milestone.id, milestone]),
  );
  const setupId = prediction.pathForecast.stages[0].milestoneIds[0];
  const setup = milestoneById.get(setupId);
  const finalCheckpoint = prediction.pathForecast.checkpoints.at(-1);
  const basisIds = prediction.pathForecast.confluenceWindow.basisMilestoneIds;
  const stageIds = prediction.pathForecast.stages.flatMap((stage) => stage.milestoneIds);

  assert.deepEqual(
    { start: setup.start, end: setup.end },
    { start: "2026-07-24", end: "2026-07-24" },
  );
  assert.deepEqual(finalCheckpoint, {
    milestoneId: "forecast-horizon-2026-10-22",
    start: "2026-10-22",
    end: "2026-10-22",
  });
  assert.equal(new Set(basisIds).size, basisIds.length);
  assert.equal(new Set(stageIds).size, stageIds.length);
  assert.deepEqual([...basisIds].sort(), [...stageIds].sort());

  const result = await runBeke19Watchdog({
    env: { BEKE19_REFRESH_TOKEN: "secret" },
    now: () => Date.parse("2026-07-25T00:31:00.000Z"),
    logger: createLogger(),
    fetchImpl: async () => response(200, payload),
  });

  assert.equal(result.status, "not-due");
});

test("resolves issue timestamps against the latest completed regular XNYS session", () => {
  assert.equal(xnysIssueSessionDate("2026-07-24T19:59:00.000Z"), "2026-07-23");
  assert.equal(xnysIssueSessionDate("2026-07-24T20:00:00.000Z"), "2026-07-24");
  assert.equal(xnysIssueSessionDate("2026-07-25T00:30:00.000Z"), "2026-07-24");
  assert.equal(xnysIssueSessionDate("2026-07-25T16:00:00.000Z"), "2026-07-24");
  assert.equal(xnysIssueSessionDate("2026-07-03T21:00:00.000Z"), "2026-07-02");
  assert.equal(xnysMarketDate("2026-10-23T00:30:00.000Z"), "2026-10-22");
});

for (const dstCase of [
  {
    label: "spring DST transition",
    issuedAt: "2026-01-15T05:30:00.000Z",
    expectedHorizonEnd: "2026-04-15T04:30:00.000Z",
    expectedElapsed: 90 * 86_400_000 - 3_600_000,
  },
  {
    label: "autumn DST transition",
    issuedAt: "2026-09-01T04:30:00.000Z",
    expectedHorizonEnd: "2026-11-30T05:30:00.000Z",
    expectedElapsed: 90 * 86_400_000 + 3_600_000,
  },
]) {
  test(`accepts a 90 New York calendar-day forecast across the ${dstCase.label}`, async () => {
    const horizonEnd = addXnysCalendarDays(dstCase.issuedAt, 90);
    assert.equal(horizonEnd, dstCase.expectedHorizonEnd);
    assert.equal(xnysCalendarDayDifference(dstCase.issuedAt, horizonEnd), 90);
    assert.equal(Date.parse(horizonEnd) - Date.parse(dstCase.issuedAt), dstCase.expectedElapsed);

    const payload = snapshotPayload({
      updatedAt: dstCase.issuedAt,
      nextUpdateAt: new Date(Date.parse(dstCase.issuedAt) + 3_600_000).toISOString(),
    });
    const result = await runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => Date.parse(dstCase.issuedAt) + 60_000,
      logger: createLogger(),
      fetchImpl: async () => response(200, payload),
    });

    assert.equal(result.status, "not-due");
  });
}

for (const disambiguationCase of [
  {
    label: "spring DST gap",
    issuedAt: "2026-12-14T07:30:00.000Z",
    expectedHorizonEnd: "2027-03-14T07:30:00.000Z",
  },
  {
    label: "autumn DST overlap",
    issuedAt: "2026-08-03T05:30:00.000Z",
    expectedHorizonEnd: "2026-11-01T05:30:00.000Z",
  },
]) {
  test(`uses compatible disambiguation for the ${disambiguationCase.label}`, async () => {
    const horizonEnd = addXnysCalendarDays(disambiguationCase.issuedAt, 90);
    assert.equal(horizonEnd, disambiguationCase.expectedHorizonEnd);
    assert.equal(xnysCalendarDayDifference(disambiguationCase.issuedAt, horizonEnd), 90);

    const payload = snapshotPayload({
      updatedAt: disambiguationCase.issuedAt,
      nextUpdateAt: new Date(Date.parse(disambiguationCase.issuedAt) + 3_600_000).toISOString(),
    });
    const result = await runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => Date.parse(disambiguationCase.issuedAt) + 60_000,
      logger: createLogger(),
      fetchImpl: async () => response(200, payload),
    });

    assert.equal(result.status, "not-due");
  });
}

test("rejects a fixed 90-times-24-hour horizon when New York crosses DST", async () => {
  const issuedAt = "2026-09-01T04:30:00.000Z";
  const payload = snapshotPayload({
    updatedAt: issuedAt,
    nextUpdateAt: "2026-09-01T05:30:00.000Z",
  });
  payload.state.snapshot.predictions[0].forecastQuestion.horizonEnd = new Date(
    Date.parse(issuedAt) + 90 * 86_400_000,
  ).toISOString();

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => Date.parse(issuedAt) + 60_000,
      logger: createLogger(),
      fetchImpl: async () => response(200, payload),
    }),
    /current 90-day first-touch contract/,
  );
});

test("uses minute-precise 13:00 XNYS closes on the three recurring early-close sessions", () => {
  assert.equal(xnysRegularCloseMinutes("2026-11-27"), 13 * 60);
  assert.equal(xnysIssueSessionDate("2026-11-27T17:59:59.000Z"), "2026-11-25");
  assert.equal(xnysIssueSessionDate("2026-11-27T18:00:00.000Z"), "2026-11-27");

  assert.equal(xnysRegularCloseMinutes("2025-07-03"), 13 * 60);
  assert.equal(xnysIssueSessionDate("2025-07-03T16:59:59.000Z"), "2025-07-02");
  assert.equal(xnysIssueSessionDate("2025-07-03T17:00:00.000Z"), "2025-07-03");

  assert.equal(xnysRegularCloseMinutes("2026-12-24"), 13 * 60);
  assert.equal(xnysIssueSessionDate("2026-12-24T17:59:59.000Z"), "2026-12-23");
  assert.equal(xnysIssueSessionDate("2026-12-24T18:00:00.000Z"), "2026-12-24");

  assert.equal(xnysRegularCloseMinutes("2026-07-03"), null);
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
    /preflight dataVersion must include research-runtime-targets-18-19p5-21-23-30-v10-measurable-criteria/,
  );
});

test("rejects a publication without the current milestone timing contract", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  payload.state.snapshot.predictions[0].pathForecast.modelName = "calendar-window-v1";

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /preflight predictions\[0\] pathForecast must use the current milestone timing contract/,
  );
});

test("rejects a target marked resolved at issue below 100 percent", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  prediction.probability = 80;
  prediction.forecastQuestion.status = "resolved_at_issue";
  prediction.pathForecast.status = "resolved_at_issue";
  prediction.pathForecast.terminalProbability = 80;
  delete prediction.pathForecast.confluenceWindow;
  delete prediction.pathForecast.confluenceRule;
  prediction.pathForecast.stages = [];
  prediction.pathForecast.checkpoints = [];

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /preflight predictions\[0\] resolved probability must be 100/,
  );
});

test("accepts a resolved-at-issue path only when probability is 100 and no future fields remain", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  prediction.probability = 100;
  prediction.forecastQuestion.status = "resolved_at_issue";
  prediction.pathForecast.status = "resolved_at_issue";
  prediction.pathForecast.terminalProbability = 100;
  delete prediction.pathForecast.confluenceWindow;
  delete prediction.pathForecast.confluenceRule;
  prediction.pathForecast.stages = [];
  prediction.pathForecast.checkpoints = [];

  const result = await runBeke19Watchdog({
    env: { BEKE19_REFRESH_TOKEN: "secret" },
    now: () => NOW,
    logger: createLogger(),
    fetchImpl: async () => response(200, payload),
  });

  assert.equal(result.status, "not-due");
});

for (const corruptPathCase of [
  {
    name: "rejects a target path whose minimum signal threshold is weakened",
    corrupt(path) { path.confluenceRule.minimumSignals -= 1; },
    expected: /confluence rule must exactly match the target policy/,
  },
  {
    name: "rejects a target path whose mandatory signal set drifts",
    corrupt(path) { path.confluenceRule.mandatoryKinds = ["market_absorption"]; },
    expected: /confluence rule must exactly match the target policy/,
    predictionIndex: 3,
  },
  {
    name: "rejects a target path whose declared signal set drifts",
    corrupt(path) { path.confluenceRule.signalKinds = ["market_absorption", "property_state"]; },
    expected: /confluence rule must exactly match the target policy/,
  },
  {
    name: "rejects a target path without a high-point exhaustion signal",
    corrupt(path) { path.confluenceRule.exhaustionSignals = []; },
    expected: /must publish 1-3 distinct exhaustion signals/,
  },
  {
    name: "rejects a target path with more than three exhaustion signals",
    corrupt(path) { path.confluenceRule.exhaustionSignals.push("额外的未版本化信号"); },
    expected: /must publish 1-3 distinct exhaustion signals/,
  },
  {
    name: "rejects confluence stages outside setup catalyst confirmation order",
    corrupt(path) { [path.stages[0], path.stages[1]] = [path.stages[1], path.stages[0]]; },
    expected: /must publish setup, catalyst, confirmation stages in order/,
  },
  {
    name: "rejects a path with fewer than two scheduled catalysts",
    corrupt(path) {
      const removedIds = path.stages[1].milestoneIds.slice(1);
      path.stages[1].milestoneIds = [path.stages[1].milestoneIds[0]];
      path.confluenceWindow.basisMilestoneIds = path.confluenceWindow.basisMilestoneIds
        .filter((milestoneId) => !removedIds.includes(milestoneId));
      path.confluenceRule.validationCriteria.forEach((criterion) => {
        criterion.milestoneIds = criterion.milestoneIds
          .filter((milestoneId) => !removedIds.includes(milestoneId));
        if (criterion.milestoneIds.length === 0) {
          criterion.milestoneIds = [path.stages[1].milestoneIds[0]];
        }
      });
      path.checkpoints = path.checkpoints
        .filter((checkpoint) => !removedIds.includes(checkpoint.milestoneId));
    },
    expected: /must include at least two scheduled catalysts/,
  },
  {
    name: "rejects a path containing an unknown stage reference",
    corrupt(path) { path.stages[1].milestoneIds[0] = "missing-catalyst"; },
    expected: /references unknown stage milestone missing-catalyst/,
  },
  {
    name: "rejects a path whose checkpoint no longer preserves milestone dates",
    corrupt(path) { path.checkpoints[0].start = "2026-01-01"; },
    expected: /checkpoint must preserve milestone dates/,
  },
  {
    name: "rejects an open path without the terminal horizon checkpoint",
    corrupt(path) { path.checkpoints.pop(); },
    expected: /must end at the 90-day horizon/,
  },
]) {
  test(corruptPathCase.name, async () => {
    const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
    const predictionIndex = corruptPathCase.predictionIndex ?? 0;
    corruptPathCase.corrupt(payload.state.snapshot.predictions[predictionIndex].pathForecast);

    await assert.rejects(
      runBeke19Watchdog({
        env: { BEKE19_REFRESH_TOKEN: "secret" },
        now: () => NOW,
        logger: createLogger(),
        sleep: async () => {},
        fetchImpl: async () => response(200, payload),
      }),
      corruptPathCase.expected,
    );
  });
}

test("rejects a setup stage that does not finish before the first fixed catalyst", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  const milestoneById = new Map(
    payload.state.snapshot.milestones.map((milestone) => [milestone.id, milestone]),
  );
  const setupId = prediction.pathForecast.stages[0].milestoneIds[0];
  const firstFixedCatalyst = prediction.pathForecast.stages[1].milestoneIds
    .map((milestoneId) => milestoneById.get(milestoneId))
    .filter((milestone) => milestone.certainty === "official_schedule")
    .sort((left, right) => left.start.localeCompare(right.start))[0];
  const setupMilestone = milestoneById.get(setupId);
  const setupCheckpoint = prediction.pathForecast.checkpoints
    .find((checkpoint) => checkpoint.milestoneId === setupId);
  const afterFirstFixedCatalyst = addDays(firstFixedCatalyst.start, 1);
  setupMilestone.end = afterFirstFixedCatalyst;
  setupCheckpoint.end = afterFirstFixedCatalyst;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /setup must precede fixed catalysts/,
  );
});

test("rejects a confirmation stage that does not start after every scheduled catalyst", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[1];
  const milestoneById = new Map(
    payload.state.snapshot.milestones.map((milestone) => [milestone.id, milestone]),
  );
  const confirmationId = prediction.pathForecast.stages[2].milestoneIds[0];
  const lastScheduledCatalyst = prediction.pathForecast.stages[1].milestoneIds
    .map((milestoneId) => milestoneById.get(milestoneId))
    .filter((milestone) => milestone.certainty !== "conditional_trigger")
    .sort((left, right) => right.end.localeCompare(left.end))[0];
  const confirmationMilestone = milestoneById.get(confirmationId);
  const confirmationCheckpoint = prediction.pathForecast.checkpoints
    .find((checkpoint) => checkpoint.milestoneId === confirmationId);
  const beforeLastScheduledCatalyst = addDays(lastScheduledCatalyst.end, -1);
  confirmationMilestone.start = beforeLastScheduledCatalyst;
  confirmationMilestone.end = beforeLastScheduledCatalyst;
  confirmationCheckpoint.start = beforeLastScheduledCatalyst;
  confirmationCheckpoint.end = beforeLastScheduledCatalyst;
  prediction.pathForecast.confluenceWindow.end = beforeLastScheduledCatalyst;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /confirmation must follow every scheduled catalyst/,
  );
});

test("rejects a checkpoint milestone before the forecast issue date", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  const setupId = prediction.pathForecast.stages[0].milestoneIds[0];
  const setupMilestone = payload.state.snapshot.milestones
    .find((milestone) => milestone.id === setupId);
  const setupCheckpoint = prediction.pathForecast.checkpoints
    .find((checkpoint) => checkpoint.milestoneId === setupId);
  const beforeIssue = addDays(xnysIssueSessionDate(prediction.forecastQuestion.issuedAt), -1);
  setupMilestone.start = beforeIssue;
  setupMilestone.end = beforeIssue;
  setupCheckpoint.start = beforeIssue;
  setupCheckpoint.end = beforeIssue;
  prediction.pathForecast.confluenceWindow.start = beforeIssue;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /checkpoint must remain within the audited forecast horizon/,
  );
});

test("rejects a checkpoint milestone after the forecast horizon", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[4];
  const conditionalId = prediction.pathForecast.stages[1].milestoneIds
    .find((milestoneId) => payload.state.snapshot.milestones.some(
      (milestone) => milestone.id === milestoneId && milestone.certainty === "conditional_trigger",
    ));
  const conditionalMilestone = payload.state.snapshot.milestones
    .find((milestone) => milestone.id === conditionalId);
  const conditionalCheckpoint = prediction.pathForecast.checkpoints
    .find((checkpoint) => checkpoint.milestoneId === conditionalId);
  const afterHorizon = addDays(prediction.forecastQuestion.horizonEnd.slice(0, 10), 1);
  conditionalMilestone.end = afterHorizon;
  conditionalCheckpoint.end = afterHorizon;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /checkpoint must remain within the audited forecast horizon/,
  );
});

test("rejects a final checkpoint whose horizon milestone id is not exact", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  const finalCheckpoint = prediction.pathForecast.checkpoints.at(-1);
  const horizonMilestone = payload.state.snapshot.milestones
    .find((milestone) => milestone.id === finalCheckpoint.milestoneId);
  const wrongHorizonId = `forecast-horizon-${addDays(
    prediction.forecastQuestion.horizonEnd.slice(0, 10),
    -1,
  )}`;
  horizonMilestone.id = wrongHorizonId;
  finalCheckpoint.milestoneId = wrongHorizonId;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /final checkpoint must exactly match the audited horizon/,
  );
});

test("rejects a final checkpoint whose dates do not exactly equal the forecast horizon", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  const finalCheckpoint = prediction.pathForecast.checkpoints.at(-1);
  const horizonMilestone = payload.state.snapshot.milestones
    .find((milestone) => milestone.id === finalCheckpoint.milestoneId);
  const wrongHorizonDate = addDays(prediction.forecastQuestion.horizonEnd.slice(0, 10), -1);
  horizonMilestone.start = wrongHorizonDate;
  horizonMilestone.end = wrongHorizonDate;
  finalCheckpoint.start = wrongHorizonDate;
  finalCheckpoint.end = wrongHorizonDate;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /final checkpoint must exactly match the audited horizon/,
  );
});

test("rejects a resolved path that retains future confluence fields", async () => {
  const payload = snapshotPayload({ nextUpdateAt: "2026-07-15T04:30:00.000Z" });
  const prediction = payload.state.snapshot.predictions[0];
  prediction.probability = 100;
  prediction.forecastQuestion.status = "resolved_at_issue";
  prediction.pathForecast.status = "resolved_at_issue";
  prediction.pathForecast.terminalProbability = 100;

  await assert.rejects(
    runBeke19Watchdog({
      env: { BEKE19_REFRESH_TOKEN: "secret" },
      now: () => NOW,
      logger: createLogger(),
      sleep: async () => {},
      fetchImpl: async () => response(200, payload),
    }),
    /resolved path must not reference future confluence fields/,
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
