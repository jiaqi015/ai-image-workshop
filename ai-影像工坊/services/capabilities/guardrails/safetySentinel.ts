
import { SAFETY_STRATEGIES, SAFETY_CONFIG, SAFETY_OPTIMIZER_SYSTEM_PROMPT, SAFETY_SUBLIMATION_SYSTEM_PROMPT } from "../../../assets/safety";
import { Infrastructure } from "../../api/client";
import { IntentClassifier } from "../../policies/intentClassifier"; // V2 Dependency
import { SublimationPolicy } from "../../policies/sublimationPolicy"; // V2 Dependency

// ==========================================
// 安全哨兵 (Safety Sentinel)
// 职责: 智能审查、上下文感知过滤、美学降级、AI 兜底优化、紧急回退
// 策略升级: Aesthetic Sublimation (Ren Hang / Classic Art Strategy)
// V2 Update: Integrate Intent Classifier & Sublimation Policy
// ==========================================

export type SafetyAction = 'ALLOW' | 'BLOCK' | 'SOFTEN' | 'AESTHETIC_SHIFT' | 'OBSCURE' | 'SUBLIMATE'; // Added SUBLIMATE

export interface SafetyContext {
    ageGroup?: 'MINOR' | 'ADULT' | 'UNKNOWN';
    subjectType?: 'REAL' | 'ART' | 'UNKNOWN';
    isHorrorTheme?: boolean;
}

export const SafetySentinel = {
    
    // 1. 上下文推断
    analyzeContext: (text: string): SafetyContext => {
        const lower = text.toLowerCase();
        let ageGroup: 'MINOR' | 'ADULT' | 'UNKNOWN' = 'UNKNOWN';
        let subjectType: 'REAL' | 'ART' | 'UNKNOWN' = 'REAL';

        if (SAFETY_CONFIG.SENSITIVE_SUBJECTS.some(k => lower.includes(k))) {
            ageGroup = 'MINOR';
        }
        if (lower.match(/\b(statue|sculpture|painting|sketch|drawing|marble|bronze|mannequin|doll|art)\b/)) {
            subjectType = 'ART';
        }

        return { ageGroup, subjectType, isHorrorTheme: lower.includes('horror') || lower.includes('dark') };
    },

    // 2. 基础正则清洗 (Level 1 Defense)
    sanitize: (text: string, externalContext?: SafetyContext): string => {
        if (!text) return "";
        let processedText = text;
        const context = externalContext || SafetySentinel.analyzeContext(text);
        const isStrict = context.ageGroup === 'MINOR';

        const allRules = [
            ...SAFETY_STRATEGIES.CRITICAL,
            ...SAFETY_STRATEGIES.AESTHETIC,
            ...SAFETY_STRATEGIES.HORROR_TO_ART,
            ...SAFETY_STRATEGIES.BODY_DIVERSITY 
        ];

        for (const rule of allRules) {
            const regex = new RegExp(rule.pattern, 'gi');
            if (regex.test(processedText)) {
                if (rule.whitelistContext && context.subjectType === 'ART') {
                    const hitsWhitelist = rule.whitelistContext.some(w => processedText.toLowerCase().includes(w));
                    if (hitsWhitelist) continue;
                }
                
                // V2 Upgrade: Hard Block for Explicit Act/Nudity if not whitelist
                if (rule.category === 'NSFW_HARD') {
                    return "BLOCK: Safety violation detected.";
                }

                processedText = processedText.replace(regex, (match) => {
                    if (isStrict && rule.category.startsWith('NSFW')) return "clothing"; 
                    if (rule.replacements && rule.replacements.length > 0) {
                        return rule.replacements[Math.floor(Math.random() * rule.replacements.length)];
                    }
                    return "abstract form";
                });
            }
        }
        return processedText;
    },

    // 3. AI 智能修复 (Level 2 Defense: The Translator)
    optimizeWithAI: async (riskyPrompt: string): Promise<string> => {
        console.warn("SafetySentinel: Triggering AI Optimization (Level 2)...");
        try {
            if (Infrastructure.isProxy()) {
                // Upgrade: Use GPT-5.1 for fast and smart optimization
                const optimized = await Infrastructure.callProxy(
                    ['gpt-5.1', 'gpt-5.2'], 
                    [
                        { role: 'system', content: SAFETY_OPTIMIZER_SYSTEM_PROMPT },
                        { role: 'user', content: riskyPrompt }
                    ]
                );
                return optimized.trim();
            } else {
                const ai = Infrastructure.getGoogleClient();
                const result = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `System: ${SAFETY_OPTIMIZER_SYSTEM_PROMPT}\nUser: ${riskyPrompt}`
                });
                return result.text ? result.text.trim() : riskyPrompt;
            }
        } catch (e) {
            console.error("SafetySentinel: AI Optimization failed.", e);
            return SafetySentinel.sanitize(riskyPrompt);
        }
    },
    
    // V2: 意图驱动的升华 (Level 2.5 Defense: Sublimation Policy)
    // 强制执行: 如果意图被判定为 ADULT，必须经过此通道
    sublimate: async (eroticPrompt: string): Promise<string> => {
        const intent = IntentClassifier.classifyHeuristic(eroticPrompt);
        
        // 1. Explicit Check -> Block immediately
        if (intent === 'EXPLICIT') {
            console.warn("SafetySentinel: Explicit Intent BLOCKED.");
            return "BLOCK: Content Policy Violation (Explicit).";
        }

        // 2. Adult Intent -> Sublimate via Policy
        if (intent === 'ADULT') {
            console.warn("SafetySentinel: Adult Intent detected. Sublimating to Art...");
            const subResult = SublimationPolicy.apply(eroticPrompt, intent);
            if (subResult.isSublimated && subResult.sublimatedPrompt) {
                // Return the policy-rewritten prompt, then run it through the AI refiner for grammar
                return await SafetySentinel.optimizeWithAI(subResult.sublimatedPrompt);
            }
        }

        // Fallback to basic AI Sublimation
        try {
            if (Infrastructure.isProxy()) {
                // Upgrade: Use GPT-5.1
                const sublimated = await Infrastructure.callProxy(
                    ['gpt-5.1'], 
                    [
                        { role: 'system', content: SAFETY_SUBLIMATION_SYSTEM_PROMPT },
                        { role: 'user', content: eroticPrompt }
                    ]
                );
                return sublimated.trim();
            } else {
                const ai = Infrastructure.getGoogleClient();
                const result = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `System: ${SAFETY_SUBLIMATION_SYSTEM_PROMPT}\nUser: ${eroticPrompt}`
                });
                return result.text ? result.text.trim() : eroticPrompt;
            }
        } catch (e) {
            return SafetySentinel.sanitize(eroticPrompt);
        }
    },

    // 4. 核选项：安全肖像重构 (Level 3 Defense: The Safe Portrait Strategy)
    getEmergencyDescription: (text: string): string => {
        console.warn("SafetySentinel: Deploying NUCLEAR OPTION (Level 3 - Safe Portrait)...");
        
        // 提取关键词，去掉动词，只保留名词
        const safeBase = SafetySentinel.sanitize(text).substring(0, 60).replace(/\b(fighting|killing|blood|naked|sex|torture)\b/gi, ""); 
        
        const safeStrategies = [
            `High-fashion close-up portrait, neutral calm expression, soft studio lighting, detailed skin texture, avant-garde makeup. Context: ${safeBase}`,
            `Cinematic headshot, looking directly at camera, eyes in sharp focus, shallow depth of field, emotional intensity. Context: ${safeBase}`,
            `Artistic side profile portrait against a dark background, dramatic rim lighting, elegant mood, fine art photography (Ren Hang style lighting). Context: ${safeBase}`,
            `Classic beauty portrait, soft focus background, serene atmosphere, detailed facial features, museum quality. Context: ${safeBase}`,
            `Abstract silhouette in heavy shadow, noir atmosphere, mystery, suggestion without detail. Context: ${safeBase}`
        ];
        
        return safeStrategies[Math.floor(Math.random() * safeStrategies.length)];
    },

    getSafetyDirectives: (context: SafetyContext): string => {
        if (context.ageGroup === 'MINOR') {
            return "SAFETY_MODE: STRICT. No revealing clothing. No violence.";
        }
        return "SAFETY_MODE: ARTISTIC. Treat nudity as sculpture. Treat intensity as cinema.";
    }
};
