const MAX_EVENTS = 10000;

const state = {
  startedAt: new Date().toISOString(),
  requests: {
    total: 0,
    byAction: {},
    byMethod: {},
  },
  outcomes: {
    success: 0,
    clientError: 0,
    serverError: 0,
    unauthorized: 0,
    rateLimited: 0,
  },
  errors: {
    keyMissing: 0,
    modelUnavailable: 0,
    timeout: 0,
    rateLimit429: 0,
    authFailure: 0,
    other: 0,
  },
  routing: {
    fallbackTriggered: 0,
    fallbackSuccess: 0,
  },
  providers: {},
  performance: {
    requestsWithDuration: 0,
    totalDurationMs: 0,
    avgDurationMs: 0,
  },
  events: [],
};

const bump = (bucket, key, n = 1) => {
  if (!bucket[key]) bucket[key] = 0;
  bucket[key] += n;
};

const classifyError = (status, message) => {
  const msg = String(message || '').toLowerCase();
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('api key not valid')) {
    return 'authFailure';
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('quota')) return 'rateLimit429';
  if (status === 504 || msg.includes('超时') || msg.includes('timeout')) return 'timeout';
  if (msg.includes('modelnotopen') || msg.includes('model not found') || msg.includes('模型未开通') || msg.includes('nosuchmodel')) {
    return 'modelUnavailable';
  }
  if (msg.includes('没有可用的厂商或 key') || msg.includes('no available provider')) return 'keyMissing';
  return 'other';
};

const ensureProviderMetrics = (provider) => {
  if (!state.providers[provider]) {
    state.providers[provider] = {
      attempts: 0,
      success: 0,
      failures: 0,
      retryableFailures: 0,
      modelUnavailable: 0,
      authFailures: 0,
      lastStatus: 0,
      lastError: '',
      lastModel: '',
      lastLatencyMs: 0,
      lastUsedAt: null,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
    };
  }
  return state.providers[provider];
};

const toPercent = (value) => Number((value * 100).toFixed(2));

const percentile = (input, p) => {
  const arr = (input || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  if (arr.length === 1) return arr[0];
  const idx = Math.ceil((p / 100) * arr.length) - 1;
  const safeIdx = Math.max(0, Math.min(arr.length - 1, idx));
  return arr[safeIdx];
};

const pushEvent = (event) => {
  state.events.push(event);
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }
};

const getWindowMs = (period) => {
  if (String(period).toLowerCase() === 'week') return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
};

const summarizeEvents = (events) => {
  const summary = {
    totalRequests: 0,
    success: 0,
    clientError: 0,
    serverError: 0,
    rateLimited: 0,
    durations: [],
    byAction: {},
  };

  for (const event of events) {
    summary.totalRequests += 1;

    const action = String(event.action || 'unknown');
    if (!summary.byAction[action]) {
      summary.byAction[action] = {
        total: 0,
        success: 0,
        clientError: 0,
        serverError: 0,
        avgDurationMs: 0,
        totalDurationMs: 0,
      };
    }

    const actionBucket = summary.byAction[action];
    actionBucket.total += 1;

    const status = Number(event.status || 0);
    if (status >= 200 && status < 400) {
      summary.success += 1;
      actionBucket.success += 1;
    } else if (status >= 400 && status < 500) {
      summary.clientError += 1;
      actionBucket.clientError += 1;
      if (status === 429) summary.rateLimited += 1;
    } else if (status >= 500) {
      summary.serverError += 1;
      actionBucket.serverError += 1;
    }

    const durationMs = Number(event.durationMs || 0);
    if (durationMs > 0) {
      summary.durations.push(durationMs);
      actionBucket.totalDurationMs += durationMs;
    }
  }

  for (const bucket of Object.values(summary.byAction)) {
    const denom = Math.max(1, Number(bucket.total || 0));
    bucket.avgDurationMs = Number((Number(bucket.totalDurationMs || 0) / denom).toFixed(2));
    delete bucket.totalDurationMs;
  }

  return summary;
};

export const createTraceId = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `tr_${Date.now().toString(36)}_${random}`;
};

export const recordRequestStart = ({ action, method }) => {
  state.requests.total += 1;
  bump(state.requests.byAction, String(action || 'unknown'));
  bump(state.requests.byMethod, String(method || 'unknown').toUpperCase());
};

export const recordRequestComplete = ({ action, method, status, durationMs = 0, traceId = '' }) => {
  const duration = Number(durationMs || 0);
  if (duration > 0) {
    state.performance.requestsWithDuration += 1;
    state.performance.totalDurationMs += duration;
    state.performance.avgDurationMs = Number(
      (state.performance.totalDurationMs / Math.max(1, state.performance.requestsWithDuration)).toFixed(2)
    );
  }

  pushEvent({
    ts: Date.now(),
    traceId: String(traceId || ''),
    action: String(action || 'unknown'),
    method: String(method || 'UNKNOWN').toUpperCase(),
    status: Number(status || 0),
    durationMs: duration,
  });
};

export const recordOutcomeByStatus = (status) => {
  const code = Number(status || 0);
  if (code >= 200 && code < 400) state.outcomes.success += 1;
  else if (code >= 400 && code < 500) state.outcomes.clientError += 1;
  else if (code >= 500) state.outcomes.serverError += 1;
};

export const recordUnauthorized = () => {
  state.outcomes.unauthorized += 1;
  state.outcomes.clientError += 1;
  state.errors.authFailure += 1;
};

export const recordRateLimited = () => {
  state.outcomes.rateLimited += 1;
  state.outcomes.clientError += 1;
  state.errors.rateLimit429 += 1;
};

export const recordError = (error) => {
  const status = Number(error?.status || 0);
  const message = error instanceof Error ? error.message : String(error || '');
  const bucket = classifyError(status, message);
  state.errors[bucket] += 1;
};

export const recordProviderAttempt = ({
  provider,
  model,
  status,
  success,
  retryable = false,
  latencyMs = 0,
  errorMessage = '',
}) => {
  if (!provider) return;
  const metric = ensureProviderMetrics(provider);

  metric.attempts += 1;
  metric.lastModel = String(model || '');
  metric.lastStatus = Number(status || 0);
  metric.lastLatencyMs = Number(latencyMs || 0);
  metric.lastUsedAt = new Date().toISOString();

  if (Number(latencyMs || 0) > 0) {
    metric.totalLatencyMs += Number(latencyMs);
    metric.avgLatencyMs = Number((metric.totalLatencyMs / Math.max(1, metric.attempts)).toFixed(2));
  }

  if (success) {
    metric.success += 1;
    metric.lastError = '';
    return;
  }

  metric.failures += 1;
  if (retryable) metric.retryableFailures += 1;

  const normalizedError = String(errorMessage || '').slice(0, 200);
  metric.lastError = normalizedError;

  const lowered = normalizedError.toLowerCase();
  if (lowered.includes('modelnotopen') || lowered.includes('model not found') || lowered.includes('模型未开通')) {
    metric.modelUnavailable += 1;
  }
  if (status === 401 || status === 403 || lowered.includes('api key not valid') || lowered.includes('unauthorized')) {
    metric.authFailures += 1;
  }
};

export const recordFallbackTriggered = () => {
  state.routing.fallbackTriggered += 1;
};

export const recordFallbackSuccess = () => {
  state.routing.fallbackSuccess += 1;
};

export const getDashboardSnapshot = (period = 'day') => {
  const normalizedPeriod = String(period || 'day').toLowerCase() === 'week' ? 'week' : 'day';
  const windowMs = getWindowMs(normalizedPeriod);
  const now = Date.now();
  const events = state.events.filter((item) => now - Number(item.ts || 0) <= windowMs);
  const summary = summarizeEvents(events);

  const total = summary.totalRequests;
  const successRate = total > 0 ? summary.success / total : 0;
  const rateLimitRate = total > 0 ? summary.rateLimited / total : 0;
  const p50LatencyMs = percentile(summary.durations, 50);
  const p95LatencyMs = percentile(summary.durations, 95);
  const avgLatencyMs =
    summary.durations.length > 0
      ? Number((summary.durations.reduce((acc, n) => acc + n, 0) / summary.durations.length).toFixed(2))
      : 0;

  const fallbackTriggered = Number(state.routing.fallbackTriggered || 0);
  const fallbackSuccess = Number(state.routing.fallbackSuccess || 0);
  const fallbackFailureRate =
    fallbackTriggered > 0 ? Number((1 - fallbackSuccess / fallbackTriggered).toFixed(4)) : 0;

  return {
    period: normalizedPeriod,
    windowMs,
    generatedAt: new Date().toISOString(),
    traffic: {
      totalRequests: total,
      successRate,
      successRatePct: toPercent(successRate),
      clientErrorRatePct: total > 0 ? toPercent(summary.clientError / total) : 0,
      serverErrorRatePct: total > 0 ? toPercent(summary.serverError / total) : 0,
      rateLimitRate,
      rateLimitRatePct: toPercent(rateLimitRate),
    },
    latency: {
      p50LatencyMs,
      p95LatencyMs,
      avgLatencyMs,
      sampleCount: summary.durations.length,
    },
    routing: {
      fallbackTriggered,
      fallbackSuccess,
      fallbackFailureRate,
      fallbackFailureRatePct: toPercent(fallbackFailureRate),
    },
    actions: summary.byAction,
    providers: state.providers,
    errors: state.errors,
  };
};

export const evaluateAlerts = ({ period = 'day', thresholds = {} } = {}) => {
  const dashboard = getDashboardSnapshot(period);
  const mergedThresholds = {
    successRateMin: 0.92,
    p95LatencyMsMax: 12000,
    rateLimitRateMax: 0.05,
    fallbackFailureRateMax: 0.2,
    providerAuthFailuresMax: 5,
    minRequestsForAlerting: 20,
    ...thresholds,
  };

  const alerts = [];

  if (dashboard.traffic.totalRequests < mergedThresholds.minRequestsForAlerting) {
    alerts.push({
      severity: 'info',
      code: 'LOW_TRAFFIC_SAMPLE',
      message: `样本量不足，当前 ${dashboard.traffic.totalRequests} < ${mergedThresholds.minRequestsForAlerting}`,
      current: dashboard.traffic.totalRequests,
      threshold: mergedThresholds.minRequestsForAlerting,
    });
  }

  if (dashboard.traffic.successRate < mergedThresholds.successRateMin) {
    alerts.push({
      severity: 'critical',
      code: 'SUCCESS_RATE_LOW',
      message: '成功率低于阈值',
      current: dashboard.traffic.successRate,
      threshold: mergedThresholds.successRateMin,
    });
  }

  if (dashboard.latency.p95LatencyMs > mergedThresholds.p95LatencyMsMax) {
    alerts.push({
      severity: 'warning',
      code: 'P95_LATENCY_HIGH',
      message: 'P95 延迟超过阈值',
      current: dashboard.latency.p95LatencyMs,
      threshold: mergedThresholds.p95LatencyMsMax,
    });
  }

  if (dashboard.traffic.rateLimitRate > mergedThresholds.rateLimitRateMax) {
    alerts.push({
      severity: 'warning',
      code: 'RATE_LIMIT_HIGH',
      message: '429 比例超过阈值',
      current: dashboard.traffic.rateLimitRate,
      threshold: mergedThresholds.rateLimitRateMax,
    });
  }

  if (dashboard.routing.fallbackFailureRate > mergedThresholds.fallbackFailureRateMax) {
    alerts.push({
      severity: 'warning',
      code: 'FALLBACK_FAILURE_HIGH',
      message: 'Fallback 失败率超过阈值',
      current: dashboard.routing.fallbackFailureRate,
      threshold: mergedThresholds.fallbackFailureRateMax,
    });
  }

  const providerAuthAlerts = [];
  for (const [provider, stats] of Object.entries(dashboard.providers || {})) {
    const failures = Number(stats?.authFailures || 0);
    if (failures > mergedThresholds.providerAuthFailuresMax) {
      providerAuthAlerts.push({ provider, authFailures: failures });
    }
  }

  for (const item of providerAuthAlerts) {
    alerts.push({
      severity: 'critical',
      code: 'PROVIDER_AUTH_FAILURE_HIGH',
      message: `${item.provider} 认证失败次数超过阈值`,
      provider: item.provider,
      current: item.authFailures,
      threshold: mergedThresholds.providerAuthFailuresMax,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    period: dashboard.period,
    healthy: alerts.filter((item) => item.severity !== 'info').length === 0,
    thresholds: mergedThresholds,
    alerts,
    summary: {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    },
    dashboard,
  };
};

export const getTelemetrySnapshot = () => {
  return JSON.parse(JSON.stringify(state));
};
