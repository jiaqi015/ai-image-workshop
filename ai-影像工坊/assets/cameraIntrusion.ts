
import { CreativeAsset } from "../types";

export const CAMERA_INTRUSION_ASSETS: CreativeAsset[] = [
  // 4. 机位侵入与视角 (Angles)
  {
    id: "cam_webcam_wide_distortion",
    title: "网像头视角：广角畸变",
    content: "Low resolution webcam aesthetic. Wide angle distortion near the edges. Subject is sitting close to the lens (computer screen glow). Digital noise.",
    tags: ["camera", "webcam", "digital", "lo-fi"],
    axes: { camera_intrusion: 0.8, documentary_coldness: 0.7, composition_instability: 0.6 },
    usageNotes: ["模拟低像素感", "面部中心稍大"]
  },
  {
    id: "cam_high_angle_selfie",
    title: "高位自拍：经典死角",
    content: "Camera held high above head (MySpace/Selfie angle). Looking up allows for big eyes. Forehead distortion. Arm visible in corner/reflection.",
    tags: ["camera", "selfie", "high-angle", "y2k"],
    axes: { camera_intrusion: 0.9, gaze_pressure: 0.7, social_discomfort: 0.3 }
  },
  {
    id: "cam_boyfriend_pov_hand",
    title: "男友视角：伸出的手",
    content: "POV shot. A hand reaches out from behind the camera towards the subject's face or hair. Interaction is implied. Subject reacts to the hand.",
    tags: ["camera", "pov", "interaction", "intimate"],
    axes: { camera_intrusion: 0.95, social_discomfort: 0.5, body_reality: 0.6 }
  },
  {
    id: "cam_floor_level_up",
    title: "地视角：仰视裙摆/腿",
    content: "Camera placed on the floor looking up. Subject is towering over. Focus on shoes, legs, or ceiling lights. Vulnerable or dominant depending on pose.",
    tags: ["camera", "low-angle", "floor", "legs"],
    axes: { camera_intrusion: 0.8, composition_instability: 0.8, gaze_pressure: 0.4 }
  },
  {
    id: "cam_dutch_chaos_party",
    title: "派对混乱：甚至对不上焦",
    content: "Extreme dutch angle, blurry motion. Camera is being bumped or moved. Chaos, drunk, night out vibe. Nothing is straight.",
    tags: ["camera", "blur", "chaos", "motion"],
    axes: { composition_instability: 1.0, lighting_hardness: 0.7, gaze_pressure: 0.2 }
  },
  {
    id: "cam_peeking_door_gap",
    title: "门缝窥视：未授权的观察",
    content: "Shot through a slightly open door or wardrobe gap. Vertical framing restriction. Subject is unaware (or pretending to be).",
    tags: ["camera", "voyeur", "hiding", "door"],
    axes: { camera_intrusion: 0.7, social_discomfort: 0.9, documentary_coldness: 0.6 }
  }
];
