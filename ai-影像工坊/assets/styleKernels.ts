
export const STYLE_KERNELS = {
  invasive_gaze_core: {
    intent: "侵入式凝视 + 不可退场",
    targetAxes: {
      gaze_pressure: 0.9,
      camera_intrusion: 0.85,
      social_discomfort: 0.8,
      documentary_coldness: 0.7,
      material_presence: 0.6,
      composition_instability: 0.55,
      lighting_hardness: 0.65,
      body_reality: 0.6
    }
  },
  material_oppression: {
    intent: "材质压迫 + 物理存在感",
    targetAxes: {
      material_presence: 0.95,
      lighting_hardness: 0.8,
      documentary_coldness: 0.75,
      gaze_pressure: 0.65,
      camera_intrusion: 0.6,
      composition_instability: 0.5,
      body_reality: 0.55,
      social_discomfort: 0.6
    }
  },
  body_reality_documentary: {
    intent: "身体现实重量 + 冷静纪录",
    targetAxes: {
      body_reality: 0.95,
      documentary_coldness: 0.9,
      gaze_pressure: 0.6,
      camera_intrusion: 0.55,
      material_presence: 0.55,
      lighting_hardness: 0.6,
      composition_instability: 0.4,
      social_discomfort: 0.55
    }
  }
};
