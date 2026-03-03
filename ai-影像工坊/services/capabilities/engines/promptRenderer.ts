
import { ShootPlan } from "../../../types";

// Helper for string cleaning
const clean = (s: string) => s.replace(/(\r\n|\n|\r)/gm, " ").trim();
const cleanOptions = (text: string) => text.replace(/(Option|方案)\s*[A-Z0-9]+[:\uff1a]/gi, "").replace(/\|\|/g, " OR ").trim();
const ASIAN_REALISM_SUBJECT_PREFIX =
    "(Real Asian adult human age 23+:1.7), (East Asian facial structure:1.5), (natural human skin texture, pores, subtle imperfections:1.4), black or dark-brown hair, dark-brown eyes";

export class PromptRenderer {

    /**
     * Legacy/Fallback Mode: 
     * Reconstructs a structured prompt from raw metadata.
     */
    static renderFallback(plan: ShootPlan, description: string, variant: string, castingTraits: string): string {
        const continuity = plan.continuity;
        
        let subjectDetails = castingTraits || continuity?.character?.description || "Cinematic Subject";
        subjectDetails = cleanOptions(subjectDetails);

        const wardrobe = continuity?.wardrobe?.description ? cleanOptions(continuity.wardrobe.description) : "Stylized outfit";
        const env = continuity?.set?.environment ? cleanOptions(continuity.set.environment) : "Cinematic background";
        const lighting = plan.productionNotes?.lighting || "Cinematic Lighting";

        return PromptRenderer._assemble(
            subjectDetails,
            wardrobe,
            description, // Action
            env,
            lighting,
            variant // Style
        );
    }

    /**
     * The Core Assembler
     * Implements "Semantic Isolation"
     */
    private static _assemble(who: string, wear: string, action: string, where: string, light: string, style: string): string {
        // --- The Immune System (Anti-AI / Anti-Western Bias) ---
        const immuneSystem = [
            // Quality
            "text", "watermark", "cgi", "3d render", "cartoon", "anime", "painting", "illustration",
            "bad anatomy", "deformed", "blur", "low quality", "doll-like", "plastic skin",
            // Anti-Cyberpunk/Tech (Strict)
            "cyberpunk", "neon", "futuristic", "sci-fi", "robot", "tech", "glossy", "unreal engine", 
            "led lights", "digital art", "airbrush", "perfect skin", "latex"
        ];

        // 强制全局人群约束：真实亚洲人
        const ethnicEnforcement = ASIAN_REALISM_SUBJECT_PREFIX;
        immuneSystem.push("western face", "caucasian", "white people", "african ethnicity", "blonde hair", "blue eyes", "green eyes", "non-asian ethnicity");

        const negativePrompt = immuneSystem.join(", ");
        const cleanStyle = style.replace(/^(Option|Variant|方案)[:\.\-]\s*/i, "").trim();

        return `
[PHOTOGRAPHY DIRECTIVE]
Create a photorealistic, cinematic image. High fidelity, 8k resolution.
Aesthetic: "${cleanStyle}"

[SUBJECT - IMMUTABLE]
Who: ${clean(who)}. ${ethnicEnforcement}.
Wearing: ${clean(wear)}.
Action: ${clean(action)}.
(Hard Constraint: Subject MUST be a real Asian human adult age 23+. Do NOT switch ethnicity. No minor cues.)

[ENVIRONMENT]
Location: ${clean(where)}.
Lighting: ${clean(light)}.

[VISUAL STYLE]
Texture: Analog Film, Raw, Organic, Grainy.

[NEGATIVE PROMPT]
Avoid: ${negativePrompt}.
        `.trim();
    }
}
