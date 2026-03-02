
import { CreativeAsset } from "../types";

export const ENVIRONMENT_COLD_ASSETS: CreativeAsset[] = [
  // ==========================================
  // 7. 私密与廉价空间 (Private & Sleazy Spaces)
  // 核心：OnlyFans背景、情趣酒店、深夜街头、过渡空间
  // ==========================================

  // --- 酒店与情趣房 (Love Hotels) ---
  {
    id: "env_love_hotel_round_bed",
    title: "情趣酒店：圆床",
    content: "Cramped love hotel room with a red circular bed. Mirrors on ceiling. Pink neon strip lighting. Tacky romance.",
    tags: ["environment", "hotel", "red", "bed", "tacky"],
    axes: { documentary_coldness: 0.5, social_discomfort: 0.8, lighting_hardness: 0.6 }
  },
  {
    id: "env_motel_bathroom_yellow",
    title: "旅馆浴室：黄光",
    content: "Small bathroom with yellowing tiles. Dim tungsten bulb. Shower curtain half open. Toiletries scattered on sink. Gritty realism.",
    tags: ["environment", "bathroom", "yellow", "gritty", "motel"],
    axes: { documentary_coldness: 0.9, lighting_hardness: 0.4, social_discomfort: 0.7 }
  },
  {
    id: "env_hotel_corridor_carpet",
    title: "酒店走廊：地毯",
    content: "Long hotel corridor with patterned ugly carpet. Low angle shot. Room service tray on the floor. The Shining vibe but cheap.",
    tags: ["environment", "hotel", "corridor", "carpet", "liminal"],
    axes: { documentary_coldness: 0.8, social_discomfort: 0.6 }
  },
  {
    id: "env_glass_shower_stall",
    title: "透明淋浴房",
    content: "See-through glass shower stall in the middle of a hotel room. Steamy glass. Water droplets. Voyeuristic design.",
    tags: ["environment", "shower", "glass", "wet", "hotel"],
    axes: { documentary_coldness: 0.6, camera_intrusion: 0.9 }
  },

  // --- 居家与凌乱 (Domestic Chaos / OnlyFans Vibe) ---
  {
    id: "env_messy_girl_room",
    title: "凌乱闺房：生活感",
    content: "Cluttered bedroom. Unmade bed with piles of clothes on a chair. Takeout boxes on the desk. Laptop screen glowing. Authentic 'Internet Girl' background.",
    tags: ["environment", "bedroom", "messy", "real", "home"],
    axes: { documentary_coldness: 0.4, material_presence: 0.9, body_reality: 0.7 }
  },
  {
    id: "env_dorm_bunk_bed",
    title: "女生宿舍：上下铺",
    content: "Cramped dormitory room with bunk beds. Hanging laundry blocking the view. Posters on the wall. Shared space intimacy.",
    tags: ["environment", "dorm", "bed", "cramped", "youth"],
    axes: { documentary_coldness: 0.5, social_discomfort: 0.4 }
  },
  {
    id: "env_kitchen_fridge_light",
    title: "深夜厨房：冰箱光",
    content: "Dark kitchen at night. Only light comes from the open fridge. Cold blue light illuminating the face. Midnight snack.",
    tags: ["environment", "kitchen", "night", "fridge", "home"],
    axes: { documentary_coldness: 0.7, lighting_hardness: 0.5 }
  },
  {
    id: "env_cluttered_vanity",
    title: "杂乱梳妆台",
    content: "Vanity table overflowing with makeup, cotton pads, and bottles. Mirror reflecting the mess. Ring light reflection.",
    tags: ["environment", "makeup", "mirror", "messy", "girl"],
    axes: { documentary_coldness: 0.5, material_presence: 0.8 }
  },
  {
    id: "env_living_room_couch",
    title: "客厅沙发：电视光",
    content: "Generic leather couch in a dark living room. Lit only by the flickering blue light of a TV. Lonely atmosphere.",
    tags: ["environment", "home", "couch", "tv", "dark"],
    axes: { documentary_coldness: 0.6, social_discomfort: 0.3 }
  },

  // --- 公共与半公共 (Public/Sleazy) ---
  {
    id: "env_public_toilet_stall",
    title: "公厕隔间：涂鸦",
    content: "Inside a public toilet stall. Graffiti on the door. Harsh fluorescent light. Claustrophobic angles. Forbidden/Cruising vibe.",
    tags: ["environment", "toilet", "public", "graffiti", "dirty"],
    axes: { documentary_coldness: 1.0, social_discomfort: 0.9, lighting_hardness: 0.8 }
  },
  {
    id: "env_ktv_room_dark",
    title: "KTV包厢：激光",
    content: "Dark KTV room. Leather sofa. spilled beer on the table. Red and green laser dots on the wall. Smoke filled.",
    tags: ["environment", "ktv", "party", "dark", "laser"],
    axes: { documentary_coldness: 0.7, lighting_hardness: 0.9, social_discomfort: 0.5 }
  },
  {
    id: "env_fitting_room_curtain",
    title: "优衣库试衣间",
    content: "Small fitting room with a beige curtain slightly open. Full length mirror. Pile of rejected clothes on the floor. Mall lighting.",
    tags: ["environment", "fitting-room", "mall", "mirror", "clothes"],
    axes: { documentary_coldness: 0.7, camera_intrusion: 0.7 }
  },
  {
    id: "env_stairwell_emergency",
    title: "消防通道：绿光",
    content: "Concrete stairwell with emergency exit sign (green glow). Cigarette butts on the floor. Cold, echoing, liminal space.",
    tags: ["environment", "stairs", "concrete", "cold", "green"],
    axes: { documentary_coldness: 0.95, social_discomfort: 0.7 }
  },
  {
    id: "env_convenience_store_aisle",
    title: "便利店：货架",
    content: "Aisle of a 24h convenience store. Brightly colored snacks, harsh white light. Reflection in the fridge glass doors. Lonely consumption.",
    tags: ["environment", "store", "bright", "pop", "night"],
    axes: { documentary_coldness: 0.8, lighting_hardness: 0.5 }
  },
  {
    id: "env_internet_cafe_booth",
    title: "网吧包间：烟味",
    content: "Dim internet cafe booth. RGB keyboard lights. Energy drink cans. Smoky atmosphere. Gamer girl vibe.",
    tags: ["environment", "cyber", "cafe", "dark", "screen"],
    axes: { documentary_coldness: 0.8, material_presence: 0.7 }
  },

  // --- 交通与户外 (Transit & Night) ---
  {
    id: "env_taxi_backseat_flash",
    title: "出租后座：皮质",
    content: "Back of a taxi. Flash reflecting off the black vinyl seat. City lights bokeh through the window. Safety partition visible.",
    tags: ["environment", "taxi", "car", "flash", "night"],
    axes: { documentary_coldness: 0.6, material_presence: 0.8, camera_intrusion: 0.7 }
  },
  {
    id: "env_night_street_blur",
    title: "深夜街头：动态",
    content: "Empty city street at 3AM. Streetlights streaking (motion blur). Wet asphalt. Subject standing under a lone streetlight.",
    tags: ["environment", "street", "night", "blur", "wet"],
    axes: { documentary_coldness: 0.6, composition_instability: 0.8 }
  },
  {
    id: "env_parking_garage_pillar",
    title: "地下车库：立柱",
    content: "Underground parking lot. Concrete pillars, yellow stripes. Dim lighting. Vast empty space. Echoes. Industrial coldness.",
    tags: ["environment", "garage", "concrete", "dark", "car"],
    axes: { documentary_coldness: 0.9, social_discomfort: 0.8 }
  },
  {
    id: "env_rooftop_water_tank",
    title: "天台水箱：生锈",
    content: "Rooftop of an old building. Rusted water tank. City skyline in the distance. Wind blowing. Urban decay.",
    tags: ["environment", "roof", "city", "rusty", "wind"],
    axes: { documentary_coldness: 0.7, material_presence: 0.6 }
  },
  {
    id: "env_subway_car_empty",
    title: "末班地铁：空旷",
    content: "Empty subway car interior. Plastic seats. Fluorescent lights reflecting on the window. Reflection of the subject in the dark glass.",
    tags: ["environment", "subway", "train", "cold", "night"],
    axes: { documentary_coldness: 0.9, social_discomfort: 0.6 }
  }
];
