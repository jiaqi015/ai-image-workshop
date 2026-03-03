const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hitRate = (text, tokens = []) => {
  let hits = 0;
  for (const token of tokens) {
    if (String(text || "").includes(token)) hits += 1;
  }
  return tokens.length > 0 ? hits / tokens.length : 0;
};

export const computeMasterStyleMetricsSkill = ({
  prompt = "",
  payload = {},
  critic = {},
  adversarial = {},
  feasibility = {},
  physics = {},
} = {}) => {
  const text = String(prompt || "");
  const roughness = clamp(
    55 +
      hitRate(text, ["噪点", "失焦", "偏轴", "折痕", "磨损", "灰尘"]) * 70 -
      hitRate(text, ["无瑕", "完美", "光滑"]) * 55,
    0,
    100
  );
  const intrusionDistance = clamp(
    45 + hitRate(text, ["贴近", "近距离", "直闪", "盯住镜头", "擦身而过"]) * 85,
    0,
    100
  );
  const pauseTension = clamp(
    40 + hitRate(text, ["停住", "半拍", "未完成", "游离", "停顿"]) * 90,
    0,
    100
  );
  const nonPoseRate = clamp(
    50 + hitRate(text, ["不是摆拍", "别做标准姿势", "生活被突然截帧"]) * 90,
    0,
    100
  );
  const shootability = clamp(
    (Number(critic?.breakdown?.consistency || 75) +
      Number(feasibility?.feasibilityScore || 75) +
      Number(physics?.score || 75)) /
      3,
    0,
    100
  );
  const antiAiTexture = clamp(
    100 -
      (Number(adversarial?.score || 100) < 90 ? (90 - Number(adversarial?.score || 100)) * 1.8 : 0) -
      hitRate(text, ["8k", "cgi", "超现实渲染", "塑料皮肤"]) * 100,
    0,
    100
  );

  const masterLikeIndex = clamp(
    roughness * 0.2 +
      intrusionDistance * 0.18 +
      pauseTension * 0.18 +
      nonPoseRate * 0.16 +
      shootability * 0.16 +
      antiAiTexture * 0.12,
    0,
    100
  );

  return {
    roughness: Number(roughness.toFixed(1)),
    intrusionDistance: Number(intrusionDistance.toFixed(1)),
    pauseTension: Number(pauseTension.toFixed(1)),
    nonPoseRate: Number(nonPoseRate.toFixed(1)),
    shootability: Number(shootability.toFixed(1)),
    antiAiTexture: Number(antiAiTexture.toFixed(1)),
    masterLikeIndex: Number(masterLikeIndex.toFixed(1)),
    tags: {
      theme: payload?.themeLabel || payload?.themeKey || "",
      emotion: payload?.emotion || "",
      arcStage: payload?.arcStage || "",
    },
  };
};
