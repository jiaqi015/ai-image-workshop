import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

const DEFAULT_ROUTING = {
  policy: {
    keyStrategy: "round_robin",
    cooldownMs: 60000,
    maxRetries: 2,
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
    providerOrder: ["openai", "google"],
    models: {
      openai: ["gpt-5.1"],
      google: ["gemini-2.5-flash"],
    },
    defaultModel: "gpt-5.1",
  },
  image: {
    providerOrder: ["openai", "google"],
    models: {
      openai: ["gpt-image-1"],
      google: ["gemini-3-pro-image-preview"],
    },
    defaultModel: "gpt-image-1",
  },
};

const PROVIDER_ENV = {
  openai: {
    keyVars: ["OPENAI_KEYS", "OPENAI_API_KEY"],
    baseVars: ["OPENAI_BASE_URL", "PROXY_BASE_URL"],
    defaultBase: "https://api.openai.com/v1",
  },
  google: {
    keyVars: ["GOOGLE_KEYS", "GEMINI_KEYS", "GEMINI_API_KEY", "GOOGLE_API_KEY"],
    baseVars: ["GOOGLE_BASE_URL"],
  },
  ali: {
    keyVars: ["ALI_KEYS", "ALI_API_KEY"],
    baseVars: ["ALI_BASE_URL"],
  },
  byte: {
    keyVars: ["BYTE_KEYS", "BYTE_API_KEY", "DOUBAO_KEYS", "DOUBAO_API_KEY"],
    baseVars: ["BYTE_BASE_URL", "DOUBAO_BASE_URL"],
  },
  minimax: {
    keyVars: ["MINIMAX_KEYS", "MINIMAX_API_KEY"],
    baseVars: ["MINIMAX_BASE_URL"],
  },
  zhipu: {
    keyVars: ["ZHIPU_KEYS", "ZHIPU_API_KEY"],
    baseVars: ["ZHIPU_BASE_URL"],
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

  for (const [provider, models] of Object.entries(modelsByProvider)) {
    if (Array.isArray(models) && models.includes(model)) return provider;
  }

  if (String(model).startsWith("gemini")) return "google";
  if (String(model).startsWith("gpt")) return "openai";

  return null;
};

const resolveTaskConfig = (taskType, requestedModel) => {
  const section = routingConfig?.[taskType] || {};
  const providerOrder = Array.isArray(section.providerOrder) ? section.providerOrder : [];
  const modelsByProvider = section.models || {};

  const requestedProvider = requestedModel ? inferProviderByModel(taskType, requestedModel) : null;

  const providers = [];
  if (requestedProvider) providers.push(requestedProvider);
  for (const p of providerOrder) {
    if (!providers.includes(p)) providers.push(p);
  }

  const candidates = providers
    .filter((provider) => providerEnabled(provider))
    .map((provider) => {
      const providerModels = Array.isArray(modelsByProvider[provider]) ? modelsByProvider[provider] : [];
      const model = requestedProvider === provider && requestedModel ? requestedModel : providerModels[0];
      return { provider, model };
    })
    .filter((c) => Boolean(c.model));

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

const callOpenAICompatibleChat = async ({ baseUrl, apiKey, model, messages }) => {
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
    throw Object.assign(new Error(`Chat Error ${response.status}: ${txt.slice(0, 220)}`), { status: response.status });
  }

  const data = await response.json();
  return {
    text: data?.choices?.[0]?.message?.content || "",
    raw: data,
  };
};

const callOpenAICompatibleImage = async ({ baseUrl, apiKey, model, prompt }) => {
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
    throw Object.assign(new Error(`Image Error ${response.status}: ${txt.slice(0, 220)}`), { status: response.status });
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

const isRetryableStatus = (status) => status === 429 || (status >= 500 && status < 600);

const runWithProviderFallback = async ({ taskType, requestedModel, run }) => {
  const { candidates, fallbackModel } = resolveTaskConfig(taskType, requestedModel);
  const retryCount = Number(routingConfig?.policy?.maxRetries ?? 2);
  const cooldownMs = Number(routingConfig?.policy?.cooldownMs ?? 60000);

  let lastError = null;

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
        const status = Number(error?.status || 0);
        if (isRetryableStatus(status)) {
          cooldownKey(provider, key, cooldownMs);
          continue;
        }
        break;
      }
    }
  }

  if (lastError) throw lastError;
  throw Object.assign(new Error("没有可用的厂商或 Key，请检查 Vercel 环境变量"), { status: 500 });
};

const runTextChat = async ({ model, messages }) => {
  return runWithProviderFallback({
    taskType: "text",
    requestedModel: model,
    run: async ({ provider, model: resolvedModel, key, baseUrl }) => {
      if (provider === "google") return callGoogleChat({ apiKey: key, model: resolvedModel, messages });
      return callOpenAICompatibleChat({ baseUrl, apiKey: key, model: resolvedModel, messages });
    },
  });
};

const runTextGenerate = async ({ model, contents, config, messages }) => {
  return runWithProviderFallback({
    taskType: "text",
    requestedModel: model,
    run: async ({ provider, model: resolvedModel, key, baseUrl }) => {
      if (provider === "google") {
        return callGoogleGenerate({ apiKey: key, model: resolvedModel, contents, config });
      }
      const prompt = typeof contents === "string" ? contents : messageText(messages || [{ role: "user", content: contents }]);
      return callOpenAICompatibleChat({
        baseUrl,
        apiKey: key,
        model: resolvedModel,
        messages: [{ role: "user", content: prompt }],
      });
    },
  });
};

const runImageGenerate = async ({ model, prompt }) => {
  return runWithProviderFallback({
    taskType: "image",
    requestedModel: model,
    run: async ({ provider, model: resolvedModel, key, baseUrl }) => {
      if (provider === "google") return { imageUrl: await callGoogleImage({ apiKey: key, model: resolvedModel, prompt }) };
      return { imageUrl: await callOpenAICompatibleImage({ baseUrl, apiKey: key, model: resolvedModel, prompt }) };
    },
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

const flattenModels = (taskType) => {
  const section = routingConfig?.[taskType] || {};
  const result = [];
  const providerByModel = {};

  for (const provider of section.providerOrder || []) {
    if (!providerUsable(provider)) continue;
    const list = Array.isArray(section?.models?.[provider]) ? section.models[provider] : [];
    for (const model of list) {
      if (!result.includes(model)) result.push(model);
      providerByModel[model] = provider;
    }
  }

  return { list: result, providerByModel };
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

  const text = flattenModels("text");
  const image = flattenModels("image");

  return {
    ok: true,
    providers,
    defaults: {
      textModel: routingConfig?.text?.defaultModel || text.list[0] || null,
      imageModel: routingConfig?.image?.defaultModel || image.list[0] || null,
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
        const text = flattenModels("text");
        const image = flattenModels("image");

        res.status(200).json({
          ok: true,
          textModels: text.list,
          imageModels: image.list,
          providerByModel: { ...text.providerByModel, ...image.providerByModel },
          defaults: {
            textModel: routingConfig?.text?.defaultModel || text.list[0] || null,
            imageModel: routingConfig?.image?.defaultModel || image.list[0] || null,
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
