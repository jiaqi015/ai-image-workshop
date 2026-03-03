import fs from "node:fs";
import path from "node:path";

export const DEFAULT_ROUTING = {
  policy: {
    keyStrategy: "round_robin",
    cooldownMs: 60000,
    maxRetries: 2,
    pinnedModelFallback: "cross_provider",
  },
  providers: {
    openai: { enabled: true },
    google: { enabled: true },
    ali: { enabled: true },
    byte: { enabled: true },
    minimax: { enabled: true },
    zhipu: { enabled: true },
  },
  text: {
    providerOrder: ["openai", "google", "ali", "byte", "minimax", "zhipu"],
    models: {
      openai: ["gpt-5.1", "gpt-5", "gpt-5-mini"],
      google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-3-pro-preview"],
      ali: ["qwen-max", "qwen-plus", "qwen-turbo"],
      byte: [
        "doubao-1-5-pro-32k-250115",
        "doubao-1-5-lite-32k-250115",
        "doubao-seed-2-0-pro",
        "doubao-seed-2-0-lite",
        "doubao-seed-1-8",
      ],
      minimax: ["MiniMax-M2.5", "MiniMax-M2.5-highspeed", "MiniMax-M2.1"],
      zhipu: ["glm-4.7", "glm-4.6", "glm-4.5-flash"],
    },
    defaultModel: "qwen-max",
  },
  image: {
    providerOrder: ["openai", "google", "byte", "ali", "minimax", "zhipu"],
    models: {
      openai: ["gpt-image-1", "dall-e-3", "dall-e-2"],
      google: ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"],
      ali: ["wan2.2-t2i-plus", "wan2.2-t2i-flash", "wanx2.1-t2i-plus"],
      byte: [
        "doubao-seedream-4-0-250828",
        "doubao-seedream-3-0-t2i-250415",
        "doubao-seedream-5-0-lite",
        "doubao-seedream-4-5",
      ],
      minimax: ["image-01"],
      zhipu: ["glm-image", "cogview-4", "cogview-3-flash"],
    },
    defaultModel: "doubao-seedream-5-0-lite",
  },
};

export const PROVIDER_ENV = {
  openai: {
    keyVars: ["OPENAI_KEY", "OPENAI_API_KEY", "OPENAI_KEYS"],
    baseVars: ["OPENAI_BASE_URL", "PROXY_BASE_URL"],
    defaultBase: "https://api.openai.com/v1",
  },
  google: {
    keyVars: ["GOOGLE_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY", "GOOGLE_KEYS", "GEMINI_KEYS"],
    baseVars: ["GOOGLE_BASE_URL"],
    defaultBase: "",
  },
  ali: {
    keyVars: ["ALI_KEY", "ALI_API_KEY", "ALI_KEYS"],
    baseVars: ["ALI_BASE_URL"],
    defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
  byte: {
    keyVars: ["BYTE_KEY", "BYTE_API_KEY", "BYTE_KEYS", "DOUBAO_API_KEY", "DOUBAO_KEYS"],
    baseVars: ["BYTE_BASE_URL", "DOUBAO_BASE_URL"],
    defaultBase: "https://ark.cn-beijing.volces.com/api/v3",
  },
  minimax: {
    keyVars: ["MINIMAX_KEY", "MINIMAX_API_KEY", "MINIMAX_KEYS"],
    baseVars: ["MINIMAX_BASE_URL"],
    defaultBase: "https://api.minimax.io/v1",
  },
  zhipu: {
    keyVars: ["ZHIPU_KEY", "ZHIPU_API_KEY", "ZHIPU_KEYS"],
    baseVars: ["ZHIPU_BASE_URL"],
    defaultBase: "https://open.bigmodel.cn/api/paas/v4",
  },
};

export const OPENAI_COMPAT_ENDPOINTS = {
  openai: {
    chat: ["/chat/completions"],
    image: ["/images/generations"],
  },
  ali: {
    chat: ["/chat/completions"],
    image: ["/images/generations"],
  },
  byte: {
    chat: ["/chat/completions"],
    image: ["/images/generations"],
  },
  minimax: {
    chat: ["/chat/completions", "/text/chatcompletion_v2"],
    image: ["/images/generations", "/image_generation"],
  },
  zhipu: {
    chat: ["/chat/completions"],
    image: ["/images/generations"],
  },
};

export const DEFAULT_ALERT_THRESHOLDS = {
  successRateMin: 0.92,
  p95LatencyMsMax: 12000,
  rateLimitRateMax: 0.05,
  fallbackFailureRateMax: 0.2,
  providerAuthFailuresMax: 5,
  minRequestsForAlerting: 20,
};

export const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return "";
  return String(baseUrl).replace(/\/$/, "");
};

const parseKeys = (...rawValues) => {
  const unique = new Set();
  for (const raw of rawValues) {
    if (!raw) continue;
    const chunks = String(raw)
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const key of chunks) unique.add(key);
  }
  return [...unique];
};

const firstEnv = (vars = [], env = process.env) => {
  for (const key of vars) {
    if (env[key]) return env[key];
  }
  return "";
};

const deepMerge = (base, override) => {
  if (!override || typeof override !== "object") return base;
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof output[k] === "object" && !Array.isArray(output[k])) {
      output[k] = deepMerge(output[k], v);
    } else {
      output[k] = v;
    }
  }
  return output;
};

export const loadRoutingConfig = ({ cwd = process.cwd() } = {}) => {
  try {
    const file = path.join(cwd, "config", "ai-routing.json");
    if (!fs.existsSync(file)) return DEFAULT_ROUTING;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return deepMerge(DEFAULT_ROUTING, parsed);
  } catch {
    return DEFAULT_ROUTING;
  }
};

export const loadRuntimeAliasConfig = ({ cwd = process.cwd() } = {}) => {
  try {
    const file = path.join(cwd, "config", "ai-runtime-aliases.json");
    if (!fs.existsSync(file)) return {};
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const loadAlertThresholdConfig = ({ cwd = process.cwd() } = {}) => {
  try {
    const file = path.join(cwd, "config", "ai-alert-thresholds.json");
    if (!fs.existsSync(file)) return DEFAULT_ALERT_THRESHOLDS;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return DEFAULT_ALERT_THRESHOLDS;
    return deepMerge(DEFAULT_ALERT_THRESHOLDS, parsed);
  } catch {
    return DEFAULT_ALERT_THRESHOLDS;
  }
};

export const buildProviderCredentials = ({ env = process.env, providerEnv = PROVIDER_ENV } = {}) => {
  const credentials = {};
  for (const provider of Object.keys(providerEnv)) {
    const conf = providerEnv[provider];
    const keys = parseKeys(...conf.keyVars.map((k) => env[k]));
    const baseUrl = normalizeBaseUrl(firstEnv(conf.baseVars, env) || conf.defaultBase || "");
    credentials[provider] = { keys, baseUrl };
  }
  return credentials;
};

export const providerNeedsBaseUrl = (provider) => provider !== "google";

export const readGatewayRuntimeConfig = ({ cwd = process.cwd(), env = process.env } = {}) => {
  return {
    routingConfig: loadRoutingConfig({ cwd }),
    runtimeModelAliases: loadRuntimeAliasConfig({ cwd }),
    alertThresholds: loadAlertThresholdConfig({ cwd }),
    providerCredentials: buildProviderCredentials({ env }),
  };
};
