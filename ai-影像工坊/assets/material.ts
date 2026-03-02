
import { CreativeAsset } from "../types";

export const MATERIAL_ASSETS: CreativeAsset[] = [
  // ==========================================
  // 3. 材质与介质 (Texture & Sensation)
  // 核心：廉价性感、体液感、束缚感、破坏感
  // ==========================================

  // --- 织物与丝袜 (Fabrics & Nylons) ---
  {
    id: "mat_fishnet_squeeze",
    title: "渔网勒痕：肉的溢出",
    content: "Black fishnet stockings digging into soft thigh flesh. Creating a diamond pattern of bulging skin. High contrast tactile texture.",
    tags: ["material", "fishnet", "squeeze", "sexy", "black"],
    axes: { material_presence: 1.0, body_reality: 0.9, lighting_hardness: 0.7 }
  },
  {
    id: "mat_torn_nylons_ladder",
    title: "撕裂丝袜：抽丝",
    content: "Sheer black pantyhose with a large run (ladder) or tear up the thigh. Skin poking through the hole. Rough, destructive texture.",
    tags: ["material", "nylon", "torn", "messy", "legs"],
    axes: { material_presence: 0.9, body_reality: 0.7, social_discomfort: 0.4 }
  },
  {
    id: "mat_sheer_white_wet",
    title: "湿白T恤：透肉",
    content: "Thin white cotton t-shirt soaked in water, becoming transparent. Clinging to skin color and nipples underneath. Bra strap visible.",
    tags: ["material", "wet", "sheer", "cotton", "white"],
    axes: { material_presence: 0.9, body_reality: 0.8, social_discomfort: 0.5 }
  },
  {
    id: "mat_cheap_lace_fray",
    title: "廉价蕾丝：起球",
    content: "Synthetic cheap lace fabric, slightly frayed edges, loose threads. Harsh flash reflection on the plastic fibers. Domestic/raw vibe.",
    tags: ["material", "lace", "cheap", "raw", "lingerie"],
    axes: { material_presence: 0.8, lighting_hardness: 0.8 }
  },
  {
    id: "mat_satin_wrinkled",
    title: "皱巴丝绸：床单",
    content: "Shiny satin sheets or pajamas, heavily wrinkled and messy. Reflects light in chaotic patterns. Lived-in texture.",
    tags: ["material", "satin", "wrinkle", "bed", "shiny"],
    axes: { material_presence: 0.7, documentary_coldness: 0.4 }
  },
  {
    id: "mat_denim_unbuttoned",
    title: "解开的牛仔：粗粝",
    content: "Rough blue denim texture, jeans button undone. Zipper half open. Contrast between hard fabric and soft belly skin.",
    tags: ["material", "denim", "jeans", "open", "hard"],
    axes: { material_presence: 0.8, body_reality: 0.7 }
  },
  {
    id: "mat_fuzzy_sweater",
    title: "马海毛：刺痒",
    content: "White fuzzy mohair sweater. Loose knit. Looks soft but slightly itchy. Light passes through the gaps.",
    tags: ["material", "wool", "soft", "white", "winter"],
    axes: { material_presence: 0.6, documentary_coldness: 0.3 }
  },

  // --- 胶质与光泽 (Latex & Shine) ---
  {
    id: "mat_latex_shine_sweat",
    title: "乳胶与汗：不透气",
    content: "Tight black latex/vinyl reflecting harsh light. Sweat pooling at the edges of the garment. Suffocating, shiny texture.",
    tags: ["material", "latex", "shiny", "fetish", "sweat"],
    axes: { material_presence: 0.9, lighting_hardness: 0.9, body_reality: 0.7 }
  },
  {
    id: "mat_plastic_raincoat",
    title: "透明雨衣：反光",
    content: "Clear plastic raincoat or shower curtain. Distorted view of the body underneath. High specular highlights from flash.",
    tags: ["material", "plastic", "clear", "wet", "rain"],
    axes: { material_presence: 0.8, documentary_coldness: 0.6 }
  },
  {
    id: "mat_oil_slick_skin",
    title: "身体油：高光",
    content: "Skin covered in baby oil. Extremely shiny, almost plastic-looking but with real skin pores. Slippery texture.",
    tags: ["material", "oil", "skin", "wet", "shiny"],
    axes: { material_presence: 0.9, body_reality: 1.0 }
  },
  {
    id: "mat_leather_seat_sticky",
    title: "皮座粘连：闷热",
    content: "Black leather car seat. Skin sticking to it. Sweat marks left behind when moving. Hot summer vibe.",
    tags: ["material", "leather", "car", "sticky", "hot"],
    axes: { material_presence: 0.8, social_discomfort: 0.5 }
  },

  // --- 液体与污渍 (Fluids & Stains) ---
  {
    id: "mat_smeared_lipstick_glass",
    title: "口红印：玻璃/皮肤",
    content: "Red lipstick smeared on skin or a glass rim. Greasy texture, imperfect edges. Evidence of a kiss.",
    tags: ["material", "makeup", "messy", "red", "kiss"],
    axes: { material_presence: 0.7, body_reality: 0.8 }
  },
  {
    id: "mat_mascara_runny",
    title: "流淌的睫毛膏",
    content: "Black streaks of mascara running down cheeks mixed with tears or sweat. Gritty, messy emotion.",
    tags: ["material", "makeup", "black", "tear", "messy"],
    axes: { material_presence: 0.7, documentary_coldness: 0.5 }
  },
  {
    id: "mat_condensation_drops",
    title: "冷凝水珠：冰",
    content: "Water droplets on a cold soda can or glass, pressed against warm skin. Wet trail running down.",
    tags: ["material", "water", "cold", "wet", "skin"],
    axes: { material_presence: 0.8, body_reality: 0.6 }
  },
  {
    id: "mat_spilled_milk",
    title: "泼洒的液体：白",
    content: "White liquid (milk or yogurt) spilled on the table or skin. Viscous texture. Messy and suggestive.",
    tags: ["material", "liquid", "white", "messy", "food"],
    axes: { material_presence: 0.9, social_discomfort: 0.7 }
  },

  // --- 环境表面 (Surfaces) ---
  {
    id: "mat_steamy_mirror_smear",
    title: "雾气镜面：涂抹",
    content: "Bathroom mirror covered in steam. A hand has wiped a clear patch, leaving streaks and water droplets. Hazy reflection.",
    tags: ["material", "glass", "steam", "mirror", "wet"],
    axes: { material_presence: 0.85, documentary_coldness: 0.6 }
  },
  {
    id: "mat_dirty_tiles_grout",
    title: "脏瓷砖：缝隙",
    content: "White bathroom tiles with slightly yellowed/moldy grout. Harsh flash lighting. Public toilet or cheap motel vibe.",
    tags: ["material", "tile", "dirty", "bathroom", "gritty"],
    axes: { material_presence: 0.7, social_discomfort: 0.9 }
  },
  {
    id: "mat_red_velvet_dusty",
    title: "红丝绒：灰尘",
    content: "Dusty red velvet headboard or curtains in a cheap motel. Flash illuminates dust motes. Retro, sleazy vibe.",
    tags: ["material", "velvet", "red", "dust", "motel"],
    axes: { material_presence: 0.7, social_discomfort: 0.8 }
  },
  {
    id: "mat_scratched_plexiglass",
    title: "划痕亚克力：隔板",
    content: "Scratched clear plastic partition (taxi or counter). Flash flares on the scratches. Obscuring the view.",
    tags: ["material", "plastic", "scratch", "dirty", "barrier"],
    axes: { material_presence: 0.8, camera_intrusion: 0.7 }
  },
  {
    id: "mat_crumpled_tissue",
    title: "揉皱的纸巾",
    content: "Pile of crumpled white tissues on the bed or floor. Flash photography. Suggests usage.",
    tags: ["material", "paper", "messy", "white", "trash"],
    axes: { material_presence: 0.6, social_discomfort: 0.7 }
  }
];
