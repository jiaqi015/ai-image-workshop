
import { EMOTIONAL_STATES, IMPERFECTIONS, SENSORY_DETAILS, MICRO_GESTURES, CHAOS_ELEMENTS } from "../../../assets/narrative";
import { COMPOSITION_STRATEGIES, DEPTH_LAYERS } from "../../../assets/cinematography";
import { LIGHTING_SCENARIOS, FILM_ARTIFACTS } from "../../../assets/visuals";

// ==========================================
// 灵感引擎 v5.0 (The Director's Brain - Chaos & Depth Edition)
// 架构升级: 
// 1. Micro-Gestures: 引入潜意识动作，增加生物真实感。
// 2. Chaos Injection: 引入不可控元素（如突然的风、闯入的猫），制造惊喜。
// 3. Depth Control: 强制定义景深层次，拒绝纸片感。
// ==========================================

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const pickByTension = (states: typeof EMOTIONAL_STATES, targetTension: number) => {
    const sorted = [...states].sort((a, b) => Math.abs(a.tension - targetTension) - Math.abs(b.tension - targetTension));
    return pick(sorted.slice(0, 3));
};

export const InspirationEngine = {
    
    generateHighTensionPrompt: (): string => {
        
        // 1. 全局基底
        const SUBJECT_IDENTITY = "一位极具东方韵味的中国女性"; 
        const AESTHETIC_FILTER = "Raw Photo, Film Grain, Imperfect Skin Texture. No plastic AI feel.";

        // 2. 张力滑块 (0.3 ~ 0.9)
        const tension = 0.3 + Math.random() * 0.7; 

        // 3. 核心召回
        const state = pickByTension(EMOTIONAL_STATES, tension);
        const comp = pick(COMPOSITION_STRATEGIES);
        
        // 4. 光影与深度
        const lightingPool = tension > 0.6 ? LIGHTING_SCENARIOS.HIGH_TENSION : LIGHTING_SCENARIOS.LOW_TENSION;
        const lighting = pick(lightingPool);
        const depth = pick(DEPTH_LAYERS); // NEW: 景深控制

        // 5. 细节注入 (刺点 / 微动作 / 混沌 / 感官 / 伪影)
        const imperfection = pick(IMPERFECTIONS);
        const microGesture = pick(MICRO_GESTURES); // NEW: 微动作
        const sensory = pick(SENSORY_DETAILS);
        const artifact = Math.random() > 0.5 ? pick(FILM_ARTIFACTS) : "";
        
        // NEW: 混沌注入 (30% 概率)
        const chaos = Math.random() > 0.7 ? pick(CHAOS_ELEMENTS) : "";

        // 6. 组装 Prompt
        const promptText = `
【导演笔记 | Director's Note】
Target Aesthetic: ${AESTHETIC_FILTER}

[SUBJECT STATE & ACTION]
Identity: ${SUBJECT_IDENTITY}.
Internal State: ${state.content} (${state.desc})
Subconscious Action: ${microGesture}
(Note: Focus on the micro-movements. Breathing is visible.)

[COMPOSITION & DEPTH]
Strategy: ${comp.label}
Depth Layering: ${depth}
Safety: ${comp.safety}

[THE PUNCTUM & CHAOS]
*Imperfection*: ${imperfection}
${chaos ? `*Chaos Element*: ${chaos}` : ""}
(Make these details visible to break the perfection.)

[ATMOSPHERE & LIGHTING]
Sensory Vibe: ${sensory}
Lighting: ${lighting}
${artifact ? `Artifact: ${artifact}` : ""}

[PHYSICS]
Natural gravity effects on skin/clothes. No posing.
        `.trim();

        return promptText;
    }
};
