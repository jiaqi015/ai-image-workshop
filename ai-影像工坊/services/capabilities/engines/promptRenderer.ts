
import { ShootPlan } from "../../../types";

// Helper for string cleaning
const clean = (s: string) => s.replace(/(\r\n|\n|\r)/gm, " ").trim();
const cleanOptions = (text: string) => text.replace(/(Option|方案)\s*[A-Z0-9]+[:\uff1a]/gi, "").replace(/\|\|/g, " OR ").trim();

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

        // Smart Ethnicity Injection (if not explicitly foreign)
        const lowerWho = who.toLowerCase();
        const isForeign = /\b(western|white|caucasian|black|african|blonde|blue eye|russian|american)\b/i.test(lowerWho);
        let ethnicEnforcement = "";
        
        if (!isForeign) {
            immuneSystem.push("western", "caucasian", "blonde hair", "blue eyes", "european");
            ethnicEnforcement = "(Chinese ethnicity:1.5), (East Asian features:1.3), (Black hair:1.2)";
        }

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
