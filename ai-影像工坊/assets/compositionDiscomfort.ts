
import { CreativeAsset } from "../types";

export const COMPOSITION_DISCOMFORT_ASSETS: CreativeAsset[] = [
  // 6. 构图的不适与张力 (Framing Tension)
  {
    id: "comp_headless_torso",
    title: "无头躯干：物化视角",
    content: "Frame crops the head out completely. Focus is on the outfit, chest, or posture. Subject becomes an anonymous body. Selfie style often used in fashion checks.",
    tags: ["composition", "headless", "body", "crop"],
    axes: { composition_instability: 0.6, social_discomfort: 0.8, gaze_pressure: 0.0 },
    riskFlags: ["sexualized_intent"]
  },
  {
    id: "comp_legs_against_wall",
    title: "倒置：墙上的腿",
    content: "Subject lying on bed/floor, legs up against the wall. Upside down perspective or focus on feet/legs. Lazy, bored Sunday vibe.",
    tags: ["composition", "legs", "lazy", "upside-down"],
    axes: { composition_instability: 0.7, body_reality: 0.6, social_discomfort: 0.2 }
  },
  {
    id: "comp_corner_trapped",
    title: "角落：被围困",
    content: "Subject pushed into the corner of a room. Walls visible on both sides. Camera blocking the exit. Psychological pressure.",
    tags: ["composition", "corner", "trapped", "pressure"],
    axes: { composition_instability: 0.4, camera_intrusion: 0.8, social_discomfort: 0.9 }
  },
  {
    id: "comp_too_much_ceiling",
    title: "失衡：过多的天花板",
    content: "Camera pointed slightly up, 70% of the frame is the boring white ceiling. Subject is at the bottom. Accidental/Amateur aesthetic.",
    tags: ["composition", "ceiling", "bad-framing", "amateur"],
    axes: { composition_instability: 0.9, documentary_coldness: 0.6 }
  },
  {
    id: "comp_partially_out_of_frame",
    title: "出画：来不及捕捉",
    content: "Subject is moving out of the frame. Only half the face or body is visible. Motion blur. Sense of fleeing or dodging.",
    tags: ["composition", "motion", "crop", "mistake"],
    axes: { composition_instability: 1.0, camera_intrusion: 0.5 }
  }
];
