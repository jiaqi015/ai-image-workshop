import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const DEFAULT_ROUTING = {
  policy: {
    keyStrategy: "round_robin",
    cooldownMs: 60000,
    maxRetries: 2,
    pinnedModelFallback: "same_provider",
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
      byte: ["doubao-seed-2-0-pro", "doubao-seed-2-0-lite", "doubao-seed-1-8"],
      minimax: ["MiniMax-M2.5", "MiniMax-M2.5-highspeed", "MiniMax-M2.1"],
      zhipu: ["glm-4.7", "glm-4.6", "glm-4.5-flash"],
    },
    defaultModel: "gpt-5.1",
  },
  image: {
    providerOrder: ["openai", "google", "byte", "ali", "minimax", "zhipu"],
    models: {
      openai: ["gpt-image-1", "dall-e-3", "dall-e-2"],
      google: ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"],
      ali: ["wan2.2-t2i-plus", "wan2.2-t2i-flash", "wanx2.1-t2i-plus"],
      byte: ["doubao-seedream-5-0-lite", "doubao-seedream-4-5", "doubao-seedream-4-0-250828"],
      minimax: ["image-01"],
      zhipu: ["glm-image", "cogview-4", "cogview-3-flash"],
    },
    defaultModel: "gpt-image-1",
  },
};

const PROVIDER_ENV = {
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

const keyRuntimeState = new Map();
const rateLimitState = new Map();

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const UPSTREAM_TIMEOUT_MS = toPositiveInt(process.env.AI_UPSTREAM_TIMEOUT_MS, 25000);
const GOOGLE_UPSTREAM_TIMEOUT_MS = toPositiveInt(process.env.AI_GOOGLE_TIMEOUT_MS, UPSTREAM_TIMEOUT_MS);
const RATE_LIMIT_RPM = toPositiveInt(process.env.AI_RATE_LIMIT_RPM, 120);
const RATE_LIMIT_WINDOW_MS = 60_000;
const GATEWAY_TOKEN = String(process.env.AI_GATEWAY_TOKEN || "").trim();

const parseJsonObjectEnv = (name) => {
  const raw = process.env[name];
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

// Optional alias map for provider-specific runtime IDs (e.g. Byte endpoint ids)
// Example:
// AI_MODEL_ALIASES_JSON='{"byte":{"doubao-seed-2-0-pro":"ep-2026xxx","doubao-seedream-5-0-lite":"ep-2026yyy"}}'
const MODEL_ALIASES = parseJsonObjectEnv("AI_MODEL_ALIASES_JSON");

const resolveRuntimeModel = (provider, model) => {
  const normalizedProvider = String(provider || "").trim();
  const normalizedModel = String(model || "").trim();
  if (!normalizedModel) return normalizedModel;

  const providerMap =
    MODEL_ALIASES?.[normalizedProvider] && typeof MODEL_ALIASES[normalizedProvider] === "object"
      ? MODEL_ALIASES[normalizedProvider]
      : {};
  const byProvider = providerMap?.[normalizedModel];
  if (typeof byProvider === "string" && byProvider.trim()) return byProvider.trim();

  const topLevel = MODEL_ALIASES?.[normalizedModel];
  if (typeof topLevel === "string" && topLevel.trim()) return topLevel.trim();

  return normalizedModel;
};

const normalizeBaseUrl = (baseUrl) => {
  if (!baseUrl) return "";
  return String(baseUrl).replace(/\/$/, "");
};

const readHeader = (req, name) => {
  const headers = req?.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "";
};

const getClientIp = (req) => {
  const forwardedFor = readHeader(req, "x-forwarded-for");
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return (
    readHeader(req, "x-real-ip") ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    "unknown"
  );
};

const extractGatewayToken = (req) => {
  const byHeader = readHeader(req, "x-gateway-token");
  if (typeof byHeader === "string" && byHeader.trim()) return byHeader.trim();

  const authorization = readHeader(req, "authorization");
  if (typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return "";
};

const isAuthorized = (req) => {
  if (!GATEWAY_TOKEN) return true;
  return extractGatewayToken(req) === GATEWAY_TOKEN;
};

const checkRateLimit = (req, action = "unknown") => {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${ip}:${action}`;

  let bucket = rateLimitState.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitState.set(key, bucket);
  }

  if (bucket.count >= RATE_LIMIT_RPM) {
    return {
      ok: false,
      limit: RATE_LIMIT_RPM,
      remaining: 0,
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    limit: RATE_LIMIT_RPM,
    remaining: Math.max(0, RATE_LIMIT_RPM - bucket.count),
    resetAt: bucket.resetAt,
  };
};

const maybePruneRateLimitState = () => {
  if (rateLimitState.size < 3000) return;
  const now = Date.now();
  for (const [key, bucket] of rateLimitState) {
    if (bucket.resetAt <= now) rateLimitState.delete(key);
  }
};

const setRateLimitHeaders = (res, rateInfo) => {
  if (!res?.setHeader || !rateInfo) return;
  res.setHeader("X-RateLimit-Limit", String(rateInfo.limit));
  res.setHeader("X-RateLimit-Remaining", String(rateInfo.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(rateInfo.resetAt / 1000)));
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = UPSTREAM_TIMEOUT_MS) => {
  const timeoutController = new AbortController();
  const externalSignal = options?.signal;

  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  let detachExternalAbort = null;
  if (externalSignal && typeof externalSignal.addEventListener === "function") {
    if (externalSignal.aborted) timeoutController.abort();
    const onExternalAbort = () => timeoutController.abort();
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    detachExternalAbort = () => externalSignal.removeEventListener("abort", onExternalAbort);
  }

  try {
    return await fetch(url, {
      ...options,
      signal: timeoutController.signal,
    });
  } catch (error) {
    if (timeoutController.signal.aborted) {
      throw Object.assign(new Error(`上游请求超时 (${timeoutMs}ms)`), { status: 504 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (detachExternalAbort) detachExternalAbort();
  }
};

const withTimeout = async (promise, timeoutMs, message) => {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error(message), { status: 504 }));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

const firstEnv = (vars = []) => {
  for (const key of vars) {
    if (process.env[key]) return process.env[key];
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

const loadRoutingConfig = () => {
  try {
    const file = path.join(process.cwd(), "config", "ai-routing.json");
    if (!fs.existsSync(file)) return DEFAULT_ROUTING;
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return deepMerge(DEFAULT_ROUTING, parsed);
  } catch {
    return DEFAULT_ROUTING;
  }
};

const routingConfig = loadRoutingConfig();

const providerEnabled = (provider) => Boolean(routingConfig?.providers?.[provider]?.enabled);

const buildProviderCredentials = () => {
  const credentials = {};
  for (const provider of Object.keys(PROVIDER_ENV)) {
    const conf = PROVIDER_ENV[provider];
    const keys = parseKeys(...conf.keyVars.map((k) => process.env[k]));
    const baseUrl = normalizeBaseUrl(firstEnv(conf.baseVars) || conf.defaultBase || "");
    credentials[provider] = { keys, baseUrl };
  }
  return credentials;
};

const providerCredentials = buildProviderCredentials();

const providerNeedsBaseUrl = (provider) => provider !== "google";

const providerUsable = (provider) => {
  const creds = providerCredentials?.[provider] || { keys: [], baseUrl: "" };
  if (!providerEnabled(provider)) return false;
  if (!Array.isArray(creds.keys) || creds.keys.length === 0) return false;
  if (providerNeedsBaseUrl(provider) && !creds.baseUrl) return false;
  return true;
};

const getProviderState = (provider) => {
  if (!keyRuntimeState.has(provider)) {
    keyRuntimeState.set(provider, {
      index: 0,
      cooldownUntil: new Map(),
    });
  }
  return keyRuntimeState.get(provider);
};

const pickKey = (provider) => {
  const keys = providerCredentials?.[provider]?.keys || [];
  if (!keys.length) return null;

  const state = getProviderState(provider);
  const now = Date.now();

  for (let offset = 0; offset < keys.length; offset++) {
    const idx = (state.index + offset) % keys.length;
    const key = keys[idx];
    const cooldown = state.cooldownUntil.get(key) || 0;
    if (cooldown > now) continue;
    state.index = (idx + 1) % keys.length;
    return key;
  }

  return null;
};

const cooldownKey = (provider, key, ms) => {
  if (!key) return;
  const state = getProviderState(provider);
  state.cooldownUntil.set(key, Date.now() + ms);
};

const inferProviderByModel = (taskType, model) => {
  const section = routingConfig?.[taskType] || {};
  const modelsByProvider = section.models || {};
  const normalized = String(model || "").trim().toLowerCase();

  for (const [provider, models] of Object.entries(modelsByProvider)) {
    if (Array.isArray(models) && models.includes(model)) return provider;
  }

  if (normalized.startsWith("gemini")) return "google";
  if (normalized.startsWith("gpt") || normalized.startsWith("dall-e")) return "openai";
  if (normalized.includes("qwen") || normalized.startsWith("wan")) return "ali";
  if (normalized.includes("doubao") || normalized.includes("seedream")) return "byte";
  if (normalized.includes("minimax") || normalized === "image-01") return "minimax";
  if (normalized.includes("glm") || normalized.includes("cogview")) return "zhipu";

  return null;
};

const resolveTaskConfig = (taskType, requestedModel) => {
  const section = routingConfig?.[taskType] || {};
  const providerOrder = Array.isArray(section.providerOrder) ? section.providerOrder : [];
  const modelsByProvider = section.models || {};
  const pinnedFallbackPolicy = String(routingConfig?.policy?.pinnedModelFallback || "same_provider");

  const requestedProvider = requestedModel ? inferProviderByModel(taskType, requestedModel) : null;
  const pinnedProviderOnly = Boolean(requestedProvider && pinnedFallbackPolicy !== "cross_provider");

  const providers = pinnedProviderOnly
    ? [requestedProvider]
    : (() => {
        const list = [];
        if (requestedProvider) list.push(requestedProvider);
        for (const p of providerOrder) {
          if (!list.includes(p)) list.push(p);
        }
        return list;
      })();

  const dedupeModels = (models = []) => {
    const unique = [];
    for (const model of models) {
      const value = String(model || "").trim();
      if (!value || unique.includes(value)) continue;
      unique.push(value);
    }
    return unique;
  };

  const candidates = [];
  for (const provider of providers) {
    if (!providerEnabled(provider)) continue;

    const providerModels = dedupeModels(Array.isArray(modelsByProvider[provider]) ? modelsByProvider[provider] : []);
    const firstChoices =
      requestedProvider === provider && requestedModel
        ? dedupeModels([requestedModel, ...providerModels])
        : providerModels;

    for (const model of firstChoices) {
      candidates.push({ provider, model });
    }
  }

  const fallbackModel = section.defaultModel || requestedModel || null;

  return { candidates, fallbackModel, modelsByProvider, providerOrder };
};

const messageText = (messages = []) =>
  messages
    .map((m) => `${m.role || "user"}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content || "")}`)
    .join("\n");

const firstSystemMessage = (messages = []) => messages.find((m) => m?.role === "system")?.content || "";
const firstUserMessage = (messages = []) => messages.find((m) => m?.role === "user")?.content || "";

const extractGeminiText = (resp) => {
  if (typeof resp?.text === "string" && resp.text.length > 0) return resp.text;
  const parts = resp?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((p) => typeof p?.text === "string")
    .map((p) => p.text)
    .join("");
};

const isModelNotOpenError = (raw) => {
  const text = String(raw || "");
  return text.includes("ModelNotOpen");
};

const buildOpenAICompatibleError = (taskLabel, status, txt, provider, model) => {
  if (isModelNotOpenError(txt)) {
    const providerName =
      provider === "byte"
        ? "字节/豆包"
        : provider === "ali"
          ? "阿里"
          : provider === "minimax"
            ? "MiniMax"
            : provider === "zhipu"
              ? "智谱"
              : provider === "openai"
                ? "OpenAI"
                : provider || "该厂商";
    return Object.assign(
      new Error(`${providerName} 模型未开通: ${model}。请先在厂商控制台开通该模型，或切换同厂商其他模型。`),
      { status }
    );
  }

  return Object.assign(new Error(`${taskLabel} Error ${status}: ${String(txt || "").slice(0, 220)}`), { status });
};

const callOpenAICompatibleChat = async ({ baseUrl, apiKey, model, messages, provider }) => {
  if (!baseUrl) throw Object.assign(new Error("BASE_URL 未配置"), { status: 500 });
  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw buildOpenAICompatibleError("Chat", response.status, txt, provider, model);
  }

  const data = await response.json();
  return {
    text: data?.choices?.[0]?.message?.content || "",
    raw: data,
  };
};

const callOpenAICompatibleImage = async ({ baseUrl, apiKey, model, prompt, provider }) => {
  if (!baseUrl) throw Object.assign(new Error("BASE_URL 未配置"), { status: 500 });
  const response = await fetchWithTimeout(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw buildOpenAICompatibleError("Image", response.status, txt, provider, model);
  }

  const data = await response.json();
  const item = data?.data?.[0] || {};
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (item?.url) return item.url;
  throw Object.assign(new Error("Image 返回为空"), { status: 500 });
};

const callGoogleChat = async ({ apiKey, model, messages }) => {
  const client = new GoogleGenAI({ apiKey });
  const systemInstruction = firstSystemMessage(messages);
  const userMessage = firstUserMessage(messages) || messageText(messages);

  const resp = await withTimeout(
    client.models.generateContent({
      model,
      contents: userMessage,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        responseMimeType: "application/json",
      },
    }),
    GOOGLE_UPSTREAM_TIMEOUT_MS,
    `Google 请求超时 (${GOOGLE_UPSTREAM_TIMEOUT_MS}ms)`
  );

  return { text: extractGeminiText(resp), raw: resp };
};

const callGoogleGenerate = async ({ apiKey, model, contents, config }) => {
  const client = new GoogleGenAI({ apiKey });
  const resp = await withTimeout(
    client.models.generateContent({ model, contents, config: config || {} }),
    GOOGLE_UPSTREAM_TIMEOUT_MS,
    `Google 请求超时 (${GOOGLE_UPSTREAM_TIMEOUT_MS}ms)`
  );
  return { text: extractGeminiText(resp), raw: resp };
};

const callGoogleImage = async ({ apiKey, model, prompt }) => {
  const client = new GoogleGenAI({ apiKey });
  const config = {
    imageConfig: { aspectRatio: "3:4" },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ],
  };
  if (String(model).includes("pro")) config.imageConfig.imageSize = "1K";

  const resp = await withTimeout(
    client.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config,
    }),
    GOOGLE_UPSTREAM_TIMEOUT_MS,
    `Google 生图超时 (${GOOGLE_UPSTREAM_TIMEOUT_MS}ms)`
  );

  const imagePart = resp?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData);
  if (imagePart?.inlineData) {
    return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  }
  throw Object.assign(new Error("Google Image 未返回图片数据"), { status: 500 });
};

const buildGeneratePrompt = (contents, messages) =>
  typeof contents === "string" ? contents : messageText(messages || [{ role: "user", content: contents }]);

const createOpenAICompatibleAdapter = (provider) => ({
  chat: async ({ model, messages, key, baseUrl }) =>
    callOpenAICompatibleChat({ baseUrl, apiKey: key, model, messages, provider }),
  generate: async ({ model, contents, messages, key, baseUrl }) =>
    callOpenAICompatibleChat({
      baseUrl,
      apiKey: key,
      model,
      messages: [{ role: "user", content: buildGeneratePrompt(contents, messages) }],
      provider,
    }),
  image: async ({ model, prompt, key, baseUrl }) =>
    callOpenAICompatibleImage({ baseUrl, apiKey: key, model, prompt, provider }).then((imageUrl) => ({ imageUrl })),
});

const PROVIDER_ADAPTERS = {
  google: {
    chat: async ({ model, messages, key }) => callGoogleChat({ apiKey: key, model, messages }),
    generate: async ({ model, contents, config, key }) => callGoogleGenerate({ apiKey: key, model, contents, config }),
    image: async ({ model, prompt, key }) => ({ imageUrl: await callGoogleImage({ apiKey: key, model, prompt }) }),
  },
  openai: createOpenAICompatibleAdapter("openai"),
  ali: createOpenAICompatibleAdapter("ali"),
  byte: createOpenAICompatibleAdapter("byte"),
  minimax: createOpenAICompatibleAdapter("minimax"),
  zhipu: createOpenAICompatibleAdapter("zhipu"),
};

const getProviderAdapter = (provider) => {
  const adapter = PROVIDER_ADAPTERS?.[provider];
  if (!adapter) throw Object.assign(new Error(`未实现厂商适配器: ${provider}`), { status: 500 });
  return adapter;
};

const isRetryableStatus = (status) => status === 429 || (status >= 500 && status < 600);

const runWithProviderFallback = async ({ taskType, requestedModel, run }) => {
  const { candidates, fallbackModel } = resolveTaskConfig(taskType, requestedModel);
  const retryCount = Number(routingConfig?.policy?.maxRetries ?? 2);
  const cooldownMs = Number(routingConfig?.policy?.cooldownMs ?? 60000);

  let lastError = null;
  const errors = [];

  for (const candidate of candidates) {
    const provider = candidate.provider;
    const model = candidate.model || fallbackModel;
    const creds = providerCredentials[provider] || { keys: [], baseUrl: "" };

    if (!providerUsable(provider)) continue;

    for (let i = 0; i <= retryCount; i++) {
      const key = pickKey(provider);
      if (!key) break;

      try {
        const result = await run({ provider, model, key, baseUrl: creds.baseUrl });
        return { provider, model, result };
      } catch (error) {
        lastError = error;
        errors.push({
          provider,
          model,
          status: Number(error?.status || 0),
          message: error instanceof Error ? error.message : String(error || "Unknown"),
        });
        const status = Number(error?.status || 0);
        if (isRetryableStatus(status)) {
          cooldownKey(provider, key, cooldownMs);
          continue;
        }
        break;
      }
    }
  }

  if (lastError) {
    const compact = errors
      .slice(-5)
      .map((e) => `${e.provider}/${e.model}:${e.status || "-"} ${String(e.message || "").slice(0, 80)}`)
      .join(" | ");
    const merged = Object.assign(
      new Error(`模型路由失败。最近尝试: ${compact || "无"}`),
      { status: Number(lastError?.status || 500) }
    );
    throw merged;
  }
  throw Object.assign(new Error("没有可用的厂商或 Key，请检查 Vercel 环境变量"), { status: 500 });
};

const runTextChat = async ({ model, messages }) => {
  return runWithProviderFallback({
    taskType: "text",
    requestedModel: model,
    run: async ({ provider, model: resolvedModel, key, baseUrl }) =>
      getProviderAdapter(provider).chat({
        provider,
        model: resolveRuntimeModel(provider, resolvedModel),
        messages,
        key,
        baseUrl,
      }),
  });
};

const runTextGenerate = async ({ model, contents, config, messages }) => {
  return runWithProviderFallback({
    taskType: "text",
    requestedModel: model,
    run: async ({ provider, model: resolvedModel, key, baseUrl }) =>
      getProviderAdapter(provider).generate({
        provider,
        model: resolveRuntimeModel(provider, resolvedModel),
        contents,
        config,
        messages,
        key,
        baseUrl,
      }),
  });
};

const runImageGenerate = async ({ model, prompt }) => {
  return runWithProviderFallback({
    taskType: "image",
    requestedModel: model,
    run: async ({ provider, model: resolvedModel, key, baseUrl }) =>
      getProviderAdapter(provider).image({
        provider,
        model: resolveRuntimeModel(provider, resolvedModel),
        prompt,
        key,
        baseUrl,
      }),
  });
};

const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
};

const flattenModels = (taskType, options = {}) => {
  const section = routingConfig?.[taskType] || {};
  const onlyUsable = options.onlyUsable !== false;
  const result = [];
  const providerByModel = {};
  const byProvider = {};
  const providerOrder = Array.isArray(section.providerOrder) ? section.providerOrder : [];

  for (const provider of providerOrder) {
    if (!providerEnabled(provider)) continue;
    if (onlyUsable && !providerUsable(provider)) continue;

    const list = Array.isArray(section?.models?.[provider]) ? section.models[provider] : [];
    if (!Array.isArray(byProvider[provider])) byProvider[provider] = [];

    for (const model of list) {
      if (!result.includes(model)) result.push(model);
      providerByModel[model] = provider;
      if (!byProvider[provider].includes(model)) byProvider[provider].push(model);
    }
  }

  return { list: result, providerByModel, byProvider, providerOrder };
};

const pickDefaultModel = (taskType, allCatalog, usableCatalog) => {
  const configured = routingConfig?.[taskType]?.defaultModel || null;
  if (configured && allCatalog?.list?.includes(configured)) {
    const provider = inferProviderByModel(taskType, configured);
    if (!provider || providerUsable(provider)) return configured;
  }
  return usableCatalog?.list?.[0] || configured || allCatalog?.list?.[0] || null;
};

const healthPayload = () => {
  const providers = {};
  for (const provider of Object.keys(PROVIDER_ENV)) {
    const creds = providerCredentials?.[provider] || { keys: [], baseUrl: "" };
    providers[provider] = {
      enabled: providerEnabled(provider),
      ready: providerUsable(provider),
      hasKey: Boolean((creds.keys || []).length),
      hasBaseUrl: providerNeedsBaseUrl(provider) ? Boolean(creds.baseUrl) : true,
    };
  }

  const textAll = flattenModels("text", { onlyUsable: false });
  const imageAll = flattenModels("image", { onlyUsable: false });
  const text = flattenModels("text", { onlyUsable: true });
  const image = flattenModels("image", { onlyUsable: true });

  return {
    ok: true,
    providers,
    defaults: {
      textModel: pickDefaultModel("text", textAll, text),
      imageModel: pickDefaultModel("image", imageAll, image),
    },
  };
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  maybePruneRateLimitState();

  try {
    const actionFromGet = req.query?.action || "health";
    const bodyFromPost = req.method === "POST" ? parseBody(req) : {};
    const actionFromPost = bodyFromPost.action || "health";
    const action = req.method === "POST" ? actionFromPost : actionFromGet;

    if (!isAuthorized(req)) {
      res.status(401).json({ ok: false, error: "Unauthorized" });
      return;
    }

    const rate = checkRateLimit(req, action);
    setRateLimitHeaders(res, rate);
    if (!rate.ok) {
      res.status(429).json({
        ok: false,
        error: `Rate limit exceeded (${RATE_LIMIT_RPM}/min)`,
      });
      return;
    }

    if (req.method === "GET") {
      if (action === "models") {
        const text = flattenModels("text", { onlyUsable: false });
        const image = flattenModels("image", { onlyUsable: false });
        const textUsable = flattenModels("text", { onlyUsable: true });
        const imageUsable = flattenModels("image", { onlyUsable: true });
        const health = healthPayload();

        res.status(200).json({
          ok: true,
          textModels: text.list,
          imageModels: image.list,
          providerByModel: { ...text.providerByModel, ...image.providerByModel },
          textModelsByProvider: text.byProvider,
          imageModelsByProvider: image.byProvider,
          providerOrder: {
            text: text.providerOrder,
            image: image.providerOrder,
          },
          available: {
            textModels: textUsable.list,
            imageModels: imageUsable.list,
          },
          providers: health.providers,
          defaults: {
            textModel: pickDefaultModel("text", text, textUsable),
            imageModel: pickDefaultModel("image", image, imageUsable),
          },
        });
        return;
      }

      res.status(200).json(healthPayload());
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method Not Allowed" });
      return;
    }

    const body = bodyFromPost;

    if (action === "health" || action === "validate") {
      res.status(200).json(healthPayload());
      return;
    }

    if (action === "chat") {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const execution = await runTextChat({ model: body.model, messages });
      res.status(200).json({
        ok: true,
        provider: execution.provider,
        model: execution.model,
        text: execution.result?.text || "",
      });
      return;
    }

    if (action === "generate") {
      const execution = await runTextGenerate({
        model: body.model,
        contents: body.contents ?? messageText(body.messages || []),
        config: body.config || {},
        messages: body.messages || [],
      });

      const text = execution.result?.text || "";
      res.status(200).json({
        ok: true,
        provider: execution.provider,
        model: execution.model,
        text,
        candidates: [
          {
            content: {
              parts: [{ text }],
            },
          },
        ],
      });
      return;
    }

    if (action === "image") {
      const prompt = body.prompt || "";
      if (!prompt) {
        res.status(400).json({ ok: false, error: "prompt is required" });
        return;
      }

      const execution = await runImageGenerate({ model: body.model, prompt });
      res.status(200).json({
        ok: true,
        provider: execution.provider,
        model: execution.model,
        imageUrl: execution.result?.imageUrl,
      });
      return;
    }

    res.status(400).json({ ok: false, error: `Unsupported action: ${action}` });
  } catch (error) {
    const status = Number(error?.status || 500);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(status >= 400 && status < 600 ? status : 500).json({ ok: false, error: message });
  }
}
