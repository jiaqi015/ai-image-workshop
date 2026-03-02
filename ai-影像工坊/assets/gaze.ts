
import { CreativeAsset } from "../types";

export const GAZE_ASSETS: CreativeAsset[] = [
  // ==========================================
  // 2. 眼神与面部 (Gaze & Face)
  // 核心：挑逗、迷离、遮挡、陈冠希式痞气、HKDoll式神秘
  // ==========================================

  // --- 迷离与高潮感 (Ecstasy / Haze) ---
  {
    id: "gaze_rolled_back_lite",
    title: "微翻白眼：失神",
    content: "Eyes rolled back slightly, showing whites. Eyelids fluttering half-closed. Mouth slightly open, tongue visible behind teeth. Expression of overwhelming sensation.",
    tags: ["gaze", "ecstasy", "ahegao", "provocative", "hot"],
    axes: { gaze_pressure: 0.4, body_reality: 0.9, social_discomfort: 0.8 }
  },
  {
    id: "gaze_biting_lip_focus",
    title: "咬唇失焦：抑制",
    content: "Eyes slightly out of focus (dreamy), lower lip bitten hard by teeth. Breathing through mouth. A state of high physiological arousal or anxiety.",
    tags: ["gaze", "dreamy", "mouth", "tension", "bite"],
    axes: { gaze_pressure: 0.5, body_reality: 0.8 }
  },
  {
    id: "gaze_sweaty_hair_stick",
    title: "湿发黏连：汗水",
    content: "Black hair strands sticking to sweaty forehead and cheeks. Eyes looking up through the hair. Exhausted but satisfied expression.",
    tags: ["gaze", "sweat", "hair", "tired", "after"],
    axes: { gaze_pressure: 0.6, body_reality: 0.9 }
  },
  {
    id: "gaze_mouth_slightly_open",
    title: "微张嘴：喘息",
    content: "Lips parted, jaw relaxed, taking a breath. Saliva bridge visible between lips. Vulnerable and inviting.",
    tags: ["gaze", "mouth", "breath", "sexy"],
    axes: { gaze_pressure: 0.5, body_reality: 0.7 }
  },

  // --- 挑衅与直视 (Provocation / Yonehara Style) ---
  {
    id: "gaze_tongue_out_flash",
    title: "吐舌快照：痞气",
    content: "Sticking tongue out at the camera (bratty attitude). Direct flash blinding the eyes (red-eye effect). Snapshot aesthetic. Playful and rude.",
    tags: ["gaze", "tongue", "bratty", "snapshot", "yonehara", "flash"],
    axes: { gaze_pressure: 0.9, camera_intrusion: 0.9, lighting_hardness: 1.0 }
  },
  {
    id: "gaze_middle_finger_blur",
    title: "竖中指：模糊",
    content: "Focus on the face, but a blurred hand in the foreground is giving the middle finger. Expression is a smirk. Rebellious.",
    tags: ["gaze", "rude", "hand", "smirk", "edison"],
    axes: { gaze_pressure: 0.8, social_discomfort: 0.9 }
  },
  {
    id: "gaze_disdain_looking_down",
    title: "俯视鄙夷：看垃圾",
    content: "Looking down at the camera (camera on floor). Chin tucked in. Expression of slight disgust or dominance. 'Step on you' vibe.",
    tags: ["gaze", "dominant", "disdain", "pov", "step"],
    axes: { gaze_pressure: 1.0, social_discomfort: 0.9, camera_intrusion: 0.8 }
  },
  {
    id: "gaze_smeared_makeup_laugh",
    title: "花妆大笑：崩坏",
    content: "Mascara smeared everywhere. Laughing manically/hysterically at the camera. Flash photography. Drunk and chaotic.",
    tags: ["gaze", "messy", "laugh", "drunk", "makeup"],
    axes: { gaze_pressure: 0.7, composition_instability: 0.9 }
  },
  {
    id: "gaze_biting_finger",
    title: "咬手指：幼稚诱惑",
    content: "Biting on own thumb or knuckle. Looking up at camera with innocent but hungry eyes. Saliva distinct on the finger.",
    tags: ["gaze", "mouth", "teasing", "innocent", "hand"],
    axes: { gaze_pressure: 0.8, social_discomfort: 0.5 }
  },

  // --- 神秘与遮挡 (Mystery / HongKongDoll Style) ---
  {
    id: "gaze_mask_mystery",
    title: "口罩姬：只露眼睛",
    content: "Wearing a black disposable face mask. Only eyes visible, looking directly at lens. Focus on eyelashes and contact lenses. Street aesthetic.",
    tags: ["gaze", "mask", "hkdoll", "mystery", "street"],
    axes: { gaze_pressure: 0.9, social_discomfort: 0.4, documentary_coldness: 0.7 }
  },
  {
    id: "gaze_hair_covered_face",
    title: "乱发遮面：贞子感",
    content: "Face completely covered by messy long black hair. One eye peeking through the strands. Creepy but alluring.",
    tags: ["gaze", "hair", "messy", "hiding", "mystery"],
    axes: { gaze_pressure: 0.7, camera_intrusion: 0.6 }
  },
  {
    id: "gaze_blindfold_lace",
    title: "蕾丝眼罩：束缚",
    content: "Eyes covered by a piece of black lace or fabric. Mouth is the focus. Submissive posture.",
    tags: ["gaze", "blindfold", "submissive", "mouth"],
    axes: { gaze_pressure: 0.0, material_presence: 0.8, social_discomfort: 0.7 }
  },
  {
    id: "gaze_phone_blocking_face",
    title: "手机挡脸：对镜",
    content: "Taking a mirror selfie, phone blocks the entire face. Focus on the body and the phone case. Anonymous.",
    tags: ["gaze", "selfie", "mirror", "anonymous", "phone"],
    axes: { gaze_pressure: 0.0, camera_intrusion: 0.8 }
  },

  // --- 情绪与状态 (Mood & State) ---
  {
    id: "gaze_crying_makeup_run",
    title: "哭花妆：破碎感",
    content: "Mascara running down cheeks in black streaks. Eyes red and puffy. Looking straight at camera with a blank, numb expression.",
    tags: ["gaze", "cry", "sad", "messy", "makeup", "numb"],
    axes: { gaze_pressure: 0.8, body_reality: 0.9, documentary_coldness: 0.6 }
  },
  {
    id: "gaze_dead_fish_eyes",
    title: "死鱼眼：厌世",
    content: "Completely dead, emotionless stare. Mouth slightly open. 'Done with everything' attitude. Cold realism.",
    tags: ["gaze", "dead", "bored", "real", "cold"],
    axes: { gaze_pressure: 0.5, documentary_coldness: 1.0 }
  },
  {
    id: "gaze_side_eye_judgment",
    title: "侧目：审视",
    content: "Looking sideways at the camera without turning head. Whites of eyes visible. Judgmental and sharp.",
    tags: ["gaze", "side", "judgment", "sharp"],
    axes: { gaze_pressure: 0.7, social_discomfort: 0.6 }
  },
  {
    id: "gaze_closing_eyes_flash",
    title: "闭眼：被闪瞎",
    content: "Eyes squeezed shut reacting to a harsh flash. Hand half-raised. Candid accident.",
    tags: ["gaze", "closed", "flash", "accident", "candid"],
    axes: { gaze_pressure: 0.2, camera_intrusion: 1.0 }
  },
  {
    id: "gaze_looking_at_food",
    title: "盯着食物：欲望",
    content: "Intense focus on eating something (popsicle, fruit, noodle). Ignoring the camera. Oral fixation.",
    tags: ["gaze", "food", "eat", "mouth", "ignore"],
    axes: { gaze_pressure: 0.1, body_reality: 0.8 }
  },
  {
    id: "gaze_wink_playful",
    title: "眨眼：俏皮",
    content: "A clumsy, exaggerated wink. Tongue slightly out. Trying to be cute but looking a bit messy.",
    tags: ["gaze", "wink", "cute", "playful"],
    axes: { gaze_pressure: 0.6, social_discomfort: 0.2 }
  },
  {
    id: "gaze_upwards_pov",
    title: "仰视 POV：臣服",
    content: "Eyes looking up towards the lens (POV style). Neck stretched. Vulnerable and waiting.",
    tags: ["gaze", "up", "pov", "submissive"],
    axes: { gaze_pressure: 0.8, camera_intrusion: 0.9 }
  }
];
