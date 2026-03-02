
import { SKIN_ASSETS, EYES_ASSETS, LIPS_ASSETS, HAIR_ASSETS, BODY_ASSETS, FACE_STRUCTURES, ARCHETYPES_DB } from "../../../assets/casting";
import { LOOK_ASSETS, MOOD_ASSETS, LIGHTING_ASSETS, COLOR_PALETTES, SUBCULTURES, TEXTURES } from "../../../assets/visuals";
import { MICRO_PLOTS, ATMOSPHERES, PUNCTUMS, SENSORY_DETAILS, INTERACTIONS } from "../../../assets/narrative";
import { ANALOG_STOCKS, OPTICS } from "../../../assets/cinematography"; 
import { CreativeAsset, AssetAxis, RiskFlag, AssetSlot, OptionBlueprint } from "../../../types";
import { ScriptAnalysis } from "./scriptAnalyzer";
import { IntentCategory } from "../../policies/intentClassifier";

// V2 Imports (Aggregated)
import { 
    GAZE_ASSETS, 
    MATERIAL_ASSETS, 
    BODY_REALITY_ASSETS, 
    CAMERA_INTRUSION_ASSETS, 
    LIGHTING_HARD_ASSETS, 
    COMPOSITION_DISCOMFORT_ASSETS, 
    ENVIRONMENT_COLD_ASSETS 
} from "../../../assets";

// ==========================================
// 资产召回服务 (Art Department)
// 职责: 道具库管理。
// 升级策略: "Juxtaposition Engine" (冲突美学引擎) - Masters Edition
// V2 Strategy: Axis-based Recall + MMR Diversity + Variant Expansion
// ------------------------------------------
// Update: Added "Controlled Recall" for Blueprint Enforcement
// ==========================================

export interface CreativeBrief {
    microCasting: string;
    suggestedVibes: string[];
    visualReference: string[];
    isProductFocus: boolean; 
    narrativeSeed?: string; 
    targetAxes?: Partial<Record<AssetAxis, number>>;
    avoidRisk?: RiskFlag[];
    requireTags?: string[];
    diversity?: number;
    recallMode?: "legacy" | "axis_v2";
    intentCategory?: IntentCategory;
}

// ... (Internal helpers: getAxisPools, axisSimilarity, hasAnyRisk, mmrSelect kept same)
let _AXIS_POOLS: CreativeAsset[] | null = null;
const getAxisPools = (): CreativeAsset[] => {
    if (_AXIS_POOLS) return _AXIS_POOLS;
    _AXIS_POOLS = [
        ...(GAZE_ASSETS || []), ...(MATERIAL_ASSETS || []), ...(BODY_REALITY_ASSETS || []),
        ...(CAMERA_INTRUSION_ASSETS || []), ...(LIGHTING_HARD_ASSETS || []),
        ...(COMPOSITION_DISCOMFORT_ASSETS || []), ...(ENVIRONMENT_COLD_ASSETS || [])
    ].flat();
    return _AXIS_POOLS;
};
function axisSimilarity(axes: Partial<Record<AssetAxis, number>>|undefined, target: Partial<Record<AssetAxis, number>>|undefined): number {
  if (!axes || !target) return 0;
  let num = 0, den = 0;
  for (const k of Object.keys(target) as AssetAxis[]) {
    const t = target[k] ?? 0; const a = axes[k] ?? 0;
    num += (1 - Math.abs(a - t)); den += 1;
  }
  return den ? num / den : 0;
}
function hasAnyRisk(asset: CreativeAsset, avoid: RiskFlag[] = []): boolean {
  if (!avoid?.length) return false;
  return (asset.riskFlags ?? []).some((r: RiskFlag) => avoid.includes(r));
}
function mmrSelect(candidates: CreativeAsset[], k: number, diversity: number, scoreFn: (a: CreativeAsset) => number, simFn: (a: CreativeAsset, b: CreativeAsset) => number): CreativeAsset[] {
  const selected: CreativeAsset[] = [];
  const remaining = [...candidates].sort((a, b) => scoreFn(b) - scoreFn(a));
  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0; let bestVal = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      const relevance = scoreFn(cand);
      const redundancy = selected.length === 0 ? 0 : Math.max(...selected.map(s => simFn(cand, s)));
      const val = (1 - diversity) * relevance - diversity * redundancy;
      if (val > bestVal) { bestVal = val; bestIdx = i; }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

export const AssetRecaller = {
    // 核心算法: 标签评分匹配
    matchAssets: (pool: CreativeAsset[], tags: string[], count: number = 1, forceConflict: boolean = false): string[] => {
        if (!pool || pool.length === 0) return [];
        const scored = pool.map(item => {
            let score = 0;
            if (item.tags) {
                let matchCount = 0;
                item.tags.forEach(t => {
                    if (tags.includes(t)) matchCount++;
                    if (tags.some(req => t.includes(req) || req.includes(t))) matchCount += 0.5;
                });
                score = forceConflict ? (5 - matchCount) * 2 : matchCount * 5;
            }
            score += Math.random() * 4;
            if (item.intensity && item.intensity > 4) score += 1; 
            return { item, score };
        });
        scored.sort((a, b) => b.score - a.score);
        const topCandidates = scored.slice(0, Math.min(pool.length, count * 5)); 
        const selected: string[] = [];
        for (let i = 0; i < count; i++) {
            if (topCandidates.length === 0) break;
            const idx = Math.floor(Math.random() * topCandidates.length);
            selected.push(topCandidates[idx].item.content);
            topCandidates.splice(idx, 1);
        }
        return selected;
    },

    // --- NEW: Controlled Recall (Blueprint Scope Enforcement) ---
    recallControlled: (
        blueprint: OptionBlueprint, 
        slot: AssetSlot, 
        shotIndex: number
    ): string => {
        // 1. Anchors (Fixed)
        if (slot === 'facial') return blueprint.anchors.facial;
        if (slot === 'bodyForm') return blueprint.anchors.bodyForm;
        if (slot === 'wardrobeMaterial') return blueprint.anchors.wardrobe;

        // 2. Palette (Varies by shotIndex)
        // Deterministic selection from pool
        if (slot === 'expression') {
            const pool = blueprint.palette.expressionPool;
            return pool[shotIndex % pool.length] || "Neutral";
        }
        if (slot === 'posture') {
            const pool = blueprint.palette.posturePool;
            return pool[(shotIndex + 1) % pool.length] || "Candid";
        }

        return "";
    },

    // V2 召回入口
    recallAssetsV2: (brief: CreativeBrief): CreativeAsset[] => {
        const diversity = brief.diversity ?? 0.35;
        const avoid = brief.avoidRisk ?? ["explicit_act", "explicit_nudity", "fetish_keyword"];
        const candidates = getAxisPools()
            .filter(a => !hasAnyRisk(a, avoid))
            .filter(a => (brief.requireTags?.length ? brief.requireTags.every(t => (a.tags ?? []).includes(t)) : true));
        const scoreFn = (a: CreativeAsset) => {
            const axisScore = axisSimilarity(a.axes, brief.targetAxes);
            const tagBonus = brief.requireTags?.length ? 0.05 : 0;
            return axisScore + tagBonus;
        };
        const simFn = (a: CreativeAsset, b: CreativeAsset) => {
            const ta = new Set(a.tags ?? []); const tb = new Set(b.tags ?? []);
            const overlap = [...ta].filter(x => tb.has(x)).length / Math.max(1, Math.min(ta.size, tb.size));
            const ax = axisSimilarity(a.axes, b.axes);
            return 0.5 * overlap + 0.5 * ax;
        };
        const selected = mmrSelect(candidates, 12, diversity, scoreFn, simFn);
        const expanded: CreativeAsset[] = selected.flatMap(a => {
            if (a.variants?.length && Math.random() > 0.6) {
                const variant = a.variants[0];
                const variantAsset: CreativeAsset = {
                    id: variant.id, content: variant.content, tags: variant.tags || a.tags || [], axes: variant.axes, title: (a.title || "Asset") + " (Var)"
                };
                return Math.random() > 0.8 ? [a, variantAsset] : [variantAsset];
            }
            return [a];
        });
        return expanded;
    },

    recall: (analysis: ScriptAnalysis): CreativeBrief => {
        const { hardLocks } = analysis;
        const moodTags = hardLocks.moodKeywords.map(k => k.toLowerCase());
        
        // --- 1. 选角召回 (Casting) ---
        let microCasting = "";
        const combinedTags = [...moodTags];
        
        if (hardLocks.subjectType === 'HUMAN') {
            let archetypeKey = "THE_RAW_REALIST"; 
            if (moodTags.includes("melancholic")) archetypeKey = "THE_TIRED_CITY";
            if (moodTags.includes("joyful")) archetypeKey = "THE_SUN_KISSED";
            if (moodTags.includes("vintage")) archetypeKey = "THE_ETHEREAL_GHOST";
            if (moodTags.includes("futuristic")) archetypeKey = "THE_SHARP_EDGE";
            
            if (Math.random() < 0.15) archetypeKey = "THE_SENTIMENTAL_EATER"; // Araki
            if (Math.random() < 0.15) archetypeKey = "THE_STRAY_DOG"; // Moriyama
            if (Math.random() < 0.15) archetypeKey = "THE_SCULPTURAL_YOUTH"; // Ren Hang
            if (Math.random() < 0.15) archetypeKey = "THE_ACID_BLOOM"; // Ninagawa

            if (Math.random() > 0.7) {
                const keys = Object.keys(ARCHETYPES_DB);
                archetypeKey = keys[Math.floor(Math.random() * keys.length)];
            }

            const archetype = (ARCHETYPES_DB as any)[archetypeKey];
            if (archetype.tags) combinedTags.push(...archetype.tags);

            const subculture = AssetRecaller.matchAssets(SUBCULTURES, combinedTags, 1)[0] || (SUBCULTURES[0] ? SUBCULTURES[0].content : "Standard");
            const skins = AssetRecaller.matchAssets(SKIN_ASSETS, combinedTags, 4).join(" | ");
            const eyes = AssetRecaller.matchAssets(EYES_ASSETS, combinedTags, 4).join(" | ");
            const hairs = AssetRecaller.matchAssets(HAIR_ASSETS, combinedTags, 4).join(" | ");
            const bodies = AssetRecaller.matchAssets(BODY_ASSETS, combinedTags, 4).join(" | ");
            const faces = AssetRecaller.matchAssets(FACE_STRUCTURES, combinedTags, 4).join(" | ");
            const interaction = AssetRecaller.matchAssets(INTERACTIONS, combinedTags, 1)[0];
            
            microCasting = `[Archetype: ${archetypeKey} | Tribe: ${subculture}] \nPhysical Options (Mix & Match): \n- Bodies: ${bodies}\n- Faces: ${faces}\n- Skin: ${skins}\n- Eyes: ${eyes}\n- Hair: ${hairs}\nAction Inspiration: ${interaction}.`;

        } else if (hardLocks.subjectType === 'OBJECT') {
            microCasting = `[Product Focus] Subject is an OBJECT. Focus on material texture, reflections, and form. NO HUMAN FACES.`;
            const texture = AssetRecaller.matchAssets(TEXTURES, combinedTags, 1)[0];
            microCasting += ` Overlay: ${texture}.`;
            if (hardLocks.specificProduct) {
                microCasting += ` Hero Object: "${hardLocks.specificProduct}".`;
            }
        } else {
            microCasting = `[Scene Focus] Wide angle, environmental details, atmospheric depth.`;
        }

        // --- 2. 视觉氛围召回 (Visual Vibes) ---
        const look = AssetRecaller.matchAssets(LOOK_ASSETS, combinedTags, 1)[0];
        const lighting = AssetRecaller.matchAssets(LIGHTING_ASSETS, combinedTags, 1)[0];
        const moodState = AssetRecaller.matchAssets(MOOD_ASSETS, combinedTags, 1)[0];
        
        const forceConflict = Math.random() < 0.25; 
        const palette = AssetRecaller.matchAssets(COLOR_PALETTES, combinedTags, 1, forceConflict)[0];
        
        const sensory = AssetRecaller.matchAssets(ATMOSPHERES, combinedTags, 1)[0];
        const atmosphere = AssetRecaller.matchAssets(ATMOSPHERES, combinedTags, 1)[0];
        const texture = AssetRecaller.matchAssets(TEXTURES, combinedTags, 1)[0];

        const suggestedVibes = [moodState, look, lighting, palette, atmosphere, `Sensory: ${sensory}`, `Texture: ${texture}`].filter(Boolean) as string[];
        const plot = AssetRecaller.matchAssets(MICRO_PLOTS, combinedTags, 1)[0];

        const filmStock = ANALOG_STOCKS && ANALOG_STOCKS.length > 0 
            ? ANALOG_STOCKS[Math.floor(Math.random() * ANALOG_STOCKS.length)].content 
            : "Standard Film Stock";
        const lens = OPTICS && OPTICS.length > 0
            ? OPTICS[Math.floor(Math.random() * OPTICS.length)].content
            : "50mm Standard Lens";
        
        return {
            microCasting,
            suggestedVibes,
            visualReference: [filmStock, lens],
            isProductFocus: hardLocks.subjectType === 'OBJECT',
            narrativeSeed: plot,
            recallMode: "legacy"
        };
    }
};
