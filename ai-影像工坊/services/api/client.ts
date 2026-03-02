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
const DEFAULT_TEXT_MODELS = [
    "gpt-5.2",
    "gpt-5.1",
    "gpt-5",
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
];

const DEFAULT_IMAGE_MODELS = [
    "gpt-image-1",
    "gemini-3-pro-image-preview",
    "gemini-2.5-flash-image",
];

const DEFAULT_TEXT_MODEL = "gpt-5.1";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";

type ModelPreferences = {
    textModel: string;
    imageModel: string;
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
const DEFAULT_PROVIDER_BY_MODEL: Record<string, string> = {
    "gpt-5.2": "openai",
    "gpt-5.1": "openai",
    "gpt-5": "openai",
    "gpt-image-1": "openai",
    "gemini-3-pro-preview": "google",
    "gemini-3-flash-preview": "google",
    "gemini-2.5-flash": "google",
    "gemini-3-pro-image-preview": "google",
    "gemini-2.5-flash-image": "google",
};
let providerByModel: Record<string, string> = { ...DEFAULT_PROVIDER_BY_MODEL };

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
    if (normalized.startsWith("gpt")) return "openai";
    if (normalized.includes("qwen") || normalized.includes("wanx")) return "ali";
    if (normalized.includes("doubao") || normalized.includes("seedream")) return "byte";
    if (normalized.includes("minimax")) return "minimax";
    if (normalized.includes("glm") || normalized.includes("cogview")) return "zhipu";
    return "unknown";
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
            return "OpenAI";
        case "google":
            return "Google";
        case "ali":
            return "阿里";
        case "byte":
            return "字节";
        case "minimax":
            return "MiniMax";
        case "zhipu":
            return "智谱";
        default:
            return provider || "Unknown";
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

async function callBackend(payload: any, signal?: AbortSignal) {
    const response = await fetch(apiUrl("/api/ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
    });

    const text = await response.text();
    let data: any = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { ok: false, error: text || "Invalid JSON response" };
    }

    if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || `Backend Error ${response.status}`);
    }

    return data;
}

interface IGenAIProvider {
    generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string>;
    validateConnection(): Promise<boolean>;
    label: string;
}

class BackendStrategy implements IGenAIProvider {
    public label = "Backend Gateway";

    async generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> {
        const targetModel = selectedTextModel || model;
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
        const response = await fetch(apiUrl("/api/ai?action=health"));
        if (!response.ok) throw new Error(`Backend Health Error: ${response.status}`);
        const data = await response.json();
        if (data?.ok === false) throw new Error(data?.error || "Backend health failed");
        return true;
    }
}

class GoogleOfficialStrategy implements IGenAIProvider {
    private client: GoogleGenAI;
    public label = "Google Cloud";
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
    public label = "Proxy/OpenAI";

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
        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);

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
        if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
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

    getAvailableModels: () => ({
        textModels: [...availableTextModels],
        imageModels: [...availableImageModels],
    }),

    refreshModels: async () => {
        if (!backendEnabled) return Infrastructure.getAvailableModels();
        try {
            const response = await fetch(apiUrl("/api/ai?action=models"));
            if (!response.ok) throw new Error(`Model Catalog Error: ${response.status}`);
            const data = await response.json();

            if (Array.isArray(data?.textModels) && data.textModels.length > 0) {
                availableTextModels = data.textModels;
            }
            if (Array.isArray(data?.imageModels) && data.imageModels.length > 0) {
                availableImageModels = data.imageModels;
            }
            if (data?.providerByModel && typeof data.providerByModel === "object") {
                providerByModel = { ...providerByModel, ...data.providerByModel };
            } else {
                const inferred: Record<string, string> = {};
                [...availableTextModels, ...availableImageModels].forEach((model) => {
                    inferred[model] = inferProviderByModelName(model);
                });
                providerByModel = { ...providerByModel, ...inferred };
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
                    ? "前端代理模式 (OpenAI Compatible)"
                    : "Google Cloud",
            provider: backendEnabled ? "Backend Gateway" : mode === "proxy" ? "Proxy" : "Google",
            textModel: selectedTextModel,
            imageModel: selectedImageModel,
        };
    },

    isProxy: () => getModeFromModels() === "proxy",

    getProvider: (): IGenAIProvider => {
        if (backendEnabled) return new BackendStrategy();
        if (!storedKey) throw new Error("API Key 未配置");
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

        if (!storedKey) throw new Error("API Key 未配置");
        if (getModeFromModels() === "proxy") throw new Error("Proxy Mode active");
        return new GoogleOfficialStrategy(storedKey).getClient();
    },

    routeRequest: async (model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> => {
        const provider = Infrastructure.getProvider();
        return withRetry(() => provider.generateText(model || selectedTextModel, messages, onChunk, signal), 3, 1000, signal);
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
                if (logger) logger("🚀 连接 Backend Gateway...");
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

        if (!storedKey) throw new Error("API Key 未配置");

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
                if (response.status === 429) throw new Error("Rate Limit (429)");
                throw new Error(`Proxy Error ${response.status}: ${errText.slice(0, 120)}`);
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

        throw new Error(response.text || `Generation failed (${candidate?.finishReason || "Empty Response"})`);
    },
};
