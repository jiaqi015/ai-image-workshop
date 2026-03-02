
import { SKIN_ASSETS, EYES_ASSETS, LIPS_ASSETS, ARCHETYPES_DB } from "../../../assets/casting";
import { LOOK_ASSETS, MOOD_ASSETS, LIGHTING_ASSETS } from "../../../assets/visuals";
import { CINEMATOGRAPHY } from "../../../assets"; 
import { CreativeAsset } from "../../../types";
import { ScriptAnalysis } from "./scriptAnalyzer";

// ==========================================
// 概念引擎 (Concept Engine)
// 职责: 核心智能层。基于 Tag 匹配算法，从素材库中“召回”最符合意图的资产。
// ==========================================

export interface CreativeBrief {
    microCasting: string;
    suggestedVibes: string[];
    visualReference: string[];
}

export const ConceptEngine = {
    // 核心算法: 标签评分匹配 (Tag-based Scoring)
    matchAssets: (pool: CreativeAsset[], tags: string[], count: number = 1): string[] => {
        // Fix: Add safety check for undefined pool
        if (!pool || pool.length === 0) return [];
        
        // 1. 评分
        const scored = pool.map(item => {
            let score = 0;
            item.tags.forEach(t => {
                if (tags.includes(t)) score += 5; // 精确匹配
                if (tags.some(req => t.includes(req) || req.includes(t))) score += 2; // 模糊匹配
            });
            // 随机因子 (0-3分)，防止完全确定的枯燥结果
            score += Math.random() * 3;
            // 强度因子
            if (item.intensity && item.intensity > 4) score += 1; 
            return { item, score };
        });

        // 2. 排序
        scored.sort((a, b) => b.score - a.score);

        // 3. Top-N 截断 + 概率选择 (避免只选 No.1)
        const topCandidates = scored.slice(0, Math.min(pool.length, count * 3));
        const selected: string[] = [];
        
        for (let i = 0; i < count; i++) {
            if (topCandidates.length === 0) break;
            const idx = Math.floor(Math.random() * topCandidates.length);
            selected.push(topCandidates[idx].item.content);
            topCandidates.splice(idx, 1);
        }
        
        return selected;
    },

    // 综合召回流程
    recall: (analysis: ScriptAnalysis): CreativeBrief => {
        const { hardLocks } = analysis;
        const moodTags = hardLocks.moodKeywords.map(k => k.toLowerCase()); // e.g. "sad", "joyful"
        
        // --- 1. 选角召回 (Casting Recall) ---
        // 确定原型
        let archetypeKey = "THE_RAW_REALIST"; 
        // 简单的映射逻辑 (可扩展为 Tag 匹配)
        if (moodTags.includes("melancholic")) archetypeKey = "THE_TIRED_CITY";
        if (moodTags.includes("joyful")) archetypeKey = "THE_SUN_KISSED";
        if (moodTags.includes("vintage")) archetypeKey = "THE_ETHEREAL_GHOST";
        if (moodTags.includes("futuristic")) archetypeKey = "THE_SHARP_EDGE";
        
        // 基于原型 Bias 再次加强搜索
        const archetype = (ARCHETYPES_DB as any)[archetypeKey];
        const combinedTags = [...moodTags, ...(archetype.tags || [])];

        const skin = ConceptEngine.matchAssets(SKIN_ASSETS, combinedTags, 1)[0] || SKIN_ASSETS[0].content;
        const eyes = ConceptEngine.matchAssets(EYES_ASSETS, combinedTags, 1)[0] || EYES_ASSETS[0].content;
        const lips = ConceptEngine.matchAssets(LIPS_ASSETS, combinedTags, 1)[0] || LIPS_ASSETS[0].content;
        
        const microCasting = `[Archetype: ${archetypeKey}] Skin: ${skin}. Eyes: ${eyes}. Lips: ${lips}.`;

        // --- 2. 视觉氛围召回 (Visual Vibe Recall) ---
        // 搜索符合情绪的服装风格
        const look = ConceptEngine.matchAssets(LOOK_ASSETS, combinedTags, 1)[0];
        // 搜索符合情绪的光影
        const lighting = ConceptEngine.matchAssets(LIGHTING_ASSETS, combinedTags, 1)[0];
        // 搜索情绪状态
        const moodState = ConceptEngine.matchAssets(MOOD_ASSETS, combinedTags, 1)[0];

        const suggestedVibes = [moodState, look, lighting].filter(Boolean) as string[];

        // --- 3. 摄影技术召回 (Technical Recall) ---
        // 这里暂时复用旧的随机逻辑，或者你可以把 Film Stocks 也改成 Asset 结构
        const filmStock = CINEMATOGRAPHY.ANALOG_STOCKS[Math.floor(Math.random() * CINEMATOGRAPHY.ANALOG_STOCKS.length)].content;
        
        return {
            microCasting,
            suggestedVibes,
            visualReference: [filmStock]
        };
    }
};
