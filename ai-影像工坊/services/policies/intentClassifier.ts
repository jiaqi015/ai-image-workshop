
import { NEGATIVE_LEXICON } from "../../assets/negativeLexicon";

export type IntentCategory = 
    | "ART" 
    | "EDITORIAL" 
    | "FASHION" 
    | "DOCUMENTARY" 
    | "ADULT" 
    | "EXPLICIT" 
    | "UNKNOWN";

export const IntentClassifier = {
    /**
     * 规则驱动的快速意图分类 (Rule-based Fast Classification)
     * 作用: 在不消耗 LLM Token 的情况下快速阻断或标记高风险请求
     */
    classifyHeuristic: (input: string): IntentCategory => {
        const lower = input.toLowerCase();

        // 1. Explicit Check (Highest Priority)
        const explicitMatches = NEGATIVE_LEXICON.explicitAct.filter(w => lower.includes(w));
        const nudityMatches = NEGATIVE_LEXICON.explicitNudityHints.filter(w => lower.includes(w));
        
        if (explicitMatches.length > 0) return "EXPLICIT";
        if (nudityMatches.length > 0 && (lower.includes("close up") || lower.includes("detail"))) return "EXPLICIT";

        // 2. Adult/Sexualized Intent Check
        const adultMatches = NEGATIVE_LEXICON.sexualizedIntent.filter(w => lower.includes(w));
        if (adultMatches.length > 0) return "ADULT";

        // 3. Artistic/Professional Intent
        if (lower.match(/(documentary|raw|grain|film|candid|street)/)) return "DOCUMENTARY";
        if (lower.match(/(fashion|editorial|vogue|magazine|couture)/)) return "FASHION";
        if (lower.match(/(art|sculpture|abstract|surreal|painting)/)) return "ART";

        return "UNKNOWN";
    }
};
