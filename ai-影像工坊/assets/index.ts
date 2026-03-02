import { FLAT_LIBS, ARCHETYPES_DB } from "./casting";
import { FLAT_VISUALS, SUBCULTURES, TEXTURES } from "./visuals"; 
import { CINEMATOGRAPHY as CINE_DB } from "./cinematography"; 
import { DIRECTOR as DIR_DB } from "./director";
import { SAFETY_STRATEGIES as SAFETY_DB } from "./safety";
import { MICRO_PLOTS, ATMOSPHERES, PUNCTUMS, SENSORY_DETAILS, INTERACTIONS, MICRO_GESTURES, CHAOS_ELEMENTS } from "./narrative"; 

// V2 Imports
import { GAZE_ASSETS } from "./gaze";
import { BODY_REALITY_ASSETS } from "./bodyReality";
import { MATERIAL_ASSETS } from "./material";
import { CAMERA_INTRUSION_ASSETS } from "./cameraIntrusion";
import { LIGHTING_HARD_ASSETS } from "./lightingHard";
import { COMPOSITION_DISCOMFORT_ASSETS } from "./compositionDiscomfort";
import { ENVIRONMENT_COLD_ASSETS } from "./environmentCold";

// ==========================================
// 数据聚合层 (Asset Aggregation Layer)
// Central point for all static assets and dictionaries.
// ==========================================

// --- 选角部门 ---
export const CASTING = {
    IDENTITY_POOLS: [], // Legacy pools removed for brevity
    TRAITS: FLAT_LIBS,
    ARCHETYPES: ARCHETYPES_DB
};

// --- 美术部门 ---
export const VISUALS = {
    MIXINS: FLAT_VISUALS,
    SUBCULTURES,
    TEXTURES
};

// --- 叙事部门 ---
export const NARRATIVE = {
    MICRO_PLOTS,
    ATMOSPHERES,
    PUNCTUMS,
    SENSORY_DETAILS,
    INTERACTIONS,
    MICRO_GESTURES,
    CHAOS_ELEMENTS
};

// --- 摄影部门 ---
export const CINEMATOGRAPHY = CINE_DB;

// --- 导演部门 ---
export const DIRECTOR = DIR_DB;

// --- 安全部门 ---
export const SAFETY = SAFETY_DB;

// --- Legacy Exports (Maintain compatibility) ---
export const IDENTITY_POOLS = CASTING.IDENTITY_POOLS;
export const MIXINS = VISUALS.MIXINS;
export const POSE_LIBRARY = CINEMATOGRAPHY.POSES;
export const ANALOG_LIBRARY = { 
    FILM_STOCKS: CINEMATOGRAPHY.ANALOG_STOCKS, 
    OPTICS: CINEMATOGRAPHY.OPTICS, 
    TENSION_SOURCES: CINEMATOGRAPHY.TENSION_SOURCES 
};
export const ARCHETYPES = CASTING.ARCHETYPES;
export const CREATIVE_MONOLOGUE = DIRECTOR.MONOLOGUE;

// --- V2 Assets Exports ---
export {
    GAZE_ASSETS,
    BODY_REALITY_ASSETS,
    MATERIAL_ASSETS,
    CAMERA_INTRUSION_ASSETS,
    LIGHTING_HARD_ASSETS,
    COMPOSITION_DISCOMFORT_ASSETS,
    ENVIRONMENT_COLD_ASSETS
};