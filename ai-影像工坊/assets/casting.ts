
import { CreativeAsset } from "../types";

// ==========================================
// 选角数据库 (Casting Database) - ULTRA EXPANDED
// 核心美学: 东方骨相、皮肤肌理、真实瑕疵、年代感
// 拒绝: 欧美脸、网红脸、AI磨皮感
// ==========================================

export const SKIN_ASSETS: CreativeAsset[] = [
    // 1. 真实质感与瑕疵 (Realism)
    { id: "skin_translucent", content: "pale translucent skin, visible blue veins beneath eyes, fragile texture", tags: ["cold", "fragile", "ren_hang", "pale"], intensity: 4 },
    { id: "skin_humid", content: "skin glistening with humidity, beads of sweat on upper lip, sticky atmosphere", tags: ["warm", "summer", "wong_kar_wai", "wet"], intensity: 4 },
    { id: "skin_rough", content: "unrefined skin texture, visible pores, slight acne scars, raw documentary style", tags: ["real", "documentary", "raw"], intensity: 5 },
    { id: "skin_oily", content: "natural oils reflecting city neon lights, mixed with rain water", tags: ["night", "city", "street"], intensity: 3 },
    { id: "skin_flushed", content: "cheeks flushed red from alcohol or cold wind, blotchy uneven tone", tags: ["drunk", "winter", "emotional"], intensity: 4 },
    { id: "skin_freckles", content: "faint scattering of freckles across nose bridge, sun-damaged skin", tags: ["youth", "sun", "nature"], intensity: 3 },
    { id: "skin_bruised", content: "yellowing old bruise on the collarbone, storytelling mark", tags: ["story", "raw", "dark"], intensity: 5 },
    { id: "skin_powder", content: "heavy theatrical white powder, caking in creases, artificial mask-like", tags: ["opera", "surreal", "retro"], intensity: 4 },
    { id: "skin_goosebumps", content: "goosebumps visible on arms from cold air conditioning", tags: ["sensation", "cold", "texture"], intensity: 3 },
    { id: "skin_tan", content: "uneven tan lines from a tank top, worker's skin", tags: ["real", "worker", "summer"], intensity: 4 },
    { id: "skin_paper", content: "dry, paper-thin skin texture, matte finish, lacking vitality", tags: ["sick", "cold", "gothic"], intensity: 4 },
    { id: "skin_mole", content: "distinct beauty mark (mole) under the eye or near lips", tags: ["feature", "classic"], intensity: 2 },
    { id: "skin_weathered", content: "weather-beaten skin texture, exposure to elements, rough hands", tags: ["story", "rural", "tough"], intensity: 5 },
    { id: "skin_flash", content: "overexposed skin from direct flash, high contrast highlights, washed out details", tags: ["yonehara", "flash", "party"], intensity: 5 },
    { id: "skin_sticky", content: "skin sticky with fruit juice or soda, tactile and sensory", tags: ["araki", "sensory", "wet"], intensity: 4 }
];

export const FACE_STRUCTURES: CreativeAsset[] = [
    // 2. 东方骨相 (Asian Structure)
    { id: "face_flat", content: "flat facial profile, low nose bridge, wide-set eyes (The Cat Face)", tags: ["unique", "fashion", "youth"], intensity: 4 },
    { id: "face_cheekbones", content: "high prominent cheekbones, hollow cheeks, sharp angular jaw (The Model Face)", tags: ["sharp", "strong", "fashion"], intensity: 5 },
    { id: "face_round", content: "full moon face, soft jawline, fleshy cheeks, traditional beauty", tags: ["soft", "classic", "retro"], intensity: 3 },
    { id: "face_square", content: "strong square jaw, determined expression, thick neck", tags: ["strong", "masculine", "tough"], intensity: 4 },
    { id: "face_monolid", content: "distinct single eyelids (monolids), sharp piercing gaze", tags: ["feature", "sharp", "classic"], intensity: 4 },
    { id: "face_diamond", content: "diamond shaped face, pointed chin, wide temples", tags: ["sharp", "anime"], intensity: 3 },
    { id: "face_asymmetric", content: "slightly asymmetrical features, crooked smile, human imperfection", tags: ["real", "unique"], intensity: 5 },
    { id: "face_fox", content: "fox-like features, slanted eyes, pointed chin", tags: ["alluring", "sharp"], intensity: 4 },
    { id: "face_baby", content: "neoteny features, retaining baby fat, innocent look", tags: ["youth", "innocent"], intensity: 3 },
    { id: "face_gaunt", content: "gaunt skeletal face, dark circles, visible skull structure", tags: ["sick", "grunge", "tired"], intensity: 5 },
    { id: "face_melancholy", content: "naturally downturned mouth and eyes, perpetual sad expression", tags: ["sad", "moody"], intensity: 4 },
    { id: "face_androgynous", content: "blurring gender lines, sharp but delicate features", tags: ["unique", "fashion"], intensity: 4 }
];

export const HAIR_ASSETS: CreativeAsset[] = [
    // 3. 发型与质感 (Black Hair Focus)
    { id: "hair_messy_bob", content: "messy black bob cut, uneven bangs, blowing in wind", tags: ["youth", "retro", "90s"], intensity: 3 },
    { id: "hair_greasy", content: "unwashed greasy black hair, stringy texture, sticking to forehead", tags: ["grunge", "real", "dirty"], intensity: 4 },
    { id: "hair_wet", content: "soaking wet black hair, dripping water, combed back", tags: ["wet", "sexy", "rain"], intensity: 4 },
    { id: "hair_shaved", content: "buzz cut, visible scalp, rebellious aesthetic", tags: ["punk", "rebel", "ren_hang"], intensity: 5 },
    { id: "hair_long_straight", content: "waist-length straight black hair, heavy and thick", tags: ["classic", "ghost", "mystery"], intensity: 3 },
    { id: "hair_perm", content: "tight perm curls, 80s Hong Kong retro style, frizzy halo", tags: ["retro", "wong_kar_wai", "fashion"], intensity: 4 },
    { id: "hair_bleached", content: "badly bleached yellow hair with black roots showing (pudding hair)", tags: ["punk", "street", "real"], intensity: 5 },
    { id: "hair_bangs", content: "heavy blunt bangs covering eyebrows, mysterious look", tags: ["youth", "mysterious"], intensity: 3 },
    { id: "hair_bun", content: "messy loose bun held by a pencil or chopstick, loose strands", tags: ["casual", "home"], intensity: 2 },
    { id: "hair_windblown", content: "hair completely covering the face due to strong wind", tags: ["chaos", "dynamic"], intensity: 4 },
    { id: "hair_static", content: "static electricity making hair stand up, backlit halo", tags: ["dreamy", "texture"], intensity: 3 },
    { id: "hair_dyed_red", content: "faded red dyed hair, washed out color", tags: ["rebel", "youth"], intensity: 4 }
];

export const EYES_ASSETS: CreativeAsset[] = [
    // 4. 眼神与情绪 (The Gaze)
    { id: "eye_dead", content: "dead fish eyes, void of emotion, staring into nothingness", tags: ["tired", "numb", "city"], intensity: 5 },
    { id: "eye_teary", content: "eyes welling up with tears, red rimmed, holding back crying", tags: ["sad", "emotional"], intensity: 5 },
    { id: "eye_sharp", content: "predatory sharp gaze, pupils constricted, intense focus", tags: ["dangerous", "strong"], intensity: 5 },
    { id: "eye_tired", content: "heavy bags under eyes, dark circles from insomnia, bloodshot", tags: ["tired", "real", "grunge"], intensity: 4 },
    { id: "eye_seductive", content: "half-lidded bedroom eyes, hazy gaze, smeared eyeliner", tags: ["sexy", "moody"], intensity: 4 },
    { id: "eye_innocent", content: "wide open doe eyes, reflecting catchlights, feigned innocence", tags: ["innocent", "youth"], intensity: 3 },
    { id: "eye_flash", content: "red-eye effect from direct flash photography", tags: ["flash", "yonehara", "raw"], intensity: 5 },
    { id: "eye_looking_away", content: "deliberately avoiding eye contact, looking down or sideways", tags: ["shy", "avoidant", "moody"], intensity: 3 },
    { id: "eye_glare", content: "hostile glare, eyebrows furrowed", tags: ["angry", "tension"], intensity: 5 },
    { id: "eye_hollow", content: "deep set hollow eyes, shadowed sockets", tags: ["sick", "gothic"], intensity: 4 },
    { id: "eye_sparkle", content: "teary sparkle reflecting city neon lights", tags: ["night", "city", "dreamy"], intensity: 4 },
    { id: "eye_closed", content: "eyes gently closed, eyelashes visible against cheek", tags: ["peace", "sleep", "intimate"], intensity: 2 },
    { id: "eye_ahegao_lite", content: "eyes rolled back slightly, showing whites, ecstatic expression", tags: ["sexy", "ecstasy", "raw"], intensity: 5 }
];

export const LIPS_ASSETS: CreativeAsset[] = [
    // 5. 嘴唇细节
    { id: "lip_bitten", content: "bitten lip, swollen and red, teeth marks visible", tags: ["anxious", "sexy", "raw"], intensity: 4 },
    { id: "lip_chapped", content: "dry chapped lips, peeling skin, no makeup", tags: ["real", "sick", "cold"], intensity: 3 },
    { id: "lip_glossy", content: "thick sticky lip gloss, highly reflective", tags: ["yonehara", "pop", "sexy"], intensity: 5 },
    { id: "lip_smeared", content: "lipstick smeared across the cheek, messy kiss mark", tags: ["messy", "passion", "chaos"], intensity: 5 },
    { id: "lip_cigarette", content: "lips loosely holding a cigarette, smoke escaping", tags: ["cool", "moody", "noir"], intensity: 4 },
    { id: "lip_pale", content: "pale bloodless lips, blending into skin tone", tags: ["sick", "ghost", "pale"], intensity: 3 },
    { id: "lip_parted", content: "slightly parted lips, breathing through mouth", tags: ["sexy", "tired", "dumb"], intensity: 3 },
    { id: "lip_stained", content: "lips stained red from wine or fruit", tags: ["sensory", "story"], intensity: 4 }
];

export const BODY_ASSETS: CreativeAsset[] = [
    // 6. 身体形态 (Body Types - Realism Focus + Hot Focus)
    { id: "body_skeletal", content: "skeletal frame, protruding ribs and spine, sharp elbows (Ren Hang style)", tags: ["thin", "art", "sculpture"], intensity: 5 },
    { id: "body_fleshy", content: "soft fleshy body, visible rolls when sitting, loose skin", tags: ["real", "soft", "fleshy"], intensity: 4 },
    { id: "body_athletic", content: "wiry muscle, visible tendons, vascular arms, zero body fat", tags: ["strong", "dry", "worker"], intensity: 4 },
    { id: "body_bruised", content: "legs covered in small bruises and scratches", tags: ["story", "raw", "youth"], intensity: 4 },
    { id: "body_soft_tummy", content: "soft lower belly, not toned, muffin top, real amateur body", tags: ["hot", "real", "soft"], intensity: 5 },
    { id: "body_curvy_thick", content: "thick thighs (no gap), wide hips, soft waist, voluptuous figure", tags: ["hot", "curvy", "thick"], intensity: 5 },
    { id: "body_sweaty", content: "back drenched in sweat, clothes sticking to skin", tags: ["hot", "summer", "working"], intensity: 4 }
];

// --- 扁平化导出 (Flat Library for Random Picks) ---
export const FLAT_LIBS = {
    SKIN: SKIN_ASSETS.map(a => a.content),
    FACE: FACE_STRUCTURES.map(a => a.content),
    HAIR: HAIR_ASSETS.map(a => a.content),
    EYES: EYES_ASSETS.map(a => a.content),
    LIPS: LIPS_ASSETS.map(a => a.content),
    BODY_TYPES: BODY_ASSETS.map(a => a.content),
    NOSE: ["Straight nose", "Button nose", "Roman nose", "Flat nose bridge", "Aquiline nose"]
};

// --- 原型数据库 (Archetypes) ---
export const ARCHETYPES_DB: Record<string, { tags: string[], bias?: any }> = {
    THE_MASKED_DOLL: { // HongKongDoll style
        tags: ["mask", "mystery", "street", "legs"], 
        bias: { eyes: ["innocent", "contact_lens"], body: ["curvy_thick"], skin: ["pale"] } 
    },
    THE_INTERNET_GF: { // OnlyFans/Amateur
        tags: ["real", "messy", "bedroom", "selfie"], 
        bias: { body: ["soft_tummy", "fleshy"], skin: ["flushed"], eyes: ["seductive"] } 
    },
    THE_STREET_BADDIE: { // Yonehara style
        tags: ["flash", "tongue", "rude", "party"], 
        bias: { lips: ["glossy"], eyes: ["flash", "rolled"], body: ["sweaty"] } 
    },
    THE_EDISON_MUSE: { // Edison Chen style
        tags: ["candid", "raw", "no_makeup", "hotel"], 
        bias: { skin: ["freckles", "oily"], hair: ["messy"], eyes: ["tired"] } 
    },
    THE_RAW_REALIST: { 
        tags: ["real", "raw", "documentary"], 
        bias: { skin: ["rough", "pore"], eyes: ["tired"], body: ["fleshy"] } 
    },
    THE_TIRED_CITY: { 
        tags: ["city", "tired", "night", "melancholy"], 
        bias: { eyes: ["dead", "bag"], skin: ["oily"] } 
    },
    THE_SUN_KISSED: { 
        tags: ["summer", "sun", "youth", "warm"], 
        bias: { skin: ["freckles", "tan"], hair: ["messy"] } 
    },
    THE_ETHEREAL_GHOST: { 
        tags: ["ghost", "pale", "mystery", "soft"], 
        bias: { skin: ["pale", "translucent"], hair: ["long"] } 
    },
    THE_SHARP_EDGE: { 
        tags: ["sharp", "cold", "fashion", "strong"], 
        bias: { face: ["cheekbones", "sharp"], eyes: ["sharp"] } 
    },
    THE_SENTIMENTAL_EATER: { 
        tags: ["food", "eat", "sensory"], 
        bias: { lips: ["stained", "parted"], body: ["soft_tummy"] } 
    }
};
