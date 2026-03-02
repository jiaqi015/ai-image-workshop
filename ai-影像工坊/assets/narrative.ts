
import { CreativeAsset } from "../types";

// ==========================================
// 叙事与张力数据库 (Narrative Domain) - ULTRA EXPANDED
// 核心: 东方含蓄、压抑、家庭羁绊、市井生活、瞬间的崩坏
// ==========================================

// 1. 情绪状态机 (Emotional State Machine)
export const EMOTIONAL_STATES = [
    // Low Tension (日常/麻木)
    { id: "st_spacing_out", tension: 0.1, content: "spacing out with mouth slightly open, brain fog", desc: "【放空】大脑停转，嘴微张，完全无防备。" },
    { id: "st_dozing", tension: 0.2, content: "dozing off on a plastic chair, head nodding", desc: "【打盹】在塑料椅上昏昏欲睡，重心不稳。" },
    { id: "st_eating_alone", tension: 0.3, content: "eating noodles alone, staring at phone, slurping", desc: "【独食】机械地吃面，盯着手机屏幕反射的光。" },
    { id: "st_squatting", tension: 0.2, content: "Asian squat, smoking a cigarette, waiting", desc: "【蹲守】标志性的亚洲蹲，抽着烟，漫无目的。" },
    
    // Mid Tension (焦虑/社交)
    { id: "st_fake_smile", tension: 0.5, content: "forced polite smile, eyes not smiling, stiff jaw", desc: "【假笑】营业式微笑，眼底冰冷，下颌僵硬。" },
    { id: "st_checking_phone", tension: 0.6, content: "anxiously refreshing a chat app, screen light on face", desc: "【查岗】疯狂刷新聊天记录，屏幕蓝光映在脸上。" },
    { id: "st_eavesdropping", tension: 0.5, content: "pretending to read but listening to neighbor, eyes shifted", desc: "【偷听】假装看书，眼珠斜视，捕捉隔壁的动静。" },
    { id: "st_holding_back", tension: 0.6, content: "biting lip to stop saying something, neck tendon visible", desc: "【欲言又止】话到嘴边咽下去，脖颈青筋微露。" },

    // High Tension (崩溃/情欲/暴力)
    { id: "st_silent_cry", tension: 0.8, content: "tears streaming down without facial movement, silent crying", desc: "【默泪】面无表情地流泪，没有声音，只有液体。" },
    { id: "st_hysteria_laugh", tension: 0.9, content: "manic laughter, head thrown back, hair messy, almost crying", desc: "【歇斯底里】笑到像在哭，头发凌乱，精神崩坏。" },
    { id: "st_intimate_breath", tension: 0.8, content: "breathing heavily against glass/skin, fogging it up", desc: "【贴近呼吸】由于距离过近而急促的呼吸，雾气凝结。" },
    { id: "st_drunk_vomit", tension: 0.9, content: "leaning over a toilet/street corner, messy, ruined elegance", desc: "【醉吐】狼狈不堪，呕吐后的虚脱，残留的口红。" },
    { id: "st_fight_aftermath", tension: 0.8, content: "disheveled clothes, red marks on skin, panting", desc: "【争执后】衣衫不整，皮肤上的抓痕，激烈的余韵。" },
    { id: "st_dissociation", tension: 0.7, content: "looking at own hand as if it belongs to a stranger", desc: "【解离】看着自己的手，仿佛不属于自己。" }
];

// 2. 微动作库 (Micro Gestures) - 增加中式特色
export const MICRO_GESTURES = [
    "Cracking sunflower seeds with front teeth.",
    "Fanning self with a plastic fan or paper.",
    "Picking teeth with a toothpick, hand covering mouth.",
    "Rolling up a pant leg (Uncle style).",
    "Adjusting glasses that keep sliding down nose.",
    "Rubbing a jade bracelet or prayer beads.",
    "Applying medicated oil (Tiger Balm) to temples.",
    "Slurping soup loudly.",
    "Squashing a cigarette butt into a rice bowl.",
    "Tying hair back with a rubber band from the wrist.",
    "Picking at a label on a beer bottle.",
    "Checking teeth in a compact mirror.",
    "Pulling up a slipping bra strap through clothes.",
    "Wiping sweat from forehead with back of hand.",
    "Shaking leg uncontrollably (nervous tic).",
    "Peeling a mandarin orange carefully.",
    "Counting cash quickly."
];

// 3. 混沌因子库 (Chaos Elements) - 增加环境干扰
export const CHAOS_ELEMENTS = [
    "A stray dog walking into the frame.",
    "Steam from a dim sum basket obscuring the face.",
    "A plastic bag flying in the wind.",
    "A fly landing on the food/face.",
    "Cigarette smoke blowing directly into the lens.",
    "A passerby's arm blocking the view.",
    "Raindrops smearing the makeup.",
    "A flickering neon sign casting erratic shadows.",
    "Lens flare from a passing taxi headlight.",
    "Confetti stuck in hair.",
    "A moth attracted to the light source.",
    "Spilled tea spreading on the table.",
    "A child running past in a blur."
];

// 4. 物理瑕疵库 (Imperfections)
export const IMPERFECTIONS: string[] = [
    "Mosquito bite on the leg with a cross fingernail mark.",
    "Grease stain on the shirt collar.",
    "Chipped red nail polish.",
    "A band-aid peeling off the heel.",
    "Sweat stains under the armpits.",
    "Lipstick on teeth.",
    "Mascara running from humidity/tears.",
    "A run in the stockings.",
    "Food stuck between teeth.",
    "Bruise on the knee.",
    "Dandruff on black shoulder.",
    "Acne patch on the chin.",
    "Static hair sticking to face.",
    "Yellow nicotine stain on fingers."
];

// 5. 叙事微情节 (Micro Plots) - 极具画面感的中式/东亚场景
export const MICRO_PLOTS: CreativeAsset[] = [
    { id: "plot_noodle_shop", content: "Eating alone in a steamy noodle shop late at night, glasses fogged up.", tags: ["lonely", "food", "city"], intensity: 3 },
    { id: "plot_hair_cut", content: "Getting a haircut in a retro barber shop, staring at self in mirror.", tags: ["change", "retro", "mirror"], intensity: 3 },
    { id: "plot_rain_wait", content: "Waiting for rain to stop under a shop awning, soaking wet shoes.", tags: ["rain", "waiting", "moody"], intensity: 4 },
    { id: "plot_ktv_cry", content: "Crying while singing in a noisy KTV room, clutching the mic.", tags: ["sad", "noise", "party"], intensity: 5 },
    { id: "plot_balcony_smoke", content: "Smoking on a cramped apartment balcony, looking at neighbor's laundry.", tags: ["city", "home", "smoke"], intensity: 3 },
    { id: "plot_bus_sleep", content: "Falling asleep on a night bus, head resting on vibrating window.", tags: ["tired", "travel", "night"], intensity: 2 },
    { id: "plot_fight_kitchen", content: "After a fight in a small kitchen, broken plate on floor.", tags: ["angry", "domestic", "messy"], intensity: 5 },
    { id: "plot_mahjong", content: "Playing mahjong, smoke filled room, intense focus on a tile.", tags: ["tradition", "game", "smoke"], intensity: 4 },
    { id: "plot_street_food", content: "Eating street food on a plastic stool, crouching.", tags: ["street", "raw", "food"], intensity: 3 },
    { id: "plot_roof_firework", content: "Watching distant fireworks from a rooftop water tank.", tags: ["dreamy", "night", "youth"], intensity: 4 },
    { id: "plot_exam_study", content: "Studying under a lamp, piles of books, exhausted.", tags: ["stress", "youth", "indoor"], intensity: 3 },
    { id: "plot_train_leave", content: "Watching a train leave the platform, standing yellow line.", tags: ["goodbye", "travel", "sad"], intensity: 4 },
    { id: "plot_hospital_wait", content: "Waiting in a hospital corridor, smelling disinfectant.", tags: ["sick", "cold", "anxious"], intensity: 4 },
    { id: "plot_bike_fix", content: "Fixing a bicycle chain, grease on hands.", tags: ["worker", "street", "action"], intensity: 3 },
    { id: "plot_laundry_hang", content: "Hanging laundry in a narrow alleyway, sheets blowing.", tags: ["domestic", "life", "wind"], intensity: 2 },
    { id: "plot_phone_booth", content: "Hiding in a phone booth from the rain (or crying).", tags: ["rain", "city", "retro"], intensity: 4 },
    { id: "plot_zipper_stuck", content: "Trying to zip up a tight dress, struggling, skin caught.", tags: ["tension", "dress", "struggle"], intensity: 4 },
    { id: "plot_shoe_heel_fix", content: "Fixing a broken heel on the street, leaning against a wall.", tags: ["shoes", "street", "action"], intensity: 3 },
    { id: "plot_bra_adjust", content: "Adjusting a bra strap that slipped down, through the shirt.", tags: ["intimate", "adjust", "real"], intensity: 3 }
];

// 6. 感官通感 (Sensory) - 嗅觉与触觉
export const SENSORY_DETAILS = [
    "The smell of frying oil and garlic.",
    "The sticky humidity of the rainy season.",
    "The smell of stale cigarette smoke in curtains.",
    "The sound of cicadas buzzing loudly.",
    "The smell of disinfectant and bleach.",
    "The taste of cheap beer and metal.",
    "The feeling of a cold tile floor on bare feet.",
    "The smell of burning incense.",
    "The damp moldy smell of an old room.",
    "The vibration of a passing subway train.",
    "The blinding glare of neon lights on wet pavement.",
    "The suffocating heat of a summer afternoon."
];

export const ATMOSPHERES = SENSORY_DETAILS.map((s, i) => ({ id: `atm_${i}`, content: s, tags: ["sense"], intensity: 3 }));
export const PUNCTUMS = IMPERFECTIONS.map((p, i) => ({ id: `punc_${i}`, content: p, tags: ["flaw"], intensity: 3 }));
export const INTERACTIONS = MICRO_PLOTS;
