// ==========================================
// 基础设施层 (Infrastructure Layer)
// 职责: 统一通过后端 API 网关执行所有模型请求
// ==========================================

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");

// --- Model Catalog ---
const DEFAULT_PROVIDER_ORDER = {
    text: ["openai", "google", "ali", "byte", "minimax", "zhipu"],
    image: ["openai", "google", "byte", "ali", "minimax", "zhipu"],
};

const DEFAULT_TEXT_MODELS_BY_PROVIDER: Record<string, string[]> = {
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
};

const DEFAULT_IMAGE_MODELS_BY_PROVIDER: Record<string, string[]> = {
    openai: ["gpt-image-1", "dall-e-3", "dall-e-2"],
    google: ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"],
    byte: ["doubao-seedream-4-0-250828", "doubao-seedream-3-0-t2i-250415", "doubao-seedream-5-0-lite", "doubao-seedream-4-5"],
    ali: ["wan2.2-t2i-plus", "wan2.2-t2i-flash", "wanx2.1-t2i-plus"],
    minimax: ["image-01"],
    zhipu: ["glm-image", "cogview-4", "cogview-3-flash"],
};

const cloneModelsByProvider = (input: Record<string, string[]>) => {
    const output: Record<string, string[]> = {};
    for (const [provider, models] of Object.entries(input)) {
        output[provider] = Array.isArray(models) ? [...models] : [];
    }
    return output;
};

const flattenByProvider = (input: Record<string, string[]>, providerOrder: string[]) => {
    const output: string[] = [];
    for (const provider of providerOrder) {
        const models = Array.isArray(input[provider]) ? input[provider] : [];
        for (const model of models) {
            if (!output.includes(model)) output.push(model);
        }
    }
    return output;
};

const makeProviderByModel = (...catalogs: Array<Record<string, string[]>>) => {
    const output: Record<string, string> = {};
    for (const catalog of catalogs) {
        for (const [provider, models] of Object.entries(catalog)) {
            for (const model of models || []) {
                output[model] = provider;
            }
        }
    }
    return output;
};

const normalizeProviderOrder = (input: any, fallback: string[]) => {
    if (!Array.isArray(input)) return [...fallback];
    const seen = new Set<string>();
    const output: string[] = [];
    for (const item of input) {
        const provider = String(item || "").trim();
        if (!provider || seen.has(provider)) continue;
        seen.add(provider);
        output.push(provider);
    }
    return output.length ? output : [...fallback];
};

const DEFAULT_TEXT_MODELS = flattenByProvider(DEFAULT_TEXT_MODELS_BY_PROVIDER, DEFAULT_PROVIDER_ORDER.text);
const DEFAULT_IMAGE_MODELS = flattenByProvider(DEFAULT_IMAGE_MODELS_BY_PROVIDER, DEFAULT_PROVIDER_ORDER.image);

const DEFAULT_TEXT_MODEL = "gpt-5.1";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

type ModelPreferences = {
    textModel: string;
    imageModel: string;
};

export type ProviderRuntimeStatus = {
    enabled?: boolean;
    configured?: boolean;
    validated?: boolean;
    ready?: boolean;
    hasKey?: boolean;
    hasBaseUrl?: boolean;
    lastValidatedAt?: string | null;
    lastValidationError?: string;
    lastValidationStatus?: number;
};

export type AvailableModelsCatalog = {
    textModels: string[];
    imageModels: string[];
    textModelsByProvider: Record<string, string[]>;
    imageModelsByProvider: Record<string, string[]>;
    providerByModel: Record<string, string>;
    providerOrder: {
        text: string[];
        image: string[];
    };
    providers: Record<string, ProviderRuntimeStatus>;
};

export type DirectorPlanRequest = {
    userIdea: string;
    analysis?: any;
    creativeBrief?: any;
    tension?: string;
    model?: string;
};

export type DirectorPlanResponse = {
    plan: any;
    directorPacket?: any;
    provider?: string;
    model?: string;
};

export type RandomPromptRequest = {
    mode?: "fast" | "pro" | "basic";
    tensionLevel?: "low" | "medium" | "high";
    castPreference?: "asian_girl_23_plus" | "asian_woman_23_plus";
    targetLength?: number;
    contactSheetCount?: number;
    sequenceLength?: number;
    sequenceIndex?: number;
};

export type RandomPromptResponse = {
    prompt: string;
    shotInstruction?: string;
    failureForecast?: Array<{ risk: string; mitigation: string }>;
    metadata?: Record<string, any>;
};

export type RandomPromptPairwiseFeedback = {
    better?: Record<string, any>;
    worse?: Record<string, any>;
};

const readLS = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    const value = localStorage.getItem(key);
    return value || fallback;
};

const writeLS = (key: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
};

let availableTextModels = [...DEFAULT_TEXT_MODELS];
let availableImageModels = [...DEFAULT_IMAGE_MODELS];
const DEFAULT_PROVIDER_BY_MODEL: Record<string, string> = makeProviderByModel(
    DEFAULT_TEXT_MODELS_BY_PROVIDER,
    DEFAULT_IMAGE_MODELS_BY_PROVIDER
);
let providerByModel: Record<string, string> = { ...DEFAULT_PROVIDER_BY_MODEL };
let textModelsByProvider: Record<string, string[]> = cloneModelsByProvider(DEFAULT_TEXT_MODELS_BY_PROVIDER);
let imageModelsByProvider: Record<string, string[]> = cloneModelsByProvider(DEFAULT_IMAGE_MODELS_BY_PROVIDER);
let modelProviderOrder = {
    text: [...DEFAULT_PROVIDER_ORDER.text],
    image: [...DEFAULT_PROVIDER_ORDER.image],
};
let providerStatusByName: Record<string, ProviderRuntimeStatus> = {};

let selectedTextModel = readLS("studio_text_model", DEFAULT_TEXT_MODEL);
let selectedImageModel = readLS("studio_image_model", DEFAULT_IMAGE_MODEL);

// 可选: 网关鉴权令牌 (对应后端 AI_GATEWAY_TOKEN)
let gatewayToken = "";

const persistModelPrefs = () => {
    writeLS("studio_text_model", selectedTextModel);
    writeLS("studio_image_model", selectedImageModel);
};

const normalizeModel = (model: string) => model.trim().toLowerCase();

const inferProviderByModelName = (model: string): string => {
    const normalized = normalizeModel(model);
    if (!normalized) return "unknown";
    if (normalized.startsWith("gemini")) return "google";
    if (normalized.startsWith("gpt") || normalized.startsWith("dall-e")) return "openai";
    if (normalized.includes("qwen") || normalized.startsWith("wan")) return "ali";
    if (normalized.includes("doubao") || normalized.includes("seedream")) return "byte";
    if (normalized.includes("minimax") || normalized === "image-01") return "minimax";
    if (normalized.includes("glm") || normalized.includes("cogview")) return "zhipu";
    return "unknown";
};

const normalizeModelsByProvider = (input: any): Record<string, string[]> => {
    if (!input || typeof input !== "object") return {};
    const output: Record<string, string[]> = {};

    for (const [provider, models] of Object.entries(input as Record<string, unknown>)) {
        if (!Array.isArray(models)) continue;
        const unique = new Set<string>();
        for (const item of models) {
            const model = String(item || "").trim();
            if (!model) continue;
            unique.add(model);
        }
        if (unique.size > 0) output[provider] = [...unique];
    }

    return output;
};

const buildModelsByProvider = (
    models: string[],
    modelToProvider: Record<string, string>,
    providerOrder: string[] = []
): Record<string, string[]> => {
    const output: Record<string, string[]> = {};
    for (const provider of providerOrder) output[provider] = [];

    for (const model of models) {
        const provider = modelToProvider[model] || inferProviderByModelName(model);
        if (!provider || provider === "unknown") continue;
        if (!Array.isArray(output[provider])) output[provider] = [];
        if (!output[provider].includes(model)) output[provider].push(model);
    }

    for (const [provider, list] of Object.entries(output)) {
        if (!Array.isArray(list) || list.length === 0) delete output[provider];
    }

    return output;
};

const resolveProviderByModel = (model: string): string => {
    if (providerByModel[model]) return providerByModel[model];
    return inferProviderByModelName(model);
};

const providerLabel = (provider: string) => {
    switch (provider) {
        case "openai":
            return "开放智能";
        case "google":
            return "谷歌";
        case "ali":
            return "阿里";
        case "byte":
            return "字节";
        case "minimax":
            return "海螺";
        case "zhipu":
            return "智谱";
        default:
            return provider || "未知厂商";
    }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    baseDelay: number = 1000,
    signal?: AbortSignal
): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        if (signal?.aborted) throw new Error("Aborted");
        try {
            return await operation();
        } catch (e: any) {
            if (signal?.aborted || e.name === "AbortError") throw new Error("Aborted");
            lastError = e;
            const errMsg = (e.message || "").toLowerCase();
            const status = Number(e?.status || 0);
            const isRateLimit =
                status === 429 ||
                errMsg.includes("429") ||
                errMsg.includes("quota") ||
                errMsg.includes("resource_exhausted");
            const isFatal =
                status === 400 ||
                status === 401 ||
                status === 403 ||
                errMsg.includes("invalid argument") ||
                errMsg.includes("authentication") ||
                errMsg.includes("unauthorized");

            if (isFatal) throw e;

            if (i < retries - 1) {
                let delay = baseDelay * Math.pow(2, i);
                if (isRateLimit) delay = delay * 1.5 + Math.random() * 2000;
                await wait(delay);
            }
        }
    }
    throw lastError;
}

export const withTimeout = async <T>(promise: Promise<T>, ms: number, errorMsg: string, signal?: AbortSignal): Promise<T> => {
    let timer: any = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    });
    const abortPromise = new Promise<T>((_, reject) => {
        if (signal) {
            signal.addEventListener("abort", () => {
                clearTimeout(timer);
                reject(new Error("Aborted"));
            });
        }
    });

    try {
        const result = await Promise.race([promise, timeoutPromise, ...(signal ? [abortPromise] : [])]);
        clearTimeout(timer);
        return result;
    } catch (e) {
        if (timer) clearTimeout(timer);
        throw e;
    }
};

const apiUrl = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

const withGatewayHeaders = (headers: Record<string, string> = {}) => {
    const merged: Record<string, string> = { ...headers };
    if (gatewayToken) {
        merged["x-gateway-token"] = gatewayToken;
        merged.Authorization = `Bearer ${gatewayToken}`;
    }
    return merged;
};

async function callBackend(payload: any, signal?: AbortSignal) {
    const response = await fetch(apiUrl("/api/ai"), {
        method: "POST",
        headers: withGatewayHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        signal,
    });

    const text = await response.text();
    let data: any = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { ok: false, error: text || "响应解析失败" };
    }

    if (!response.ok || data?.ok === false) {
        throw Object.assign(new Error(data?.error || `后端错误 ${response.status}`), {
            status: response.status,
            traceId: data?.traceId || "",
        });
    }

    return data;
}

const validateGatewayHealth = async () => {
    const response = await fetch(apiUrl("/api/ai?action=health"), {
        headers: withGatewayHeaders(),
    });
    const text = await response.text();
    let data: any = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }
    if (!response.ok) {
        if (response.status === 401) {
            throw new Error("后端健康检查鉴权失败（401）：如不需要鉴权，请将 AI_GATEWAY_REQUIRE_TOKEN 设为 0（或删除）；如已开启鉴权，请填写网关令牌。");
        }
        const backendError = String(data?.error || "").trim();
        throw new Error(`后端健康检查错误: ${response.status}${backendError ? ` (${backendError})` : ""}`);
    }
    if (data?.ok === false) throw new Error(data?.error || "后端健康检查失败");

    const providers = Object.values(data?.providers || {});
    const hasConfiguredProvider = providers.some((item: any) => Boolean(item?.configured));
    if (!hasConfiguredProvider) {
        throw new Error("后端网关可达，但未配置任何可用模型 Key");
    }

    return data;
};

export const Infrastructure = {
    setApiKey: (key: string | null) => {
        gatewayToken = (key || "").trim();
    },

    getApiKey: () => gatewayToken,

    isBackendEnabled: () => true,

    setModelPreferences: (prefs: Partial<ModelPreferences>) => {
        if (prefs.textModel) selectedTextModel = prefs.textModel;
        if (prefs.imageModel) selectedImageModel = prefs.imageModel;
        persistModelPrefs();
    },

    getModelPreferences: (): ModelPreferences => ({
        textModel: selectedTextModel,
        imageModel: selectedImageModel,
    }),

    getAvailableModels: (): AvailableModelsCatalog => ({
        textModels: [...availableTextModels],
        imageModels: [...availableImageModels],
        textModelsByProvider: cloneModelsByProvider(textModelsByProvider),
        imageModelsByProvider: cloneModelsByProvider(imageModelsByProvider),
        providerByModel: { ...providerByModel },
        providerOrder: {
            text: [...modelProviderOrder.text],
            image: [...modelProviderOrder.image],
        },
        providers: { ...providerStatusByName },
    }),

    refreshModels: async () => {
        try {
            const response = await fetch(apiUrl("/api/ai?action=models"), {
                headers: withGatewayHeaders(),
            });
            if (!response.ok) throw new Error(`模型目录请求失败: ${response.status}`);
            const data = await response.json();
            const usableTextModels = Array.isArray(data?.available?.textModels) ? data.available.textModels : [];
            const usableImageModels = Array.isArray(data?.available?.imageModels) ? data.available.imageModels : [];
            const preferUsableCatalog = usableTextModels.length > 0 || usableImageModels.length > 0;

            if (usableTextModels.length > 0) {
                availableTextModels = usableTextModels;
            } else if (Array.isArray(data?.textModels) && data.textModels.length > 0) {
                availableTextModels = data.textModels;
            }
            if (usableImageModels.length > 0) {
                availableImageModels = usableImageModels;
            } else if (Array.isArray(data?.imageModels) && data.imageModels.length > 0) {
                availableImageModels = data.imageModels;
            }
            modelProviderOrder = {
                text: normalizeProviderOrder(data?.providerOrder?.text, modelProviderOrder.text),
                image: normalizeProviderOrder(data?.providerOrder?.image, modelProviderOrder.image),
            };
            if (data?.providerByModel && typeof data.providerByModel === "object") {
                providerByModel = { ...providerByModel, ...data.providerByModel };
            } else {
                const inferred: Record<string, string> = {};
                [...availableTextModels, ...availableImageModels].forEach((model) => {
                    inferred[model] = inferProviderByModelName(model);
                });
                providerByModel = { ...providerByModel, ...inferred };
            }

            const textByProviderFromApi = normalizeModelsByProvider(data?.textModelsByProvider);
            const imageByProviderFromApi = normalizeModelsByProvider(data?.imageModelsByProvider);
            textModelsByProvider =
                preferUsableCatalog
                    ? buildModelsByProvider(availableTextModels, providerByModel, modelProviderOrder.text)
                    : Object.keys(textByProviderFromApi).length > 0
                    ? textByProviderFromApi
                    : buildModelsByProvider(availableTextModels, providerByModel, modelProviderOrder.text);
            imageModelsByProvider =
                preferUsableCatalog
                    ? buildModelsByProvider(availableImageModels, providerByModel, modelProviderOrder.image)
                    : Object.keys(imageByProviderFromApi).length > 0
                    ? imageByProviderFromApi
                    : buildModelsByProvider(availableImageModels, providerByModel, modelProviderOrder.image);

            if (data?.providers && typeof data.providers === "object") {
                providerStatusByName = {};
                for (const [provider, status] of Object.entries(data.providers as Record<string, unknown>)) {
                    if (!status || typeof status !== "object") continue;
                    providerStatusByName[provider] = status as ProviderRuntimeStatus;
                }
            }

            if (typeof data?.defaults?.textModel === "string" && !readLS("studio_text_model", "")) {
                selectedTextModel = data.defaults.textModel;
            }
            if (typeof data?.defaults?.imageModel === "string" && !readLS("studio_image_model", "")) {
                selectedImageModel = data.defaults.imageModel;
            }
            if (!availableTextModels.includes(selectedTextModel)) {
                selectedTextModel = availableTextModels[0] || DEFAULT_TEXT_MODEL;
            }
            if (!availableImageModels.includes(selectedImageModel)) {
                selectedImageModel = availableImageModels[0] || DEFAULT_IMAGE_MODEL;
            }
            persistModelPrefs();
        } catch {
            // 静默兜底，保留本地默认模型表
        }

        return Infrastructure.getAvailableModels();
    },

    getStatus: () => {
        const textProvider = resolveProviderByModel(selectedTextModel);
        const imageProvider = resolveProviderByModel(selectedImageModel);
        return {
            mode: "gateway",
            label: `后端网关 · 文本:${providerLabel(textProvider)} · 生图:${providerLabel(imageProvider)}`,
            provider: "后端网关",
            textModel: selectedTextModel,
            imageModel: selectedImageModel,
        };
    },

    routeRequest: async (model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> => {
        const targetModel = model || selectedTextModel;
        const data = await withRetry(
            () => callBackend({ action: "chat", model: targetModel, messages }, signal),
            3,
            1000,
            signal
        );

        const fullText = String(data?.text || "");
        if (onChunk && fullText) {
            let acc = "";
            for (let i = 0; i < fullText.length; i += 80) {
                acc = fullText.slice(0, i + 80);
                onChunk(acc);
            }
        }

        return fullText;
    },

    generateDirectorPlan: async (
        payload: DirectorPlanRequest,
        onChunk?: (text: string) => void,
        signal?: AbortSignal
    ): Promise<DirectorPlanResponse> => {
        const userIdea = String(payload?.userIdea || "").trim();
        if (!userIdea) throw new Error("缺少用户创意输入");

        const targetModel = payload?.model || selectedTextModel;
        const data = await withRetry(
            () =>
                callBackend(
                    {
                        action: "director_plan",
                        model: targetModel,
                        userIdea,
                        tension: payload?.tension || "dramatic",
                        analysis: payload?.analysis || {},
                        creativeBrief: payload?.creativeBrief || {},
                    },
                    signal
                ),
            3,
            1200,
            signal
        );

        if (!data?.plan) throw new Error("后端未返回导演计划");

        if (onChunk) {
            const progress = [
                `[导演域] 厂商: ${data.provider || "未知"}`,
                `[导演域] 模型: ${data.model || targetModel}`,
                `[导演域] 计划已就绪`,
            ].join("\n");
            onChunk(progress);
        }

        return {
            plan: data.plan,
            directorPacket: data.directorPacket,
            provider: data.provider,
            model: data.model,
        };
    },

    generateRandomPrompt: async (payload: RandomPromptRequest = {}, signal?: AbortSignal): Promise<RandomPromptResponse> => {
        const targetLength = Number(payload?.targetLength);
        const contactSheetCount = Number(payload?.contactSheetCount);
        const sequenceLength = Number(payload?.sequenceLength);
        const sequenceIndex = Number(payload?.sequenceIndex);
        const data = await withRetry(
            () =>
                callBackend(
                    {
                        action: "random_prompt",
                        mode: payload?.mode || "pro",
                        tensionLevel: payload?.tensionLevel || "medium",
                        castPreference: payload?.castPreference || "asian_girl_23_plus",
                        targetLength: Number.isFinite(targetLength) ? Math.floor(targetLength) : 200,
                        contactSheetCount: Number.isFinite(contactSheetCount) ? Math.floor(contactSheetCount) : undefined,
                        sequenceLength: Number.isFinite(sequenceLength) ? Math.floor(sequenceLength) : undefined,
                        sequenceIndex: Number.isFinite(sequenceIndex) ? Math.floor(sequenceIndex) : undefined,
                    },
                    signal
                ),
            3,
            1000,
            signal
        );

        const prompt = String(data?.prompt || "").trim();
        if (!prompt) throw new Error("后端未返回随机提示词");

        return {
            prompt,
            shotInstruction: String(data?.shotInstruction || "").trim() || prompt,
            failureForecast: Array.isArray(data?.failureForecast) ? data.failureForecast : [],
            metadata: data?.metadata && typeof data.metadata === "object" ? data.metadata : {},
        };
    },

    submitRandomPromptPairwiseFeedback: async (
        payload: RandomPromptPairwiseFeedback,
        signal?: AbortSignal
    ): Promise<Record<string, any>> => {
        const data = await callBackend(
            {
                action: "random_prompt_feedback",
                better: payload?.better || {},
                worse: payload?.worse || {},
            },
            signal
        );
        return data?.memory && typeof data.memory === "object" ? data.memory : {};
    },

    withTimeout,

    runWithRetry: async <T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
        return withRetry(operation, 5, 2000, signal);
    },

    validate: async (key: string, logger?: (msg: string) => void): Promise<"pro" | "flash"> => {
        if (key?.trim()) gatewayToken = key.trim();

        if (logger) logger("正在连接后端网关...");
        await withTimeout(validateGatewayHealth(), 30000, "连接超时");
        if (logger) logger("✅ 后端网关握手成功");
        return "pro";
    },

    generateImage: async (prompt: string, modelType: "pro" | "flash", signal?: AbortSignal): Promise<string> => {
        if (signal?.aborted) throw new Error("Aborted");

        const fallbackModel = modelType === "pro" ? "gemini-3-pro-image-preview" : "gemini-2.5-flash-image";
        const data = await withRetry(
            () =>
                callBackend(
                    {
                        action: "image",
                        model: selectedImageModel || fallbackModel,
                        modelType,
                        prompt,
                    },
                    signal
                ),
            3,
            1200,
            signal
        );
        if (!data?.imageUrl) throw new Error("后端未返回图片数据");
        return data.imageUrl;
    },
};

// DDD 命名升级：GatewayClient 更贴近职责语义；保留 Infrastructure 兼容旧调用方。
export const GatewayClient = Infrastructure;
