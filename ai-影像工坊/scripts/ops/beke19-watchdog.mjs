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
const EXPECTED_RUNTIME_VERSION = "research-runtime-targets-18-19p5-21-23-30-v10-measurable-criteria";
const EXPECTED_TIMING_MODEL_VERSION = "event-confluence-validation-v4";
const EXPECTED_ANALYSIS_PROVIDER = "TokenPlanProvider";
const EXPECTED_ANALYSIS_MODEL_ID = "mimo-v2.5-pro";
const EXPECTED_PROMPT_VERSIONS = Object.freeze([
  "quant-research-context-v2.3.0-measurable-criteria-90d-targets-18-19p5-21-23-30",
  "bull-research-context-v1.8.0-confluence-path-90d-targets-18-19p5-21-23-30",
  "bear-research-context-v1.8.0-confluence-path-90d-targets-18-19p5-21-23-30",
  "professional-conclusion-context-v1.19.0-measurable-criteria-90d-targets-18-19p5-21-23-30",
]);
const CONFLUENCE_PHASES = Object.freeze(["setup", "catalyst", "confirmation"]);
const CONFLUENCE_SIGNAL_KINDS = new Set([
  "company_fundamentals",
  "property_state",
  "discount_rate_adr",
  "market_absorption",
]);
const TARGET_CONFLUENCE_POLICIES = Object.freeze({
  18: Object.freeze({
    minimumSignals: 2,
    signalKinds: Object.freeze(["market_absorption", "property_state", "discount_rate_adr"]),
    mandatoryKinds: Object.freeze(["market_absorption"]),
  }),
  19.5: Object.freeze({
    minimumSignals: 3,
    signalKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"]),
    mandatoryKinds: Object.freeze(["market_absorption", "company_fundamentals"]),
  }),
  21: Object.freeze({
    minimumSignals: 3,
    signalKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"]),
    mandatoryKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state"]),
  }),
  23: Object.freeze({
    minimumSignals: 4,
    signalKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"]),
    mandatoryKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"]),
  }),
  30: Object.freeze({
    minimumSignals: 4,
    signalKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"]),
    mandatoryKinds: Object.freeze(["market_absorption", "company_fundamentals", "property_state", "discount_rate_adr"]),
  }),
});
const REQUIRED_ANALYSIS_STAGES = Object.freeze([
  "quant",
  "bull",
  "bear",
  "professional_editor",
  "deterministic_critic",
]);
const EXPECTED_HORIZON_DAYS = 90;
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const XNYS_TIMEZONE = "America/New_York";
const XNYS_REGULAR_CLOSE_MINUTES = 16 * 60;
const XNYS_EARLY_CLOSE_MINUTES = 13 * 60;
const XNYS_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: XNYS_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
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

function requireDateOnly(value, label) {
  const date = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid ISO calendar date`);
  }
  return date;
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

function equalDistinctValues(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return actualSet.size === actual.length
    && expectedSet.size === expected.length
    && actualSet.size === expectedSet.size
    && [...actualSet].every((value) => expectedSet.has(value))
    && [...expectedSet].every((value) => actualSet.has(value));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day, 12));
}

function addCalendarDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function observedFixedHoliday(year, month, day) {
  const holiday = utcDate(year, month, day);
  const weekday = holiday.getUTCDay();
  if (weekday === 6) return isoDate(addCalendarDays(holiday, -1));
  if (weekday === 0) return isoDate(addCalendarDays(holiday, 1));
  return isoDate(holiday);
}

function nthWeekday(year, month, weekday, occurrence) {
  const first = utcDate(year, month, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return isoDate(addCalendarDays(first, offset + (occurrence - 1) * 7));
}

function lastWeekday(year, month, weekday) {
  const last = utcDate(year, month + 1, 0);
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return isoDate(addCalendarDays(last, -offset));
}

function goodFriday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const value = h + l - 7 * m + 114;
  const month = Math.floor(value / 31) - 1;
  const day = (value % 31) + 1;
  return isoDate(addCalendarDays(utcDate(year, month, day), -2));
}

function xnysHolidaysForYear(year) {
  return new Set([
    observedFixedHoliday(year, 0, 1),
    nthWeekday(year, 0, 1, 3),
    nthWeekday(year, 1, 1, 3),
    goodFriday(year),
    lastWeekday(year, 4, 1),
    observedFixedHoliday(year, 5, 19),
    observedFixedHoliday(year, 6, 4),
    nthWeekday(year, 8, 1, 1),
    nthWeekday(year, 10, 4, 4),
    observedFixedHoliday(year, 11, 25),
  ]);
}

function xnysLocalParts(value) {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid XNYS market timestamp: ${value}`);
  }
  const parts = XNYS_DATE_TIME_FORMATTER.formatToParts(instant);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = Number(part("hour"));
  const minute = Number(part("minute"));
  const second = Number(part("second"));
  if (!year || !month || !day
    || !Number.isFinite(hour)
    || !Number.isFinite(minute)
    || !Number.isFinite(second)) {
    throw new Error(`Unable to resolve XNYS market date: ${value}`);
  }
  return {
    date: `${year}-${month}-${day}`,
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour,
    minute,
    second,
  };
}

function xnysWallClockToInstant(parts) {
  const desiredWallClock = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  const offsets = new Set();

  // Intl exposes instant -> zone, not the inverse. Sampling around the target
  // discovers both offsets adjacent to a DST transition.
  for (const probeHours of [-36, 0, 36]) {
    const probe = desiredWallClock + probeHours * HOUR_MS;
    const actual = xnysLocalParts(new Date(probe).toISOString());
    const actualWallClock = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      new Date(probe).getUTCMilliseconds(),
    );
    offsets.add(actualWallClock - probe);
  }

  const mappings = [...offsets].map((offset) => {
    const candidate = desiredWallClock - offset;
    const actual = xnysLocalParts(new Date(candidate).toISOString());
    return {
      candidate,
      actualWallClock: Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
        actual.second,
        new Date(candidate).getUTCMilliseconds(),
      ),
    };
  });

  // Temporal-compatible overlap handling: choose the earlier instant.
  const exact = mappings
    .filter((mapping) => mapping.actualWallClock === desiredWallClock)
    .sort((left, right) => left.candidate - right.candidate);
  if (exact[0]) return new Date(exact[0].candidate);

  // Temporal-compatible gap handling: move forward by the DST gap while
  // preserving minute/second, e.g. New York 02:30 -> 03:30.
  const shiftedForward = mappings
    .filter((mapping) => mapping.actualWallClock > desiredWallClock)
    .sort((left, right) =>
      (left.actualWallClock - desiredWallClock)
      - (right.actualWallClock - desiredWallClock)
      || left.candidate - right.candidate);
  if (shiftedForward[0]
    && shiftedForward[0].actualWallClock - desiredWallClock <= 2 * HOUR_MS) {
    return new Date(shiftedForward[0].candidate);
  }

  throw new Error("Unable to map the requested New York wall-clock time to an instant.");
}

/** Adds New York calendar days while preserving the local wall-clock time. */
export function addXnysCalendarDays(value, days) {
  if (!Number.isInteger(days)) {
    throw new RangeError(`XNYS calendar-day offset must be an integer: ${days}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return isoDate(addCalendarDays(new Date(`${value}T12:00:00Z`), days));
  }

  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid XNYS market timestamp: ${value}`);
  }
  const local = xnysLocalParts(value);
  const shifted = new Date(Date.UTC(
    local.year,
    local.month - 1,
    local.day + days,
    local.hour,
    local.minute,
    local.second,
    instant.getUTCMilliseconds(),
  ));
  return xnysWallClockToInstant({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }).toISOString();
}

/** Counts New York calendar-date boundaries independently of elapsed hours. */
export function xnysCalendarDayDifference(start, end) {
  const startDate = xnysMarketDate(start);
  const endDate = xnysMarketDate(end);
  const startSerial = Date.parse(`${startDate}T00:00:00Z`);
  const endSerial = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startSerial) || !Number.isFinite(endSerial)) {
    throw new Error(`Invalid XNYS calendar-day range: ${start}..${end}`);
  }
  return (endSerial - startSerial) / DAY_MS;
}

export function xnysMarketDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return xnysLocalParts(value).date;
}

export function isXnysSession(dateOnly) {
  const date = new Date(`${dateOnly}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const weekday = date.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const year = date.getUTCFullYear();
  const holidays = new Set([
    ...xnysHolidaysForYear(year - 1),
    ...xnysHolidaysForYear(year),
    ...xnysHolidaysForYear(year + 1),
  ]);
  return !holidays.has(dateOnly);
}

/** Returns the scheduled close as New York minutes after midnight. */
export function xnysRegularCloseMinutes(dateOnly) {
  if (!isXnysSession(dateOnly)) return null;
  const year = Number(dateOnly.slice(0, 4));
  const dayAfterThanksgiving = isoDate(addCalendarDays(
    new Date(`${nthWeekday(year, 10, 4, 4)}T12:00:00Z`),
    1,
  ));
  if (dateOnly === dayAfterThanksgiving
    || dateOnly === `${year}-07-03`
    || dateOnly === `${year}-12-24`) {
    return XNYS_EARLY_CLOSE_MINUTES;
  }
  return XNYS_REGULAR_CLOSE_MINUTES;
}

export function previousOrSameXnysSession(dateOnly) {
  let date = new Date(`${dateOnly}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid XNYS calendar date: ${dateOnly}`);
  }
  for (let offset = 0; offset < 10; offset += 1) {
    const candidate = isoDate(date);
    if (isXnysSession(candidate)) return candidate;
    date = addCalendarDays(date, -1);
  }
  throw new Error(`No XNYS session found on or before ${dateOnly}.`);
}

export function xnysIssueSessionDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return previousOrSameXnysSession(value);
  }
  const local = xnysLocalParts(value);
  const closeMinutes = xnysRegularCloseMinutes(local.date);
  const localMinutes = local.hour * 60 + local.minute;
  if (closeMinutes !== null && localMinutes >= closeMinutes) {
    return local.date;
  }
  const previousDay = isoDate(addCalendarDays(new Date(`${local.date}T12:00:00Z`), -1));
  return previousOrSameXnysSession(previousDay);
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
  const milestones = requireArray(snapshot.milestones, `${label} milestones`);
  const milestonesById = new Map();
  for (const [index, rawMilestone] of milestones.entries()) {
    const milestone = requireObject(rawMilestone, `${label} milestones[${index}]`);
    const id = requireString(milestone.id, `${label} milestones[${index}].id`);
    requireString(milestone.kind, `${label} milestones[${index}].kind`);
    requireString(milestone.certainty, `${label} milestones[${index}].certainty`);
    const start = requireDateOnly(milestone.start, `${label} milestones[${index}].start`);
    const end = requireDateOnly(milestone.end, `${label} milestones[${index}].end`);
    if (start > end) throw new Error(`${label} milestones[${index}] ends before it starts`);
    if (milestonesById.has(id)) throw new Error(`${label} milestone id ${id} must be unique`);
    milestonesById.set(id, milestone);
  }
  const predictions = requireArray(snapshot.predictions, `${label} predictions`);
  const declaredPredictionTargets = predictions.map((prediction, index) =>
    requireObject(prediction, `${label} predictions[${index}]`).target
  );
  if (!equalOrderedValues(declaredPredictionTargets, EXPECTED_TARGETS)) {
    throw new Error(`${label} predictions targets must be exactly ${EXPECTED_TARGETS.join(",")} in order`);
  }
  const issuedAtValues = new Set();
  const horizonEndValues = new Set();
  const predictionTargets = predictions.map((prediction, index) => {
    const record = requireObject(prediction, `${label} predictions[${index}]`);
    const probability = record.probability;
    const question = requireObject(record.forecastQuestion, `${label} predictions[${index}].forecastQuestion`);
    const issuedAtTimestamp = requireTimestamp(question.issuedAt, `${label} predictions[${index}] issuedAt`);
    const horizonEndTimestamp = requireTimestamp(question.horizonEnd, `${label} predictions[${index}] horizonEnd`);
    const issuedAt = Date.parse(issuedAtTimestamp);
    const horizonEnd = Date.parse(horizonEndTimestamp);
    const forecastIssuedDate = xnysIssueSessionDate(issuedAtTimestamp);
    const forecastHorizonDate = xnysMarketDate(horizonEndTimestamp);
    let expectedHorizonEnd;
    let localCalendarDays;
    try {
      expectedHorizonEnd = Date.parse(addXnysCalendarDays(
        issuedAtTimestamp,
        EXPECTED_HORIZON_DAYS,
      ));
      localCalendarDays = xnysCalendarDayDifference(
        issuedAtTimestamp,
        horizonEndTimestamp,
      );
    } catch {
      throw new Error(`${label} predictions[${index}] must use the current 90-day first-touch contract`);
    }
    if (!Number.isFinite(probability)) {
      throw new Error(`${label} predictions[${index}] probability must be within the publish range`);
    }
    if (question.status === "resolved_at_issue") {
      if (probability !== 100) {
        throw new Error(`${label} predictions[${index}] resolved probability must be 100`);
      }
    } else if (question.status !== "open" || probability < 5 || probability > 95) {
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
      || localCalendarDays !== EXPECTED_HORIZON_DAYS
      || horizonEnd !== expectedHorizonEnd
    ) {
      throw new Error(`${label} predictions[${index}] must use the current 90-day first-touch contract`);
    }

    const path = requireObject(record.pathForecast, `${label} predictions[${index}].pathForecast`);
    if (
      path.schemaVersion !== "milestone-path-v4"
      || path.modelName !== EXPECTED_TIMING_MODEL_VERSION
      || path.timingBasis !== "multi_event_confluence"
      || path.target !== record.target
    ) {
      throw new Error(`${label} predictions[${index}] pathForecast must use the current milestone timing contract`);
    }
    if (path.terminalProbability !== probability) {
      throw new Error(`${label} predictions[${index}] pathForecast must mirror the terminal probability`);
    }
    if (path.status !== question.status) {
      throw new Error(`${label} predictions[${index}] pathForecast status must match the forecast question`);
    }
    const stages = requireArray(path.stages, `${label} predictions[${index}].pathForecast.stages`);
    const checkpoints = path.checkpoints === undefined
      ? []
      : requireArray(
        path.checkpoints,
        `${label} predictions[${index}].pathForecast.checkpoints`,
      );
    if (path.status === "resolved_at_issue") {
      if (
        path.terminalProbability !== 100
        || path.confluenceWindow !== undefined
        || path.confluenceRule !== undefined
        || stages.length > 0
        || checkpoints.length > 0
      ) {
        throw new Error(`${label} predictions[${index}] resolved path must not reference future confluence fields`);
      }
    } else {
      const window = requireObject(
        path.confluenceWindow,
        `${label} predictions[${index}].pathForecast.confluenceWindow`,
      );
      const rule = requireObject(
        path.confluenceRule,
        `${label} predictions[${index}].pathForecast.confluenceRule`,
      );
      const basisMilestoneIds = requireArray(
        window.basisMilestoneIds,
        `${label} predictions[${index}].pathForecast.confluenceWindow.basisMilestoneIds`,
      ).map((milestoneId, basisIndex) => requireString(
        milestoneId,
        `${label} predictions[${index}].pathForecast.confluenceWindow.basisMilestoneIds[${basisIndex}]`,
      ));
      const signalKinds = requireArray(
        rule.signalKinds,
        `${label} predictions[${index}].pathForecast.confluenceRule.signalKinds`,
      ).map((signal, signalIndex) => requireString(
        signal,
        `${label} predictions[${index}].pathForecast.confluenceRule.signalKinds[${signalIndex}]`,
      ));
      const mandatoryKinds = requireArray(
        rule.mandatoryKinds,
        `${label} predictions[${index}].pathForecast.confluenceRule.mandatoryKinds`,
      ).map((signal, signalIndex) => requireString(
        signal,
        `${label} predictions[${index}].pathForecast.confluenceRule.mandatoryKinds[${signalIndex}]`,
      ));
      const exhaustionSignals = requireArray(
        rule.exhaustionSignals,
        `${label} predictions[${index}].pathForecast.confluenceRule.exhaustionSignals`,
      ).map((signal, signalIndex) => requireString(
        signal,
        `${label} predictions[${index}].pathForecast.confluenceRule.exhaustionSignals[${signalIndex}]`,
      ));
      const validationCriteria = requireArray(
        rule.validationCriteria,
        `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria`,
      ).map((rawCriterion, criterionIndex) => {
        const criterion = requireObject(
          rawCriterion,
          `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria[${criterionIndex}]`,
        );
        const milestoneIds = requireArray(
          criterion.milestoneIds,
          `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria[${criterionIndex}].milestoneIds`,
        ).map((milestoneId, milestoneIndex) => requireString(
          milestoneId,
          `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria[${criterionIndex}].milestoneIds[${milestoneIndex}]`,
        ));
        const statement = requireString(
          criterion.statement,
          `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria[${criterionIndex}].statement`,
        );
        return {
          id: requireString(criterion.id, `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria[${criterionIndex}].id`),
          kind: requireString(criterion.kind, `${label} predictions[${index}].pathForecast.confluenceRule.validationCriteria[${criterionIndex}].kind`),
          milestoneIds,
          statement,
        };
      });
      const peakRiskRule = requireObject(
        rule.peakRiskRule,
        `${label} predictions[${index}].pathForecast.confluenceRule.peakRiskRule`,
      );
      const peakCriteria = requireArray(
        peakRiskRule.criteria,
        `${label} predictions[${index}].pathForecast.confluenceRule.peakRiskRule.criteria`,
      ).map((rawCriterion, criterionIndex) => {
        const criterion = requireObject(
          rawCriterion,
          `${label} predictions[${index}].pathForecast.confluenceRule.peakRiskRule.criteria[${criterionIndex}]`,
        );
        return {
          id: requireString(criterion.id, `${label} predictions[${index}].pathForecast.confluenceRule.peakRiskRule.criteria[${criterionIndex}].id`),
          statement: requireString(criterion.statement, `${label} predictions[${index}].pathForecast.confluenceRule.peakRiskRule.criteria[${criterionIndex}].statement`),
        };
      });

      const policy = TARGET_CONFLUENCE_POLICIES[record.target];
      if (
        !policy
        || rule.minimumSignals !== policy.minimumSignals
        || !equalDistinctValues(signalKinds, policy.signalKinds)
        || !equalDistinctValues(mandatoryKinds, policy.mandatoryKinds)
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast confluence rule must exactly match the target policy`);
      }
      if (signalKinds.some((signal) => !CONFLUENCE_SIGNAL_KINDS.has(signal))) {
        throw new Error(`${label} predictions[${index}] pathForecast contains an unknown confluence signal`);
      }
      if (
        exhaustionSignals.length < 1
        || exhaustionSignals.length > 3
        || new Set(exhaustionSignals).size !== exhaustionSignals.length
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast must publish 1-3 distinct exhaustion signals`);
      }
      if (
        validationCriteria.length < signalKinds.length
        || new Set(validationCriteria.map((criterion) => criterion.id)).size !== validationCriteria.length
        || validationCriteria.some((criterion) =>
          !signalKinds.includes(criterion.kind)
          || criterion.milestoneIds.length === 0
          || !/\d/.test(criterion.statement)
          || !/[≥≤]/.test(criterion.statement)
        )
        || signalKinds.some((kind) =>
          !validationCriteria.some((criterion) => criterion.kind === kind)
        )
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast must publish measurable criteria for every signal`);
      }
      if (
        peakRiskRule.activation !== "after_first_touch"
        || peakRiskRule.windowSessions !== 5
        || peakRiskRule.minimumSignals !== 2
        || peakCriteria.length !== 3
        || new Set(peakCriteria.map((criterion) => criterion.id)).size !== peakCriteria.length
        || peakCriteria.some((criterion) => !/\d/.test(criterion.statement) || !/[≥≤]/.test(criterion.statement))
        || !equalOrderedValues(
          exhaustionSignals,
          peakCriteria.map((criterion) => criterion.statement),
        )
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast must publish the current post-touch risk rule`);
      }

      if (
        stages.length !== CONFLUENCE_PHASES.length
        || stages.some((rawStage, stageIndex) => {
          const stage = requireObject(
            rawStage,
            `${label} predictions[${index}].pathForecast.stages[${stageIndex}]`,
          );
          requireString(stage.label, `${label} predictions[${index}].pathForecast.stages[${stageIndex}].label`);
          const milestoneIds = requireArray(
            stage.milestoneIds,
            `${label} predictions[${index}].pathForecast.stages[${stageIndex}].milestoneIds`,
          );
          return stage.phase !== CONFLUENCE_PHASES[stageIndex] || milestoneIds.length === 0;
        })
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast must publish setup, catalyst, confirmation stages in order`);
      }

      const normalizedStages = stages.map((rawStage, stageIndex) => {
        const stage = requireObject(rawStage, `${label} predictions[${index}].pathForecast.stages[${stageIndex}]`);
        return {
          phase: stage.phase,
          milestoneIds: requireArray(
            stage.milestoneIds,
            `${label} predictions[${index}].pathForecast.stages[${stageIndex}].milestoneIds`,
          ).map((milestoneId, milestoneIndex) => requireString(
            milestoneId,
            `${label} predictions[${index}].pathForecast.stages[${stageIndex}].milestoneIds[${milestoneIndex}]`,
          )),
        };
      });
      const stageMilestoneIds = normalizedStages.flatMap((stage) => stage.milestoneIds);
      for (const milestoneId of basisMilestoneIds) {
        if (!milestonesById.has(milestoneId)) {
          throw new Error(`${label} predictions[${index}] pathForecast references unknown basis milestone ${milestoneId}`);
        }
      }
      for (const milestoneId of stageMilestoneIds) {
        if (!milestonesById.has(milestoneId)) {
          throw new Error(`${label} predictions[${index}] pathForecast references unknown stage milestone ${milestoneId}`);
        }
        if (!basisMilestoneIds.includes(milestoneId)) {
          throw new Error(`${label} predictions[${index}] pathForecast stage references must remain in the confluence basis`);
        }
      }
      for (const criterion of validationCriteria) {
        for (const milestoneId of criterion.milestoneIds) {
          if (!milestonesById.has(milestoneId) || !basisMilestoneIds.includes(milestoneId)) {
            throw new Error(`${label} predictions[${index}] validation criterion references an unknown path milestone`);
          }
        }
      }
      if (!equalDistinctValues(stageMilestoneIds, basisMilestoneIds)) {
        throw new Error(`${label} predictions[${index}] pathForecast confluence basis must exactly match its stages`);
      }

      const setupMilestones = normalizedStages[0].milestoneIds.map((id) => milestonesById.get(id));
      const catalystMilestones = normalizedStages[1].milestoneIds.map((id) => milestonesById.get(id));
      const confirmationMilestones = normalizedStages[2].milestoneIds.map((id) => milestonesById.get(id));
      const scheduledCatalysts = catalystMilestones.filter(
        (milestone) => milestone.certainty !== "conditional_trigger",
      );
      if (scheduledCatalysts.length < 2) {
        throw new Error(`${label} predictions[${index}] pathForecast must include at least two scheduled catalysts`);
      }
      const fixedCatalysts = scheduledCatalysts.filter(
        (milestone) => milestone.certainty === "official_schedule",
      );
      const setupEnd = setupMilestones.map((milestone) => milestone.end).sort().at(-1);
      const firstFixedCatalystStart = fixedCatalysts.map((milestone) => milestone.start).sort()[0];
      const lastScheduledCatalystEnd = scheduledCatalysts.map((milestone) => milestone.end).sort().at(-1);
      const confirmationStart = confirmationMilestones.map((milestone) => milestone.start).sort()[0];
      if (
        !setupEnd
        || !firstFixedCatalystStart
        || !lastScheduledCatalystEnd
        || !confirmationStart
        || setupEnd >= firstFixedCatalystStart
        || confirmationStart <= lastScheduledCatalystEnd
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast setup must precede fixed catalysts and confirmation must follow every scheduled catalyst`);
      }

      const representedSignals = new Set();
      if (
        setupMilestones.some((milestone) => milestone.kind === "technical_checkpoint")
        && confirmationMilestones.some((milestone) => milestone.kind === "technical_checkpoint")
      ) representedSignals.add("market_absorption");
      if (scheduledCatalysts.some((milestone) => milestone.kind === "earnings")) {
        representedSignals.add("company_fundamentals");
      }
      if (scheduledCatalysts.some((milestone) => milestone.kind === "property_release")) {
        representedSignals.add("property_state");
      }
      if (scheduledCatalysts.some((milestone) =>
        milestone.kind === "macro_release" || milestone.kind === "china_adr_event"
      )) representedSignals.add("discount_rate_adr");
      if (signalKinds.some((signal) => !representedSignals.has(signal))) {
        throw new Error(`${label} predictions[${index}] pathForecast stages must represent every declared signal`);
      }

      const windowStart = requireDateOnly(
        window.start,
        `${label} predictions[${index}].pathForecast.confluenceWindow.start`,
      );
      const windowEnd = requireDateOnly(
        window.end,
        `${label} predictions[${index}].pathForecast.confluenceWindow.end`,
      );
      requireString(window.label, `${label} predictions[${index}].pathForecast.confluenceWindow.label`);
      if (!["低", "中", "高"].includes(window.confidence)) {
        throw new Error(`${label} predictions[${index}] pathForecast confluence window confidence is invalid`);
      }
      const expectedWindowStart = setupMilestones.map((milestone) => milestone.start).sort()[0];
      const expectedWindowEnd = confirmationMilestones.map((milestone) => milestone.end).sort().at(-1);
      if (
        windowStart >= windowEnd
        || windowStart !== expectedWindowStart
        || windowEnd !== expectedWindowEnd
      ) {
        throw new Error(`${label} predictions[${index}] pathForecast confluence window must span setup through confirmation`);
      }

      const checkpointIds = new Set();
      let previousCheckpointStart;
      for (const [checkpointIndex, rawCheckpoint] of checkpoints.entries()) {
        const checkpoint = requireObject(
          rawCheckpoint,
          `${label} predictions[${index}].pathForecast.checkpoints[${checkpointIndex}]`,
        );
        const milestoneId = requireString(
          checkpoint.milestoneId,
          `${label} predictions[${index}].pathForecast.checkpoints[${checkpointIndex}].milestoneId`,
        );
        const milestone = milestonesById.get(milestoneId);
        if (!milestone) {
          throw new Error(`${label} predictions[${index}] pathForecast references unknown checkpoint ${milestoneId}`);
        }
        if (checkpointIds.has(milestoneId)) {
          throw new Error(`${label} predictions[${index}] pathForecast checkpoint ${milestoneId} must be unique`);
        }
        checkpointIds.add(milestoneId);
        if (checkpoint.start !== milestone.start || checkpoint.end !== milestone.end) {
          throw new Error(`${label} predictions[${index}] pathForecast checkpoint must preserve milestone dates`);
        }
        if (milestone.start < forecastIssuedDate || milestone.end > forecastHorizonDate) {
          throw new Error(`${label} predictions[${index}] pathForecast checkpoint must remain within the audited forecast horizon`);
        }
        if (previousCheckpointStart && checkpoint.start < previousCheckpointStart) {
          throw new Error(`${label} predictions[${index}] pathForecast checkpoints must be chronological`);
        }
        previousCheckpointStart = checkpoint.start;
      }
      if (checkpoints.length > 0 && stageMilestoneIds.some((milestoneId) => !checkpointIds.has(milestoneId))) {
        throw new Error(`${label} predictions[${index}] pathForecast checkpoints must include every stage milestone`);
      }
      const terminalCheckpoint = checkpoints.at(-1);
      if (checkpoints.length > 0 && (
        !terminalCheckpoint
        || typeof terminalCheckpoint.milestoneId !== "string"
        || !terminalCheckpoint.milestoneId.startsWith("forecast-horizon-")
      )) {
        throw new Error(`${label} predictions[${index}] pathForecast must end at the 90-day horizon`);
      } else if (checkpoints.length > 0) {
        const expectedHorizonId = `forecast-horizon-${forecastHorizonDate}`;
        if (
          terminalCheckpoint.milestoneId !== expectedHorizonId
          || terminalCheckpoint.start !== forecastHorizonDate
          || terminalCheckpoint.end !== forecastHorizonDate
        ) {
          throw new Error(`${label} predictions[${index}] pathForecast final checkpoint must exactly match the audited horizon`);
        }
      }
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
  allowStaticFallback = false,
} = {}) {
  const publication = readPublicationEnvelope(payload, label);
  validateTargetPublicationContract(publication.snapshot, label);
  if (publication.source === "static-fallback" && !allowStaticFallback) {
    throw new Error(`${label} must not serve a static fallback publication`);
  }
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
        allowStaticFallback: config.forceRefresh,
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
