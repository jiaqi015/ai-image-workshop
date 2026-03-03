import { getDashboardSnapshot } from "./telemetry.js";

const clamp01 = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
};

const round = (value, digits = 4) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
};

const toPct = (value) => round(clamp01(value) * 100, 2);

export const getNorthstarSnapshot = ({ period = "day" } = {}) => {
  const dashboard = getDashboardSnapshot(period);

  const successRate = clamp01(dashboard?.traffic?.successRate || 0);
  const rateLimitRate = clamp01(dashboard?.traffic?.rateLimitRate || 0);
  const fallbackTriggered = Number(dashboard?.routing?.fallbackTriggered || 0);
  const fallbackSuccess = Number(dashboard?.routing?.fallbackSuccess || 0);
  const fallbackRecoveryRate = fallbackTriggered > 0 ? clamp01(fallbackSuccess / fallbackTriggered) : 1;

  const p95LatencyMs = Number(dashboard?.latency?.p95LatencyMs || 0);
  const latencyPenaltyBaseMs = 15000;
  const latencyScore = clamp01(1 - p95LatencyMs / latencyPenaltyBaseMs);

  const e2eSuccessRate = successRate;
  const availabilityScore = clamp01(1 - rateLimitRate);

  const northstarIndex = clamp01(e2eSuccessRate * availabilityScore * fallbackRecoveryRate * latencyScore);

  return {
    generatedAt: new Date().toISOString(),
    period: dashboard?.period || String(period || "day"),
    northstar: {
      index: round(northstarIndex),
      indexPct: toPct(northstarIndex),
      formula: "e2eSuccessRate * availabilityScore * fallbackRecoveryRate * latencyScore",
    },
    components: {
      e2eSuccessRate: round(e2eSuccessRate),
      e2eSuccessRatePct: toPct(e2eSuccessRate),
      availabilityScore: round(availabilityScore),
      availabilityScorePct: toPct(availabilityScore),
      fallbackRecoveryRate: round(fallbackRecoveryRate),
      fallbackRecoveryRatePct: toPct(fallbackRecoveryRate),
      latencyScore: round(latencyScore),
      latencyScorePct: toPct(latencyScore),
    },
    diagnostics: {
      totalRequests: Number(dashboard?.traffic?.totalRequests || 0),
      p95LatencyMs,
      rateLimitRate: round(rateLimitRate),
      rateLimitRatePct: toPct(rateLimitRate),
      fallbackTriggered,
      fallbackSuccess,
      providerCount: Object.keys(dashboard?.providers || {}).length,
    },
    dashboard,
  };
};
