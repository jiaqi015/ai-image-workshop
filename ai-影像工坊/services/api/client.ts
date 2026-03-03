import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// ==========================================
// 基础设施层 (Infrastructure Layer)
// 职责: 统一路由到后端 API (Vercel Functions)
//      并保留本地直连兜底模式（用于纯前端开发调试）
// ==========================================

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || "").replace(/\/$/, "");
const USE_BACKEND_BY_DEFAULT = (((import.meta as any).env?.VITE_USE_BACKEND ?? "1") as string) !== "0";
const LEGACY_PROXY_BASE = ((import.meta as any).env?.VITE_PROXY_BASE_URL || "https://xh.v1api.cc/v1").replace(/\/$/, "");

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

const readLS = (key: string, fallback: string) => {
    if (typeof window === "undefined") return fallback;
    const value = localStorage.getItem(key);
    return value || fallback;
};

const writeLS = (key: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
};

let backendEnabled = USE_BACKEND_BY_DEFAULT;
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

// 仅用于本地兜底模式（纯前端直连）
let storedKey = "";

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

const getModeFromModels = (): "proxy" | "direct" => {
    const textProvider = resolveProviderByModel(selectedTextModel);
    const imageProvider = resolveProviderByModel(selectedImageModel);
    const isGoogleOnly = textProvider === "google" && imageProvider === "google";
    return isGoogleOnly ? "direct" : "proxy";
};

const firstModelByProvider = (models: string[], provider: string, fallback: string) => {
    const hit = models.find((m) => resolveProviderByModel(m) === provider);
    return hit || fallback;
};

const firstModelByFamily = (models: string[], family: "google" | "non_google", fallback: string) => {
    const hit = models.find((m) => {
        const provider = resolveProviderByModel(m);
        return family === "google" ? provider === "google" : provider !== "google";
    });
    return hit || fallback;
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
            const isRateLimit =
                e.status === 429 ||
                errMsg.includes("429") ||
                errMsg.includes("quota") ||
                errMsg.includes("resource_exhausted");
            const isFatal = errMsg.includes("invalid argument") || errMsg.includes("authentication");

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
    if (storedKey) {
        merged["x-gateway-token"] = storedKey;
        merged.Authorization = `Bearer ${storedKey}`;
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
        throw new Error(data?.error || `后端错误 ${response.status}`);
    }

    return data;
}

interface IGenAIProvider {
    generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string>;
    validateConnection(): Promise<boolean>;
    label: string;
}

class BackendStrategy implements IGenAIProvider {
    public label = "后端网关";

    async generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> {
        const targetModel = model || selectedTextModel;
        const data = await callBackend({ action: "chat", model: targetModel, messages }, signal);
        const fullText = data?.text || "";

        if (onChunk && fullText) {
            // 模拟增量回调，避免 UI 只在末尾更新
            let acc = "";
            for (let i = 0; i < fullText.length; i += 80) {
                acc = fullText.slice(0, i + 80);
                onChunk(acc);
            }
        }

        return fullText;
    }

    async validateConnection(): Promise<boolean> {
        const response = await fetch(apiUrl("/api/ai?action=health"), {
            headers: withGatewayHeaders(),
        });
        if (!response.ok) throw new Error(`后端健康检查错误: ${response.status}`);
        const data = await response.json();
        if (data?.ok === false) throw new Error(data?.error || "后端健康检查失败");
        return true;
    }
}

class GoogleOfficialStrategy implements IGenAIProvider {
    private client: GoogleGenAI;
    public label = "谷歌云直连";
    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> {
        const systemMsg = messages.find((m) => m.role === "system")?.content || "";
        const userMsg = messages.find((m) => m.role === "user")?.content || "";
        const targetModel = model.startsWith("gemini") ? model : "gemini-2.5-flash";

        const result = await this.client.models.generateContentStream({
            model: targetModel,
            contents: userMsg,
            config: {
                ...(systemMsg ? { systemInstruction: systemMsg } : {}),
                responseMimeType: "application/json",
            },
        });

        let fullText = "";
        for await (const chunk of result) {
            if (signal?.aborted) throw new Error("Aborted");
            if (chunk.text) {
                fullText += chunk.text;
                if (onChunk) onChunk(fullText);
            }
        }
        return fullText;
    }

    async validateConnection(): Promise<boolean> {
        await this.client.models.generateContent({ model: "gemini-2.5-flash", contents: "ping" });
        return true;
    }

    getClient() {
        return this.client;
    }
}

class ProxyServiceStrategy implements IGenAIProvider {
    private apiKey: string;
    public label = "前端代理";

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> {
        const targetModel = model.startsWith("gpt") ? model : "gpt-5.1";
        const response = await fetch(`${LEGACY_PROXY_BASE}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: targetModel, messages, stream: true }),
            signal,
        });
        if (!response.ok) throw new Error(`前端代理错误: ${response.status}`);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ") && line !== "data: [DONE]") {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices?.[0]?.delta?.content || "";
                            fullText += content;
                            if (onChunk) onChunk(fullText);
                        } catch {
                            // ignore bad line chunk
                        }
                    }
                }
            }
        }

        return fullText;
    }

    async validateConnection(): Promise<boolean> {
        const response = await fetch(`${LEGACY_PROXY_BASE}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model: "gpt-5.1", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
        });
        if (!response.ok) throw new Error(`前端代理错误: ${response.status}`);
        return true;
    }
}

export const Infrastructure = {
    setApiKey: (key: string | null) => {
        storedKey = (key || "").trim();
    },

    getApiKey: () => storedKey,

    setBackendEnabled: (enabled: boolean) => {
        backendEnabled = enabled;
    },

    isBackendEnabled: () => backendEnabled,

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
        if (!backendEnabled) return Infrastructure.getAvailableModels();
        try {
            const response = await fetch(apiUrl("/api/ai?action=models"), {
                headers: withGatewayHeaders(),
            });
            if (!response.ok) throw new Error(`模型目录请求失败: ${response.status}`);
            const data = await response.json();

            if (Array.isArray(data?.textModels) && data.textModels.length > 0) {
                availableTextModels = data.textModels;
            }
            if (Array.isArray(data?.imageModels) && data.imageModels.length > 0) {
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
                Object.keys(textByProviderFromApi).length > 0
                    ? textByProviderFromApi
                    : buildModelsByProvider(availableTextModels, providerByModel, modelProviderOrder.text);
            imageModelsByProvider =
                Object.keys(imageByProviderFromApi).length > 0
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

    toggleProxy: (): boolean => {
        const nextProxy = getModeFromModels() !== "proxy";
        Infrastructure.setProxyMode(nextProxy);
        return getModeFromModels() === "proxy";
    },

    setProxyMode: (enabled: boolean) => {
        if (enabled) {
            selectedTextModel = firstModelByFamily(availableTextModels, "non_google", selectedTextModel);
            selectedImageModel = firstModelByFamily(availableImageModels, "non_google", selectedImageModel);
        } else {
            selectedTextModel = firstModelByProvider(availableTextModels, "google", selectedTextModel);
            selectedImageModel = firstModelByProvider(availableImageModels, "google", selectedImageModel);
        }
        persistModelPrefs();
    },

    getStatus: () => {
        const mode = getModeFromModels();
        const textProvider = resolveProviderByModel(selectedTextModel);
        const imageProvider = resolveProviderByModel(selectedImageModel);
        return {
            mode,
            label: backendEnabled
                ? `后端网关 · 文本:${providerLabel(textProvider)} · 生图:${providerLabel(imageProvider)}`
                : mode === "proxy"
                    ? "前端代理模式（开放接口兼容）"
                    : "谷歌云直连",
            provider: backendEnabled ? "后端网关" : mode === "proxy" ? "前端代理" : "谷歌",
            textModel: selectedTextModel,
            imageModel: selectedImageModel,
        };
    },

    isProxy: () => getModeFromModels() === "proxy",

    getProvider: (): IGenAIProvider => {
        if (backendEnabled) return new BackendStrategy();
        if (!storedKey) throw new Error("接口密钥未配置");
        if (getModeFromModels() === "proxy") return new ProxyServiceStrategy(storedKey);
        return new GoogleOfficialStrategy(storedKey);
    },

    getGoogleClient: () => {
        if (backendEnabled) {
            // 兼容旧调用点：返回一个伪 client，内部改走后端 API
            return {
                models: {
                    generateContent: async ({ model, contents, config }: { model: string; contents: any; config?: any }) => {
                        return callBackend({
                            action: "generate",
                            model: model || selectedTextModel,
                            contents,
                            config,
                        });
                    },
                },
            } as any;
        }

        if (!storedKey) throw new Error("接口密钥未配置");
        if (getModeFromModels() === "proxy") throw new Error("当前为前端代理模式");
        return new GoogleOfficialStrategy(storedKey).getClient();
    },

    routeRequest: async (model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> => {
        const provider = Infrastructure.getProvider();
        return withRetry(() => provider.generateText(model || selectedTextModel, messages, onChunk, signal), 3, 1000, signal);
    },

    generateDirectorPlan: async (
        payload: DirectorPlanRequest,
        onChunk?: (text: string) => void,
        signal?: AbortSignal
    ): Promise<DirectorPlanResponse> => {
        const userIdea = String(payload?.userIdea || "").trim();
        if (!userIdea) throw new Error("缺少用户创意输入");

        if (backendEnabled) {
            const targetModel = payload?.model || selectedTextModel;
            const data = await callBackend(
                {
                    action: "director_plan",
                    model: targetModel,
                    userIdea,
                    tension: payload?.tension || "dramatic",
                    analysis: payload?.analysis || {},
                    creativeBrief: payload?.creativeBrief || {},
                },
                signal
            );

            if (!data?.plan) throw new Error("Backend 未返回导演计划");

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
        }

        throw new Error("后端已关闭，无法执行导演计划");
    },

    callProxy: async (modelList: string[], messages: any[], stream: boolean = false, onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> => {
        const model = modelList?.[0] || selectedTextModel;
        return Infrastructure.routeRequest(model, messages, onChunk, signal);
    },

    withTimeout,

    runWithRetry: async <T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
        return withRetry(operation, 5, 2000, signal);
    },

    validate: async (key: string, logger?: (msg: string) => void): Promise<"pro" | "flash"> => {
        if (key?.trim()) storedKey = key.trim();

        if (backendEnabled) {
            try {
                if (logger) logger("正在连接后端网关...");
                await withTimeout(callBackend({ action: "health" }), 30000, "连接超时");
                if (logger) logger("✅ 后端网关握手成功");
                return "pro";
            } catch (backendError: any) {
                if (!storedKey) {
                    throw backendError;
                }
                backendEnabled = false;
                if (logger) logger("⚠️ 后端网关不可用，切换到前端直连模式...");
            }
        }

        const provider = Infrastructure.getProvider();
        if (logger) logger(`🚀 连接 ${provider.label}...`);
        await withTimeout(provider.validateConnection(), 30000, "连接超时");
        if (logger) logger("✅ 通道握手成功");
        return "pro";
    },

    generateImage: async (prompt: string, modelType: "pro" | "flash", signal?: AbortSignal): Promise<string> => {
        if (signal?.aborted) throw new Error("Aborted");

        if (backendEnabled) {
            const fallbackModel = modelType === "pro" ? "gemini-3-pro-image-preview" : "gemini-2.5-flash-image";
            const data = await callBackend(
                {
                    action: "image",
                    model: selectedImageModel || fallbackModel,
                    modelType,
                    prompt,
                },
                signal
            );
            if (!data?.imageUrl) throw new Error("Backend 未返回图片数据");
            return data.imageUrl;
        }

        if (!storedKey) throw new Error("接口密钥未配置");

        if (getModeFromModels() === "proxy") {
            const openaiImageModel = firstModelByProvider(availableImageModels, "openai", "gpt-image-1");
            const response = await fetch(`${LEGACY_PROXY_BASE}/images/generations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${storedKey}`,
                },
                body: JSON.stringify({
                    model: resolveProviderByModel(selectedImageModel) === "openai" ? selectedImageModel : openaiImageModel,
                    prompt,
                    n: 1,
                    size: "1024x1024",
                    response_format: "b64_json",
                }),
                signal,
            });

            if (!response.ok) {
                const errText = await response.text();
                if (response.status === 429) throw new Error("请求限流 (429)");
                throw new Error(`前端代理错误 ${response.status}: ${errText.slice(0, 120)}`);
            }

            const data = await response.json();
            return `data:image/png;base64,${data.data[0].b64_json}`;
        }

        const ai = new GoogleOfficialStrategy(storedKey).getClient();
        const modelName = modelType === "pro" ? "gemini-3-pro-image-preview" : "gemini-2.5-flash-image";
        const config: any = {
            imageConfig: { aspectRatio: "3:4" },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
        };

        if (modelName.includes("pro")) config.imageConfig.imageSize = "1K";

        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [{ text: prompt }] },
            config,
        });

        const candidate = response.candidates?.[0];
        const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
        if (imagePart?.inlineData) {
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }

        throw new Error(response.text || `生成失败 (${candidate?.finishReason || "空响应"})`);
    },
};
