
import { CreativeAsset } from "../types";
import { INTERACTIONS } from "./narrative";

// ==========================================
// 美术与视觉数据库 (Visuals Domain) - ULTRA EXPANDED
// 核心: 港风、胶片、高反差、生活化场景、复古织物
// ==========================================

// 1. 光影方案 (Lighting Scenarios)
export const LIGHTING_SCENARIOS = {
    LOW_TENSION: [
        "Soft diffused window light through lace curtains (afternoon nap vibe).",
        "Overcast flat light, low contrast, grey sky (documentary style).",
        "Dim tungsten bulb hanging from ceiling, warm and weak.",
        "Morning light hitting dust motes in a dark room.",
        "Reflection from a TV screen flickering on face.",
        "Candlelight in a temple, warm and smoky.",
        "Fluorescent tube light, slightly green flickering (office/school).",
        "Dappled sunlight through tree leaves.",
        "Light form a vending machine at night."
    ],
    HIGH_TENSION: [
        "Harsh on-camera direct flash, pitch black background (Snapshot style).",
        "Neon sign reflection (Red/Green) on wet skin (Wong Kar-wai style).",
        "Car headlights sweeping across a dark room.",
        "Single spotlight in darkness, interrogation vibe.",
        "High contrast sunlight, deep shadows, blown out highlights.",
        "Strobe light freezing motion.",
        "Heavy silhouette against a bright window.",
        "Mixed lighting: Blue twilight outside, warm lamp inside.",
        "Flashlight beam cutting through fog/smoke."
    ]
};

// 2. 胶片伪影 (Film Artifacts)
export const FILM_ARTIFACTS = [
    "Heavy film grain (ISO 1600/3200).",
    "Light leaks (orange/red burns).",
    "Green color cast from expired film.",
    "Halation (red glow) around bright lights (Cinestill style).",
    "Motion blur (Are-Bure-Boke).",
    "Vignetting in corners.",
    "Dust and scratches on negative.",
    "Date stamp (e.g., '98 04 05) in orange dot font.",
    "Slightly out of focus (soft focus).",
    "Chromatic aberration on edges.",
    "Overexposed washout.",
    "Underexposed muddy shadows."
];

// 3. 造型库 (Looks) - 东亚特色
export const LOOK_ASSETS: CreativeAsset[] = [
    { id: "look_school", content: "Oversized Asian school tracksuit uniform (blue/white)", tags: ["youth", "school", "retro"], intensity: 3 },
    { id: "look_qipao", content: "Silk Cheongsam (Qipao) with floral pattern, tight fit", tags: ["tradition", "sexy", "retro"], intensity: 5 },
    { id: "look_worker", content: "Blue collar worker uniform, stained and worn", tags: ["worker", "real", "raw"], intensity: 4 },
    { id: "look_tanktop", content: "White ribbed tank top (men's style), sweaty", tags: ["summer", "raw", "simple"], intensity: 3 },
    { id: "look_suit", content: "Oversized cheap business suit, ill-fitting", tags: ["office", "sad", "retro"], intensity: 3 },
    { id: "look_dress", content: "Vintage floral slip dress, 90s style", tags: ["vintage", "soft", "summer"], intensity: 4 },
    { id: "look_coat", content: "Heavy wool trench coat, noir style", tags: ["winter", "noir", "mystery"], intensity: 4 },
    { id: "look_pajamas", content: "Silk pajamas worn on the street (Shanghai style)", tags: ["casual", "street", "unique"], intensity: 3 },
    { id: "look_leather", content: "Worn leather jacket, motorcycle style", tags: ["cool", "rebel"], intensity: 4 },
    { id: "look_shirt", content: "White button-down shirt, unbuttoned, messy", tags: ["classic", "messy", "office"], intensity: 3 },
    { id: "look_raincoat", content: "Transparent plastic raincoat, wet", tags: ["rain", "texture"], intensity: 4 },
    { id: "look_sweater", content: "Hand-knitted sweater, slightly unraveling", tags: ["home", "soft", "winter"], intensity: 2 },
    { id: "look_gyaru", content: "2000s Gyaru style, leg warmers, mini skirt (Y2K)", tags: ["y2k", "fashion", "japan"], intensity: 5 },
    { id: "look_grunge", content: "Flannel shirt and torn jeans, dirty", tags: ["grunge", "street"], intensity: 3 }
];

// 4. 亚文化/风格 (Subcultures)
export const SUBCULTURES: CreativeAsset[] = [
    { id: "sub_hk_retro", content: "Hong Kong Retro 80s/90s", tags: ["hk", "retro", "warm"], intensity: 4 },
    { id: "sub_y2k_asia", content: "Asian Y2K Millennium", tags: ["y2k", "tech", "pop"], intensity: 4 },
    { id: "sub_shamate", content: "Shamate / Smart (Rural Goth/Punk)", tags: ["punk", "raw", "unique"], intensity: 5 },
    { id: "sub_school_new_wave", content: "Taiwan New Wave Cinema School", tags: ["taiwan", "youth", "clean"], intensity: 3 },
    { id: "sub_city_pop", content: "City Pop Aesthetic", tags: ["japan", "city", "retro"], intensity: 3 },
    { id: "sub_grunge", content: "Asian Grunge / Underground Rock", tags: ["music", "dark", "messy"], intensity: 4 },
    { id: "sub_trad_fusion", content: "Traditional Fusion (Hanfu mixed with street)", tags: ["tradition", "modern"], intensity: 3 },
    { id: "sub_noir", content: "Neo-Noir / Crime Thriller", tags: ["dark", "crime", "cool"], intensity: 5 }
];

// 5. 材质 (Textures)
export const TEXTURES: CreativeAsset[] = [
    { id: "tex_plastic", content: "Dirty plastic sheet / tarp", tags: ["plastic", "cheap"], intensity: 4 },
    { id: "tex_concrete", content: "Cracked concrete wall with moss", tags: ["urban", "decay"], intensity: 3 },
    { id: "tex_tiles", content: "Green/White bathroom tiles", tags: ["cold", "retro"], intensity: 4 },
    { id: "tex_glass_rain", content: "Glass with raindrops condensation", tags: ["wet", "sad"], intensity: 3 },
    { id: "tex_smoke", content: "Thick cigarette smoke haze", tags: ["atmosphere", "blur"], intensity: 4 },
    { id: "tex_neon_wet", content: "Wet pavement reflecting neon", tags: ["city", "night"], intensity: 4 },
    { id: "tex_lace", content: "Cheap synthetic lace", tags: ["fabric", "vintage"], intensity: 3 },
    { id: "tex_velvet", content: "Red velvet fabric (curtain/seat)", tags: ["luxury", "retro"], intensity: 4 },
    { id: "tex_rust", content: "Rusted metal bars", tags: ["decay", "industrial"], intensity: 3 },
    { id: "tex_screen", content: "Pixelated screen texture (CRT)", tags: ["tech", "retro"], intensity: 4 }
];

// 6. 情绪与色板
export const MOOD_ASSETS: CreativeAsset[] = [
    { id: "m_melancholy", content: "Melancholic longing (Mono no aware)", tags: ["sad", "soft"], intensity: 3 },
    { id: "m_numb", content: "Urban numbness / dissociation", tags: ["cold", "empty"], intensity: 4 },
    { id: "m_frenzy", content: "Manic frenzy / chaos", tags: ["crazy", "high"], intensity: 5 },
    { id: "m_intimate", content: "Quiet intimacy / tenderness", tags: ["love", "soft"], intensity: 2 },
    { id: "m_danger", content: "Latent danger / tension", tags: ["fear", "dark"], intensity: 4 },
    { id: "m_nostalgia", content: "Sepia-toned nostalgia", tags: ["memory", "warm"], intensity: 3 }
];

export const LIGHTING_ASSETS: CreativeAsset[] = [
    { id: "l_neon", content: "Neon green/red split lighting", tags: ["city", "wong_kar_wai"], intensity: 5 },
    { id: "l_tungsten", content: "Warm tungsten lamp", tags: ["home", "retro"], intensity: 3 },
    { id: "l_flash", content: "Direct harsh flash", tags: ["raw", "party"], intensity: 5 },
    { id: "l_natural", content: "Soft overcast daylight", tags: ["real", "soft"], intensity: 2 },
    { id: "l_shadow", content: "Heavy shadow / silhouette", tags: ["noir", "mystery"], intensity: 4 }
];

export const COLOR_PALETTES: CreativeAsset[] = [
    { id: "c_wkw", content: "Wong Kar-wai Green/Red/Gold", tags: ["wong_kar_wai", "retro"], intensity: 5 },
    { id: "c_moriyama", content: "High Contrast Black & White", tags: ["moriyama", "bw"], intensity: 5 },
    { id: "c_ninagawa", content: "Acid Vivid Red/Blue/Pink", tags: ["ninagawa", "color"], intensity: 5 },
    { id: "c_hk", content: "Hong Kong Night (Cyan/Magenta)", tags: ["hk", "neon"], intensity: 4 },
    { id: "c_fade", content: "Faded Polaroid (Cream/Green)", tags: ["vintage", "soft"], intensity: 3 },
    { id: "c_cold", content: "Hospital Cold (Blue/Green)", tags: ["cold", "sick"], intensity: 4 },
    { id: "c_warm", content: "Tungsten Interior (Orange/Brown)", tags: ["warm", "home"], intensity: 3 },
    { id: "c_kodak", content: "Kodak Portra Gold (Yellow/Teal)", tags: ["film", "summer"], intensity: 3 }
];

export const FLAT_VISUALS = {
    LOOKS: LOOK_ASSETS.map(a => a.content),
    MOODS: MOOD_ASSETS.map(a => a.content),
    LIGHTINGS: LIGHTING_ASSETS.map(a => a.content),
    ACTIONS: INTERACTIONS.map(a => a.content),
    LOCATIONS: [
        "Noodle Shop", "Mahjong Parlor", "Old Apartment", "Rooftop", "Night Market",
        "Subway Station", "Karaoke Room", "Bathhouse", "Alleyway", "Convenience Store",
        "Temple", "Wet Market", "Internet Cafe", "Train Car", "School Classroom",
        "Dormitory", "Hospital Corridor", "Stairwell", "Balcony", "Pedestrian Bridge"
    ]
};
