
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

// ==========================================
// 基础设施层 (Infrastructure Layer)
// 职责: 处理网络请求、API 鉴权、策略路由、弹性重试、图像生成底层 I/O
// ==========================================

// --- 0. 弹性工具 (Resilience Utils) ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
            if (signal?.aborted || e.name === 'AbortError') throw new Error("Aborted");
            lastError = e;
            const errMsg = (e.message || "").toLowerCase();
            const isRateLimit = e.status === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted');
            const isFatal = errMsg.includes("limit: 0") || errMsg.includes("invalid argument");
            
            if (isFatal) throw e;
            
            if (i < retries - 1) {
                let delay = baseDelay * Math.pow(2, i);
                if (isRateLimit) delay = delay * 1.5 + (Math.random() * 2000); 
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
        if (signal) signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error("Aborted")); });
    });
    try {
        const result = await Promise.race([promise, timeoutPromise, ...(signal ? [abortPromise] : [])]);
        clearTimeout(timer);
        return result;
    } catch (e) {
        if(timer) clearTimeout(timer);
        throw e;
    }
};

// --- Strategies ---

interface IGenAIProvider {
    generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string>;
    validateConnection(): Promise<boolean>;
    label: string;
}

class GoogleOfficialStrategy implements IGenAIProvider {
    private client: GoogleGenAI;
    public label = "Google Cloud";
    constructor(apiKey: string) { this.client = new GoogleGenAI({ apiKey }); }

    async generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> {
        const systemMsg = messages.find(m => m.role === 'system')?.content || '';
        const userMsg = messages.find(m => m.role === 'user')?.content || '';
        // Map generic model names to specific Google models
        let targetModel = model;
        if (model === 'gemini') targetModel = 'gemini-3-flash-preview'; 
        if (model.includes('gpt')) targetModel = 'gemini-3-flash-preview'; 

        const result = await this.client.models.generateContentStream({
            model: targetModel,
            contents: userMsg,
            config: { systemInstruction: systemMsg, responseMimeType: 'application/json' }
        });
        let fullText = "";
        for await (const chunk of result) {
            if (signal?.aborted) throw new Error("Aborted");
            if (chunk.text) { fullText += chunk.text; if (onChunk) onChunk(fullText); }
        }
        return fullText;
    }

    async validateConnection(): Promise<boolean> {
        await this.client.models.generateContent({ model: 'gemini-3-flash-preview', contents: 'ping' });
        return true;
    }
    
    getClient() { return this.client; }
}

class ProxyServiceStrategy implements IGenAIProvider {
    private apiKey: string;
    private baseUrl: string = "https://xh.v1api.cc/v1"; 
    public label = "代理加速通道";
    constructor(apiKey: string) { this.apiKey = apiKey; }

    async generateText(model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> {
        const targetModel = model.includes('gpt') ? model : 'gpt-5.1'; 
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
            body: JSON.stringify({ model: targetModel, messages, stream: true }),
            signal
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
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content || "";
                            fullText += content;
                            if (onChunk) onChunk(fullText);
                        } catch (e) {}
                    }
                }
            }
        }
        return fullText;
    }

    async validateConnection(): Promise<boolean> {
        await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${this.apiKey}` },
            body: JSON.stringify({ model: 'gpt-5.1', messages: [{role:'user', content:'ping'}], max_tokens: 1 })
        });
        return true;
    }
}

// --- Global State ---
let storedKey = process.env.API_KEY || '';
let isProxyEnabled = false;

export const Infrastructure = {
    setApiKey: (key: string | null) => {
        if (!key || key.trim() === '') { storedKey = process.env.API_KEY || ''; isProxyEnabled = false; } 
        else { storedKey = key.trim(); isProxyEnabled = storedKey.startsWith('sk-'); }
    },
    getApiKey: () => storedKey,
    toggleProxy: (): boolean => { isProxyEnabled = !isProxyEnabled; return isProxyEnabled; },
    setProxyMode: (enabled: boolean) => { isProxyEnabled = enabled; },
    getStatus: () => ({ mode: isProxyEnabled ? 'proxy' : 'direct', label: isProxyEnabled ? '代理加速 (GPT-5)' : 'Google Cloud', provider: isProxyEnabled ? 'Proxy Matrix' : 'Google Cloud' }),
    isProxy: () => isProxyEnabled,
    
    getProvider: (): IGenAIProvider => {
        if (!storedKey) throw new Error("API Key 未配置");
        if (isProxyEnabled) return new ProxyServiceStrategy(storedKey);
        return new GoogleOfficialStrategy(storedKey);
    },

    getGoogleClient: () => {
        if (isProxyEnabled) throw new Error("Proxy Mode active");
        return new GoogleOfficialStrategy(storedKey).getClient();
    },

    routeRequest: async (model: string, messages: any[], onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> => {
        const provider = Infrastructure.getProvider();
        return withRetry(() => provider.generateText(model, messages, onChunk, signal), 3, 1000, signal);
    },

    callProxy: async (modelList: string[], messages: any[], stream: boolean = false, onChunk?: (text: string) => void, signal?: AbortSignal): Promise<string> => {
        const provider = Infrastructure.getProvider();
        return withRetry(() => provider.generateText(modelList[0], messages, onChunk, signal), 3, 1000, signal);
    },

    withTimeout,
    
    runWithRetry: async <T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
        return withRetry(operation, 5, 2000, signal);
    },

    validate: async (key: string, logger?: (msg: string) => void): Promise<'pro' | 'flash'> => {
        Infrastructure.setApiKey(key);
        const provider = Infrastructure.getProvider();
        if (logger) logger(`🚀 连接 ${provider.label}...`);
        await withTimeout(provider.validateConnection(), 30000, "连接超时");
        if (logger) logger("✅ 通道握手成功");
        return 'pro';
    },

    // --- New Capability: Low-level Image Generation ---
    generateImage: async (prompt: string, modelType: 'pro' | 'flash', signal?: AbortSignal): Promise<string> => {
        if (signal?.aborted) throw new Error("Aborted");

        // 1. Proxy Mode (DALL-E 3 via Proxy)
        if (isProxyEnabled) {
            const resp = await fetch("https://xh.v1api.cc/v1/images/generations", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${storedKey}` },
                body: JSON.stringify({
                    model: "dall-e-3",
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                    response_format: "b64_json"
                }),
                signal 
            });
            if (!resp.ok) {
                const errText = await resp.text();
                if (resp.status === 429) throw new Error(`Rate Limit (429)`);
                throw new Error(`Proxy Error ${resp.status}: ${errText.substring(0, 50)}`);
            }
            const data = await resp.json();
            return `data:image/png;base64,${data.data[0].b64_json}`;
        }

        // 2. Direct Mode (Gemini Image)
        const ai = new GoogleOfficialStrategy(storedKey).getClient();
        const modelName = modelType === 'pro' ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        
        const config: any = {
            imageConfig: { aspectRatio: "3:4" }, 
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
        };
        // Pro model supports explicit size, Flash does not (defaults to 1024)
        if (modelName.includes('pro')) config.imageConfig.imageSize = "1K";

        const response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [{ text: prompt }] },
            config
        });
        
        const candidate = response.candidates?.[0];
        if (!candidate) {
            throw new Error("AI provider returned no candidates. This usually indicates a safety block or API internal error.");
        }

        const imagePart = candidate.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
        
        // If we reach here, check for a text refusal
        const textRefusal = response.text;
        if (textRefusal) {
            throw new Error(`AI Refusal: ${textRefusal.substring(0, 200)}`);
        }
        
        throw new Error(`Generation failed (Reason: ${candidate.finishReason || 'Empty Response'})`);
    }
};
