

import { CreativeAsset } from "../types";

export const BODY_REALITY_ASSETS: CreativeAsset[] = [
  // ==========================================
  // 1. 真实肉感与生理反应 (Flesh & Physiology)
  // 核心：小肚子、勒痕、汗液、体温
  // ==========================================
  
  // --- 腹部与腰身 (The Tummy & Waist) ---
  {
    id: "body_soft_tummy_fold",
    title: "微隆小腹：坐姿折痕",
    content: "Soft lower belly slightly protruding over the waistband. Natural skin folds when sitting. Not toned, but soft and fleshy. Real amateur body standard.",
    tags: ["body", "tummy", "soft", "real", "amateur", "fold"],
    axes: { body_reality: 1.0, material_presence: 0.6, social_discomfort: 0.4 }
  },
  {
    id: "body_muffin_top_squeeze",
    title: "腰间勒肉：溢出的欲望",
    content: "Tight underwear/jeans cutting into soft hip flesh (muffin top). The skin bulges slightly around the strap. Tactile softness.",
    tags: ["body", "squeeze", "fleshy", "waist", "hot", "tight"],
    axes: { body_reality: 0.95, material_presence: 0.9, gaze_pressure: 0.5 }
  },
  {
    id: "body_navel_sweat",
    title: "肚脐汗渍：闷热",
    content: "Close-up of the navel area, glistening with accumulated sweat. Fine vellus hair visible. Skin is flushed pink from heat.",
    tags: ["body", "sweat", "navel", "macro", "hot"],
    axes: { body_reality: 0.9, material_presence: 0.8 }
  },
  {
    id: "body_stretch_marks_hips",
    title: "生长纹：银色裂痕",
    content: "Faint silvery stretch marks visible on hips or breasts. Natural skin texture. Flash photography highlights the uneven surface. Authentic beauty.",
    tags: ["body", "marks", "real", "texture", "hips"],
    axes: { body_reality: 1.0, lighting_hardness: 0.8 }
  },
  {
    id: "body_low_rise_jeans_bones",
    title: "低腰裤：盆骨突起",
    content: "Extremely low-rise jeans exposing the pelvic bones (iliac crest). Stomach is sucked in, creating a hollow. Y2K trashy aesthetic.",
    tags: ["body", "bones", "skinny", "y2k", "jeans"],
    axes: { body_reality: 0.8, material_presence: 0.7 }
  },

  // --- 大腿与膝盖 (Legs & Knees) ---
  {
    id: "body_plump_thighs_touching",
    title: "肉感大腿：无缝隙",
    content: "Thick, soft thighs pressing against each other (no thigh gap). Flesh flattening against the chair or bed. Cellulite texture visible in harsh light.",
    tags: ["body", "thighs", "thick", "real", "fleshy"],
    axes: { body_reality: 0.9, documentary_coldness: 0.5 }
  },
  {
    id: "body_bruised_knees_red",
    title: "红肿膝盖：暗示",
    content: "Knees are red and slightly bruised/dirty from kneeling. Skin texture is rougher on the joints. Suggestive backstory.",
    tags: ["body", "knees", "red", "bruise", "suggestive", "raw"],
    axes: { body_reality: 0.9, social_discomfort: 0.7, documentary_coldness: 0.6 }
  },
  {
    id: "body_inner_thigh_bite",
    title: "大腿内侧：红印",
    content: "Soft inner thigh skin with a faint red mark (hickey or pinch). Very pale skin tone compared to outer leg. Intimate zone.",
    tags: ["body", "thigh", "mark", "intimate", "pale"],
    axes: { body_reality: 0.85, social_discomfort: 0.8 }
  },
  {
    id: "body_fishnet_indentation",
    title: "渔网勒痕：网格肉",
    content: "After taking off fishnets, the grid pattern is impressed deeply into the soft thigh skin. Red and textured.",
    tags: ["body", "marks", "fishnet", "texture", "skin"],
    axes: { body_reality: 0.95, material_presence: 0.9 }
  },

  // --- 胸部与锁骨 (Chest & Neck) ---
  {
    id: "body_sweat_beads_cleavage",
    title: "胸口汗珠：流淌",
    content: "Glistening beads of sweat accumulating on the chest and collarbone. Skin is oily and reflective (not matte). Humidity and heat.",
    tags: ["body", "sweat", "wet", "hot", "chest"],
    axes: { body_reality: 0.9, material_presence: 0.8, lighting_hardness: 0.7 }
  },
  {
    id: "body_flushed_chest_alcohol",
    title: "酒精潮红：斑驳",
    content: "Skin on neck and chest is blotchy red (flushed) from alcohol ('Asian flush'). Uneven skin tone. Contrast with pale areas.",
    tags: ["body", "flushed", "drunk", "red", "skin"],
    axes: { body_reality: 0.9, documentary_coldness: 0.4 }
  },
  {
    id: "body_collarbone_water",
    title: "锁骨积水：深陷",
    content: "Prominent collarbones creating a deep hollow where water or sweat pools. Fragile and skeletal look.",
    tags: ["body", "bone", "wet", "fragile"],
    axes: { body_reality: 0.8, composition_instability: 0.5 }
  },
  {
    id: "body_bra_strap_mark_shoulder",
    title: "肩带勒痕：红印",
    content: "Red indentation line on the shoulder from a tight bra strap. Skin is slightly irritated. Evidence of undressing.",
    tags: ["body", "marks", "shoulder", "real", "undress"],
    axes: { body_reality: 0.9, material_presence: 0.7 }
  },

  // --- 皮肤质感与瑕疵 (Skin Texture) ---
  {
    id: "body_goosebumps_cold",
    title: "鸡皮疙瘩：寒冷/敏感",
    content: "Visible goosebumps (piloerection) on thighs and arms. Hair standing up. Reaction to cold air or touch. High definition skin texture.",
    tags: ["body", "texture", "sensation", "cold", "skin"],
    axes: { body_reality: 0.95, material_presence: 0.7 }
  },
  {
    id: "body_freckles_shoulders",
    title: "肩部雀斑：日晒",
    content: "Scattered freckles on shoulders and upper back. Sun-damaged skin texture. Not airbrushed. Authentic.",
    tags: ["body", "freckles", "skin", "sun", "real"],
    axes: { body_reality: 0.9, documentary_coldness: 0.6 }
  },
  {
    id: "body_mosquito_bites_scratch",
    title: "蚊子包：抓痕",
    content: "Red mosquito bites on legs, some scratched. A band-aid peeling off the heel. Summer night vibe.",
    tags: ["body", "flaw", "summer", "real", "legs"],
    axes: { body_reality: 0.9, documentary_coldness: 0.7 }
  },
  {
    id: "body_tan_lines_contrast",
    title: "晒痕差：比基尼印",
    content: "Stark contrast between pale breasts/buttocks and tanned body. Defined bikini tan lines. Raw and unpolished.",
    tags: ["body", "tan", "contrast", "summer", "hot"],
    axes: { body_reality: 0.8, material_presence: 0.5 }
  },
  {
    id: "body_greasy_skin_flash",
    title: "油光皮肤：直闪反射",
    content: "Skin covered in baby oil or natural sweat, reflecting a direct camera flash. High specularity. Not airbrushed, pores visible.",
    tags: ["body", "oil", "skin", "flash", "shiny"],
    axes: { body_reality: 1.0, lighting_hardness: 0.9 }
  },
  
  // --- 姿态挤压 (Deformation) ---
  {
    id: "body_squish_against_glass",
    title: "玻璃挤压：变形",
    content: "Body part (cheek, chest, or arm) pressed against a glass surface, flattening and distorting. Condensation around the contact area.",
    tags: ["body", "glass", "distort", "sexy", "squeeze"],
    axes: { body_reality: 0.9, composition_instability: 0.8, material_presence: 0.9 }
  },
  {
    id: "body_armpit_stubble",
    title: "腋下胡茬：未刮净",
    content: "Arm raised, revealing armpit with slight black stubble (not perfectly shaved). Real, human, raw.",
    tags: ["body", "hair", "raw", "armpit", "real"],
    axes: { body_reality: 1.0, social_discomfort: 0.6 }
  }
];