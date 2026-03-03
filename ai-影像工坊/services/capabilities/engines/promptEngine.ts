
import { CINEMATOGRAPHY, CASTING } from "../../../assets";
import { SafetySentinel } from "../guardrails/safetySentinel";

// ==========================================
// 提示词工具库 (Prompt Utilities)
// 职责: 提供底层的文本清洗和随机召回辅助函数
// 注意: 核心的 Prompt 构建逻辑已下沉至 Director 和 Camera 领域
// ==========================================

export const PromptEngine = {
    // 1. 简单的文本清洗 (Sanitize)
    // 供各领域调用的基础安全清洗，确保引用了最新的 SafetySentinel
    sanitize: (text: string) => {
        return SafetySentinel.sanitize(text);
    },

    // 2. 智能姿态召回 (Smart Pose Recall)
    // 这是一个纯数据逻辑，保留在此处供 Director 域调用
    getSmartPose: (styleDesc: string): string => {
        const style = styleDesc.toLowerCase();
        
        // 初始化分数表，新增高张力分类
        const scores: Record<string, number> = { 
            PROVOCATION: 0, 
            TENSION: 0, 
            INTIMATE: 0, 
            VOYEUR: 0, 
            CHAOS: 0, 
            HANDS: 0 
        };

        // --- 关键词映射逻辑 (Chemistry Engine) ---
        
        // 1. 极度挑逗 / 性感
        if (style.match(/sexy|hot|provocative|tease|baddie|seductive|lips|tongue|bite/)) {
            scores.PROVOCATION += 10;
        }

        // 2. 暧昧 / 张力
        if (style.match(/tension|ambiguous|waiting|wall|breath|sweat|desire|lust|night/)) {
            scores.TENSION += 8;
        }

        // 3. 亲密 / 情感
        if (style.match(/love|kiss|bed|sheets|morning|soft|touch|couple|romance/)) {
            scores.INTIMATE += 8;
        }

        // 4. 窥视 / 电影感
        if (style.match(/wong kar|noir|dark|mood|cinematic|film|portra|hide|secret/)) {
            scores.VOYEUR += 5;
            scores.TENSION += 3;
        }

        // 5. 混乱 / 动态
        if (style.match(/flash|lomo|party|run|blur|disposable|ccd|drunk|high/)) {
            scores.CHAOS += 5;
        }

        // 6. 细节 / 特写
        if (style.match(/close|macro|detail|hand|finger|texture/)) {
            scores.HANDS += 5;
            scores.INTIMATE += 3;
        }
        
        // --- 决策逻辑 ---
        
        let bestCategory = "TENSION"; // 默认倾向于张力，而非无聊的 Pose
        let maxScore = -1;
        
        // 打乱顺序以增加随机性
        const categories = Object.keys(scores) as (keyof typeof CINEMATOGRAPHY.POSES)[];
        categories.sort(() => Math.random() - 0.5); 
        
        for (const cat of categories) {
            if (scores[cat] > maxScore) { maxScore = scores[cat]; bestCategory = cat; }
        }
        
        // 如果没有明显倾向 (Score都是0)，随机在“有张力”的组里选
        if (maxScore === 0) {
            bestCategory = ["TENSION", "PROVOCATION", "INTIMATE"][Math.floor(Math.random() * 3)];
        }

        const poseList = CINEMATOGRAPHY.POSES[bestCategory as keyof typeof CINEMATOGRAPHY.POSES];
        const selectedPose = poseList[Math.floor(Math.random() * poseList.length)];
        
        // 返回带分类标签的 Pose，方便 Debug，CameraEngine 会处理它
        return `[SMART POSE: ${bestCategory}] ${selectedPose}`;
    },

    // 3. 微观选角生成 (Micro Casting)
    // 供 Director 域在 Continuity 为空时补全细节
    generateMicroCasting: (): string => {
        const weightedPick = (library: string[], keywords: string[] = []) => {
            if (keywords.length > 0) {
                const candidates = library.filter(item => keywords.some(k => item.includes(k)));
                if (candidates.length > 0 && Math.random() < 0.7) return candidates[Math.floor(Math.random() * candidates.length)];
            }
            return library[Math.floor(Math.random() * library.length)];
        };

        const archetypeKeys = Object.keys(CASTING.ARCHETYPES);
        const selectedKey = archetypeKeys[Math.floor(Math.random() * archetypeKeys.length)];
        const archetype = CASTING.ARCHETYPES[selectedKey];
        const bias = archetype.bias || {};

        const skin = weightedPick(CASTING.TRAITS.SKIN, bias.skin);
        const eyes = weightedPick(CASTING.TRAITS.EYES, bias.eyes);
        const face = weightedPick(CASTING.TRAITS.FACE, bias.face);
        const nose = weightedPick(CASTING.TRAITS.NOSE, bias.nose);
        const lips = weightedPick(CASTING.TRAITS.LIPS, bias.lips);
        
        // 新增：Body Type 随机召回
        const body = weightedPick(CASTING.TRAITS.BODY_TYPES, bias.body);
        
        return `Archetype: ${selectedKey}. Body: ${body}. Structure: ${face}. Detail: ${eyes}, ${skin}, ${nose}, ${lips}.`;
    }
};
