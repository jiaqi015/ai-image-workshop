
import { CreativeAsset } from "../types";

export const LIGHTING_HARD_ASSETS: CreativeAsset[] = [
  // 5. 硬光与人造光源 (Artificial Light)
  {
    id: "light_phone_flashlight",
    title: "手机补光：单点冷光",
    content: "Lighting comes from a single phone flashlight held by the subject or photographer. Harsh, cold LED light. Rest of the room is pitch black. Sharp shadows.",
    tags: ["lighting", "phone", "led", "harsh"],
    axes: { lighting_hardness: 0.9, documentary_coldness: 0.8, composition_instability: 0.5 },
    usageNotes: ["强调光源的单一性和冷感"]
  },
  {
    id: "light_bathroom_fluorescent",
    title: "浴室顶光：惨白与泛绿",
    content: "Overhead cheap fluorescent tubes in a tiled bathroom. Skin looks slightly green/pale. Unflattering, raw, clinical reality.",
    tags: ["lighting", "fluorescent", "bathroom", "ugly"],
    axes: { lighting_hardness: 0.6, documentary_coldness: 1.0, body_reality: 0.9 }
  },
  {
    id: "light_ktv_rgb_laser",
    title: "KTV激光：廉价的迷幻",
    content: "Dark room cut by chaotic RGB laser dots (red/green pattern). Smoky atmosphere. Faces illuminated in patches of intense color.",
    tags: ["lighting", "ktv", "laser", "color"],
    axes: { lighting_hardness: 0.8, composition_instability: 0.9, social_discomfort: 0.4 }
  },
  {
    id: "light_tv_screen_glow",
    title: "电视辉光：蓝色幽灵",
    content: "Only light source is a TV screen. Flickering blue/white light on the face. Eyes reflect the screen. Passive atmosphere.",
    tags: ["lighting", "screen", "blue", "soft"],
    axes: { lighting_hardness: 0.4, documentary_coldness: 0.7, gaze_pressure: 0.3 }
  },
  {
    id: "light_car_dashboard",
    title: "仪表盘光：狭窄空间",
    content: "Face lit from below by car dashboard lights (orange/green). Background is passing city streaks. Intimate, enclosed space.",
    tags: ["lighting", "car", "night", "intimate"],
    axes: { lighting_hardness: 0.5, social_discomfort: 0.3, camera_intrusion: 0.6 }
  },
  {
    id: "light_ring_light_reflection",
    title: "环形灯：网红眼神光",
    content: "Perfectly even, flat lighting on face. Distinct ring-shape catchlight in pupils. 'Livestreamer' aesthetic. Artificial perfection.",
    tags: ["lighting", "ringlight", "artificial", "flat"],
    axes: { lighting_hardness: 0.3, documentary_coldness: 0.9, gaze_pressure: 0.8 }
  }
];
