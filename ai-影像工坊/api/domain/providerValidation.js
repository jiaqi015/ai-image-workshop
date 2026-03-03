const providerValidationState = new Map();

const AUTH_FAILURE_PATTERNS = [
  'api key not valid',
  'invalid api key',
  'authentication',
  'unauthorized',
  'forbidden',
  'invalid credentials',
  'access denied',
];

const nowIso = () => new Date().toISOString();

const getOrCreate = (provider) => {
  if (!providerValidationState.has(provider)) {
    providerValidationState.set(provider, {
      validated: false,
      lastValidatedAt: null,
      lastErrorAt: null,
      lastError: '',
      lastStatus: 0,
    });
  }
  return providerValidationState.get(provider);
};

const errorMessage = (error) => {
  if (!error) return '';
  return error instanceof Error ? error.message : String(error);
};

export const isAuthFailure = (error) => {
  const status = Number(error?.status || 0);
  if (status === 401 || status === 403) return true;
  const msg = errorMessage(error).toLowerCase();
  return AUTH_FAILURE_PATTERNS.some((pattern) => msg.includes(pattern));
};

export const markProviderValidated = (provider) => {
  if (!provider) return;
  const state = getOrCreate(provider);
  state.validated = true;
  state.lastValidatedAt = nowIso();
  state.lastError = '';
  state.lastStatus = 0;
};

export const markProviderValidationFailure = (provider, error) => {
  if (!provider) return;
  const state = getOrCreate(provider);
  state.validated = false;
  state.lastErrorAt = nowIso();
  state.lastError = errorMessage(error).slice(0, 200);
  state.lastStatus = Number(error?.status || 0);
};

export const getProviderValidationState = (provider) => {
  if (!provider) return null;
  return getOrCreate(provider);
};

export const getProviderValidationSnapshot = () => {
  const output = {};
  for (const [provider, state] of providerValidationState.entries()) {
    output[provider] = {
      validated: Boolean(state.validated),
      lastValidatedAt: state.lastValidatedAt || null,
      lastErrorAt: state.lastErrorAt || null,
      lastError: state.lastError || '',
      lastStatus: Number(state.lastStatus || 0),
    };
  }
  return output;
};
