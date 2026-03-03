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

export const createTraceId = () => {
  const random = Math.random().toString(36).slice(2, 10);
  return `tr_${Date.now().toString(36)}_${random}`;
};

export const recordRequestStart = ({ action, method }) => {
  state.requests.total += 1;
  bump(state.requests.byAction, String(action || 'unknown'));
  bump(state.requests.byMethod, String(method || 'unknown').toUpperCase());
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

export const getTelemetrySnapshot = () => {
  return JSON.parse(JSON.stringify(state));
};
