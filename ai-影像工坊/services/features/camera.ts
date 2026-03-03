
import { ShootPlan, FrameMetadata, RuntimeBlueprint, OptionBlueprint } from "../../types";
import { Infrastructure } from "../api/client";

const ASIAN_REALISM_SUBJECT_PREFIX =
    "(Real Asian adult human age 23+:1.7), (East Asian facial structure:1.5), (natural human skin texture, pores, subtle imperfections:1.4), black or dark-brown hair, dark-brown eyes";

const ASIAN_REALISM_NEGATIVE = [
    "western face",
    "caucasian",
    "white people",
    "african ethnicity",
    "european face",
    "blonde hair",
    "blue eyes",
    "green eyes",
    "non-asian ethnicity",
    "anime face",
    "cartoon face",
    "plastic skin",
];

// ==========================================
// 领域：摄影执行 (Camera Domain)
// 架构模式: "Optical Physics Simulation" + "Semantic Isolation" + "Blueprint Execution"
// 职责: 将抽象的 "ShootPlan" 转换为具体的图像生成指令
// ==========================================

export const CameraEngine = {
    
    _cleanPrompt: (text: string): string => {
        return text
            .replace(/^(Generate|Create|Draw|Show me|I want a photo of|Image of)\s+/i, "")
            .replace(/(\r\n|\n|\r)/gm, " ")
            .trim();
    },

    // 确定性随机生成器 (Deterministic RNG)
    _seededRandom: (seed: number) => {
        let x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    },

    // 从蓝图解析当前 Shot 的配置
    _resolveBlueprint: (
        blueprintRaw: string, 
        shotDesc: string, 
        shotId: number = 1
    ): { anchors: OptionBlueprint['anchors'], palette: { expression: string, posture: string } } | null => {
        try {
            const raw = atob(decodeURIComponent(escape(blueprintRaw.split("::")[1])));
            const bp: RuntimeBlueprint = JSON.parse(raw);
            
            // 1. Determine Option (A or B)
            const isOptionB = shotDesc.includes("[CAST:B]");
            const option = isOptionB ? bp.options.B : bp.options.A;

            // 2. Determine Palette (Progression)
            const rng = CameraEngine._seededRandom(shotId + (isOptionB ? 100 : 0));
            const exprIndex = Math.floor(rng * option.palette.expressionPool.length);
            const poseIndex = Math.floor(CameraEngine._seededRandom(shotId + 1) * option.palette.posturePool.length);

            return {
                anchors: option.anchors,
                palette: {
                    expression: option.palette.expressionPool[exprIndex] || "Neutral",
                    posture: option.palette.posturePool[poseIndex] || "Candid"
                }
            };

        } catch (e) {
            console.warn("Blueprint resolution failed", e);
            return null;
        }
    },

    /**
     * 构建 Prompt：语义隔离构建法 (Semantic Isolation)
     */
    constructPrompt: (plan: ShootPlan, description: string, metadata: FrameMetadata, overrideDescription?: string): string => {
        const continuity = plan.continuity;
        
        // --- 1. Blueprint Resolution (The Truth Source) ---
        const bpToken = (metadata.castingTraits || "")
            .split(',')
            .find(s => s.trim().startsWith('BP::')) || 
            (plan.continuity.character.details || []).find(s => s.startsWith('BP::'));

        let resolvedConfig = null;
        const shotId = description.length + (metadata.variant?.length || 0);

        if (bpToken) {
            resolvedConfig = CameraEngine._resolveBlueprint(bpToken, description, shotId);
        }

        // --- 2. [Subject Layer] ---
        const mainDesc = CameraEngine._cleanPrompt(overrideDescription || description);
        
        let charDesc = resolvedConfig 
            ? `${resolvedConfig.anchors.facial}, ${resolvedConfig.anchors.bodyForm}`
            : (continuity?.character?.description || "");
            
        let wardrobe = resolvedConfig 
            ? resolvedConfig.anchors.wardrobe
            : (continuity?.wardrobe?.description || "");

        // --- 3. [Environment Layer] ---
        const env = continuity?.set?.environment || "cinematic background";

        // --- 4. [Style Layer] ---
        const rawVariant = metadata.variant || "Cinematic";
        let cleanVariant = rawVariant.replace(/^(Option|Variant|方案)\s*[\w\d]*[:\.]\s*/i, "").trim();
        
        // --- 5. [Immune System] ---
        const immuneSystem: string[] = [
            "text", "watermark", "cgi", "3d render", "cartoon", "anime", "painting", "drawing", "illustration",
            "bad anatomy", "deformed", "ugly", "blur", "low quality",
            "cyberpunk", "neon", "futuristic", "sci-fi", "robot", "tech", "glossy", "plastic skin"
        ];
        
        const lowerChar = charDesc.toLowerCase();
        const isMale = /\b(man|boy|male|guy|father|husband|gentleman|he|him)\b/.test(lowerChar) || /\b(男|先生|少年|大叔|老伯|爷爷|父|兄|弟)\b/.test(lowerChar);
        const isFemale = /\b(woman|girl|female|lady|mother|wife|she|her)\b/.test(lowerChar) || /\b(女|小姐|少女|阿姨|大妈|奶奶|母|姐|妹)\b/.test(lowerChar);
        const isPerson = isMale || isFemale || /\b(person|human|character|subject|model|portrait|face)\b/.test(lowerChar) || /\b(人|模特|面孔|特写)\b/.test(lowerChar);

        if (isMale && !isFemale) {
             immuneSystem.push("woman", "girl", "female", "feminine", "dress", "skirt", "bra", "makeup");
        } else if (isFemale && !isMale) {
             immuneSystem.push("man", "boy", "male", "masculine", "beard", "mustache");
        }

        if (isPerson) {
            charDesc = `${ASIAN_REALISM_SUBJECT_PREFIX}, ${charDesc}`;
            immuneSystem.push(...ASIAN_REALISM_NEGATIVE);
            immuneSystem.push("monk", "priest", "clown", "joker", "alien", "robot", "cyborg", "zombie", "monster", "creature", "mask");
        }
        
        const negativePromptBlock = immuneSystem.join(", ");

        return `
[PHOTOGRAPHY DIRECTIVE]
Create a photorealistic, cinematic image. High fidelity, 8k resolution.
Aesthetic Reference: "${cleanVariant}"

[SUBJECT - IMMUTABLE]
Who: ${charDesc}.
Wearing: ${wardrobe}.
Action: ${mainDesc}${resolvedConfig ? `, ${resolvedConfig.palette.expression}, ${resolvedConfig.palette.posture}` : ""}.
(Constraint: Subject MUST be a real Asian human adult age 23+. Do NOT whitewash. Do NOT switch ethnicity. No minor cues.)

[ENVIRONMENT]
Location: ${env}.
Lighting: ${continuity?.set?.timeOfDay || "Natural Light"}.
Atmosphere: ${plan.productionNotes?.lighting || "Cinematic"}.

[VISUAL STYLE - FILTER]
Apply this specific visual style: ${cleanVariant}.

[NEGATIVE PROMPT]
Avoid: ${negativePromptBlock}.
        `.replace(/\s+/g, ' ').trim();
    },

    /**
     * 核心拍摄方法
     */
    shootFrame: async (plan: ShootPlan, description: string, modelType: 'pro' | 'flash', metadata: FrameMetadata, signal?: AbortSignal): Promise<string> => {
        if (signal?.aborted) throw new Error("Aborted");

        let finalPrompt = CameraEngine.constructPrompt(plan, description, metadata);
        
        try {
            return await Infrastructure.runWithRetry(
                () => CameraEngine._executeRequest(finalPrompt, modelType, signal),
                signal
            );
        } catch (error: any) {
            if (signal?.aborted || error.message === "Aborted") throw new Error("Aborted");

            const errMsg = String(error.message || "").toLowerCase();
            const isQuota = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("resource_exhausted");
            
            if (isQuota && modelType === 'pro') {
                 try {
                    return await Infrastructure.runWithRetry(
                        () => CameraEngine._executeRequest(finalPrompt, 'flash', signal),
                        signal
                    );
                 } catch (fallbackErr: any) {
                     console.error("CameraEngine: Flash fallback also failed.", fallbackErr);
                 }
            }

            const isRefusal = errMsg.includes("refusal") || errMsg.includes("safety") || errMsg.includes("400") || errMsg.includes("policy");

            if (isRefusal) {
                const safePrompt = `Cinematic photo of a real Asian adult human: ${description}. Style: ${metadata.variant}. Natural skin texture, high quality.`;
                try {
                    return await Infrastructure.runWithRetry(
                        () => CameraEngine._executeRequest(safePrompt, modelType, signal),
                        signal
                    );
                } catch (retryError: any) {
                    if (signal?.aborted) throw new Error("Aborted");
                    const fallbackPrompt = "Photorealistic portrait of a real Asian adult human, cinematic lighting, natural skin texture, high contrast, 8k resolution.";
                    try {
                        return await Infrastructure.runWithRetry(
                            () => CameraEngine._executeRequest(fallbackPrompt, 'flash', signal),
                            signal
                        );
                    } catch (e) {
                        return CameraEngine._generatePlaceholder(description);
                    }
                }
            }
            throw error;
        }
    },

    _generatePlaceholder: (text: string): string => {
        const safeText = text.replace(/[<>]/g, "").substring(0, 30);
        const svg = `
<svg width="512" height="768" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#18181b"/>
  <rect x="10%" y="10%" width="80%" height="80%" fill="#27272a" stroke="#3f3f46" stroke-width="2" stroke-dasharray="10 10"/>
  <text x="50%" y="45%" font-family="monospace" font-size="48" fill="#52525b" text-anchor="middle">⚠️</text>
  <text x="50%" y="55%" font-family="sans-serif" font-size="16" fill="#71717a" text-anchor="middle" font-weight="bold">GENERATION FAILED</text>
  <text x="50%" y="65%" font-family="monospace" font-size="12" fill="#52525b" text-anchor="middle">${safeText}...</text>
</svg>`.trim();
        try { return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`; } 
        catch (e) { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="; }
    },

    _executeRequest: async (prompt: string, modelType: 'pro' | 'flash', signal?: AbortSignal): Promise<string> => {
        return Infrastructure.generateImage(prompt, modelType, signal);
    }
};
