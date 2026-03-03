
import { IntentCategory } from "./intentClassifier";

export interface SublimationResult {
    isSublimated: boolean;
    sublimatedPrompt?: string;
    guidance?: string;
}

// 升华映射表：将低俗词汇映射为艺术概念
const SUBLIMATION_MAP: Record<string, string> = {
    "sexy": "high tension, intimate atmosphere",
    "hot": "warm humid lighting, sweat texture",
    "naked": "vulnerable human form, skin texture focus",
    "nude": "sculptural body lines, chiaroscuro lighting",
    "breasts": "chest silhouette, breathing motion",
    "legs": "geometric limb composition",
    "upskirt": "low angle architectural shot, intrusive perspective",
    "lingerie": "sheer fabric texture, lace details, concealment",
    "porn": "raw documentary realism, unpolished",
    "fetish": "obsessive material focus, macro details"
};

export const SublimationPolicy = {
    /**
     * 升华逻辑 (The Alchemist)
     * 将成人/危险意图转译为安全的艺术表达，而不是简单拒绝
     */
    apply: (input: string, intent: IntentCategory): SublimationResult => {
        if (intent !== "ADULT" && intent !== "EXPLICIT") {
            return { isSublimated: false };
        }

        if (intent === "EXPLICIT") {
            // 显式露骨内容无法升华，必须拒绝
            return { 
                isSublimated: false, 
                guidance: "BLOCK: Explicit content detected." 
            };
        }

        let sublimated = input.toLowerCase();
        // 执行关键词替换
        Object.entries(SUBLIMATION_MAP).forEach(([bad, good]) => {
            if (sublimated.includes(bad)) {
                sublimated = sublimated.replace(new RegExp(bad, 'gi'), good);
            }
        });

        // 强制添加艺术滤镜
        sublimated += ", (Artistic Photography:1.5), (Non-Erotic:1.2), (Documentary Style), (Emotional Tension)";

        return {
            isSublimated: true,
            sublimatedPrompt: sublimated,
            guidance: "Sublimated to Artistic Tension"
        };
    }
};
