
import { AssetAxis } from "../../../types";

// ==========================================
// 剧本分析服务 (Producer Domain)
// 职责: 拆解甲方需求，签署“不可协商条约”
// 升级: 引入“幻觉防御机制” (Hallucination Defense)
// V2: 引入 Tension & Boundary Scoring + Axis Adjustment
// ==========================================

export interface ScriptAnalysis {
    userIntent: string;
    coreSubject: string; 
    // 甲方锁死区 (Hard Locks)
    hardLocks: {
        subjectType: 'HUMAN' | 'OBJECT' | 'SCENE'; 
        gender?: 'MALE' | 'FEMALE' | 'NEUTRAL';
        explicitTraits: string[]; 
        specificProduct?: string; 
        moodKeywords: string[];   
        // 新增：抗体列表，用于传递给 Camera 层做 Negative Prompt
        immuneSystem: string[]; 
    };
    creativeOpenings: string[];
    productionSuggestions: {
        materials: string[];
        sensory: string[];
    };
    // V2 增量字段
    tensionScore?: {
        gazePressure: number;       // 0~1
        physicalProximity: number;
        materialPresence: number;
        bodyReality: number;
        compositionInstability: number;
        documentaryColdness: number;
    };
    boundaryScore?: {
        eroticRisk: number;         // 0~1
        explicitRisk: number;       // 0~1
    };
    structureScore?: {
        completeness: number;
    }
}

export const ScriptAnalyzer = {
    analyze: (userInput: string): ScriptAnalysis => {
        const lowerInput = userInput.toLowerCase();
        
        // 0. 核心主题提取
        let coreSubject = userInput
            .replace(/^(请)?(帮我)?(生成|创建|画|制作|给我)(一张|一个|些)?/gi, "")
            .replace(/^(Please)?\s*(Generate|Create|Draw|Make|Show me)\s*(an image of|a photo of|a picture of)?/gi, "")
            .trim();
            
        if (!coreSubject) coreSubject = userInput || "Cinematic shot";

        // 1. 主体类型侦测
        let subjectType: 'HUMAN' | 'OBJECT' | 'SCENE' = 'HUMAN'; 
        if (lowerInput.match(/\b(shoes?|bag|car|phone|bottle|chair|table|product|perfume|camera)\b/)) subjectType = 'OBJECT';
        else if (lowerInput.match(/\b(room|landscape|city|forest|beach|mountain|street)\b/) && !lowerInput.match(/\b(man|woman|girl|boy)\b/)) subjectType = 'SCENE';

        // 2. 性别/角色硬锁
        let gender: 'MALE' | 'FEMALE' | 'NEUTRAL' = 'NEUTRAL';
        if (subjectType === 'HUMAN') {
            if (lowerInput.match(/\b(man|boy|male|guy|he|him|his|dad|father|husband|gentleman)\b/) || lowerInput.match(/(男|先生|少年|大叔|老伯|爷爷|父|兄|弟)/)) gender = "MALE";
            else if (lowerInput.match(/\b(woman|girl|female|lady|she|her|hers|mom|mother|wife|lady)\b/) || lowerInput.match(/(女|小姐|少女|阿姨|大妈|奶奶|母|姐|妹)/)) gender = "FEMALE";
        }

        // 3. 情绪/风格关键词
        const moodKeywords = [];
        if (lowerInput.match(/(sad|cry|lonely|dark|night|rain|blue|grief)/) || lowerInput.match(/(悲|哭|孤独|暗|夜|雨|蓝)/)) moodKeywords.push("MELANCHOLIC");
        if (lowerInput.match(/(happy|joy|sun|laugh|smile|bright|energy)/) || lowerInput.match(/(喜|乐|笑|阳|亮|暖)/)) moodKeywords.push("JOYFUL");
        if (lowerInput.match(/(cyber|future|neon|tech|laser)/) || lowerInput.match(/(赛博|未来|科技|霓虹)/)) moodKeywords.push("FUTURISTIC");
        if (lowerInput.match(/(old|vintage|retro|film|80s|90s|grain)/) || lowerInput.match(/(旧|复古|胶片|港风|年代)/)) moodKeywords.push("VINTAGE");
        if (lowerInput.match(/(minimal|clean|white|simple)/)) moodKeywords.push("MINIMALIST");

        // 4. 特指实体
        let specificProduct = undefined;
        const quoteMatch = userInput.match(/["“](.*?)["”]/);
        if (quoteMatch) specificProduct = quoteMatch[1];
        
        // 5. 显性特征
        const explicitTraits = [userInput]; 

        // 6. 创作空白
        const creativeOpenings = [];
        if (!lowerInput.includes("wear") && !lowerInput.includes("dress") && !lowerInput.includes("穿")) creativeOpenings.push("wardrobe");
        if (!lowerInput.match(/(at|in|on|inside|outside)/) && !lowerInput.match(/(在|位于|背景|场景)/)) creativeOpenings.push("location");
        if (!lowerInput.match(/(light|shadow|sun|lamp)/)) creativeOpenings.push("lighting");

        // --- 核心升级：构建免疫系统 (Immune System) ---
        const immuneSystem: string[] = [];
        
        // 如果是人类，严防死守非人生物
        if (subjectType === 'HUMAN') {
            immuneSystem.push(
                "clown", "joker", "mime", "makeup mask", // 小丑/面具系
                "monk", "priest", "religious costume",   // 宗教系 (容易被复古/长袍触发)
                "alien", "cyborg", "robot", "monster",   // 科幻/怪物系
                "zombie", "corpse", "skeleton",          // 恐怖系
                "cartoon", "anime", "illustration", "3d render", // 质感系
                "statue", "mannequin", "doll"            // 假人系
            );
            
            // 如果明确了性别，防止性别流动
            if (gender === 'FEMALE') immuneSystem.push("man", "boy", "male", "beard", "mustache");
            if (gender === 'MALE') immuneSystem.push("woman", "girl", "female", "dress", "skirt");
        }

        // 7. 制片要素建议
        const productionSuggestions = {
            materials: [] as string[],
            sensory: [] as string[]
        };

        // --- V2 Scoring ---
        const tensionScore = {
            gazePressure: lowerInput.match(/(gaze|eye|stare|close|look|凝视|眼|近)/) ? 0.8 : 0.4,
            physicalProximity: lowerInput.match(/(touch|breath|skin|near|接触|呼吸|皮|近)/) ? 0.8 : 0.3,
            materialPresence: lowerInput.match(/(texture|fabric|wet|metal|材质|纹理|湿|金属)/) ? 0.8 : 0.4,
            bodyReality: lowerInput.match(/(sweat|scar|weight|fat|pregnant|汗|疤|重|孕)/) ? 0.9 : 0.5,
            compositionInstability: lowerInput.match(/(tilt|dutch|crop|off|blur|歪|切|糊)/) ? 0.7 : 0.3,
            documentaryColdness: lowerInput.match(/(real|raw|cold|obs|真|生|冷)/) ? 0.8 : 0.5
        };

        const boundaryScore = {
            eroticRisk: lowerInput.match(/(sexy|hot|nude|naked|desire|bed|性|裸|欲|床)/) ? 0.8 : 0.1,
            explicitRisk: lowerInput.match(/(sex|porn|fuck|xxx|genital|nipple|penis|vagina)/) ? 1.0 : 0.0
        };

        return {
            userIntent: userInput,
            coreSubject, 
            hardLocks: {
                subjectType,
                gender,
                explicitTraits,
                specificProduct,
                moodKeywords,
                immuneSystem // 注入免疫列表
            },
            creativeOpenings,
            productionSuggestions,
            tensionScore,
            boundaryScore
        };
    },

    /**
     * V2 Capability: Suggest Axis Adjustments based on analysis
     */
    suggestAxisAdjustment: (analysis: ScriptAnalysis): Partial<Record<AssetAxis, number>> => {
        const adjustment: Partial<Record<AssetAxis, number>> = {};
        
        if (analysis.boundaryScore?.eroticRisk && analysis.boundaryScore.eroticRisk > 0.6) {
            // High Erotic Risk -> Increase Coldness & Hardness (De-sexualize)
            adjustment.documentary_coldness = 0.9;
            adjustment.lighting_hardness = 0.8;
            adjustment.social_discomfort = 0.7;
        }

        const tension = analysis.tensionScore;
        if (tension) {
            // Amplify existing tension if detected
            if (tension.gazePressure > 0.6) adjustment.gaze_pressure = 0.9;
            if (tension.bodyReality > 0.6) adjustment.body_reality = 0.95;
        }

        return adjustment;
    }
};
