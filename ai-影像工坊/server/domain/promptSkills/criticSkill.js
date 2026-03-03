const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const containsAny = (text, tokens = []) => {
  const source = String(text || "");
  return tokens.some((token) => source.includes(token));
};

const hasValue = (value) => String(value || "").trim().length > 0;

const REQUIRED_PAYLOAD_KEYS = [
  "emotion",
  "cast",
  "location",
  "time",
  "wardrobeA",
  "wardrobeB",
  "propA",
  "propB",
  "action",
  "camera",
  "texture",
  "banA",
  "banB",
  "banC",
];

const STYLE_NOISE_TOKENS = ["唯美", "梦幻", "大片感", "仙气", "小清新"];
const AI_STYLE_TOKENS = ["超现实渲染", "8k", "cgi", "octane", "unreal engine", "塑料皮肤", "完美无瑕"];
const MECHANICAL_TEMPLATE_TOKENS = ["情绪定调为", "选角是", "场景放在", "服装用", "道具给", "动作是", "拍法用"];

const NIGHT_SCENE_PATTERN = /凌晨|深夜|夜里|夜班|夜|晚|雨后/;

const scoreLength = ({ length, range, target }) => {
  const [min, max] = range || [180, 220];
  if (length >= min && length <= max) return 100;
  const distance = Math.abs(length - target);
  return clamp(100 - distance * 3, 0, 100);
};

const scoreCompleteness = (payload = {}) => {
  const missing = REQUIRED_PAYLOAD_KEYS.filter((key) => !hasValue(payload?.[key]));
  if (missing.length === 0) {
    return { score: 100, missing };
  }
  const score = clamp(100 - missing.length * 15, 0, 100);
  return { score, missing };
};

const scoreConsistency = ({ payload = {}, prompt = "" }) => {
  let score = 100;
  const issues = [];
  const props = [payload.propA, payload.propB].map((item) => String(item || ""));
  const isConvenienceStore = String(payload.location || "").includes("便利店");
  const hasStoreProp = props.some((item) => item.includes("塑料袋") || item.includes("罐装饮料"));
  if (isConvenienceStore && !hasStoreProp) {
    score -= 30;
    issues.push("便利店场景缺少塑料袋或罐装饮料道具");
  }

  const isNightScene = NIGHT_SCENE_PATTERN.test(`${payload.time || ""}${payload.location || ""}`);
  if (isNightScene && !String(payload.camera || "").includes("直闪")) {
    score -= 20;
    issues.push("夜景镜头未包含直闪提示");
  }

  if (containsAny(prompt, STYLE_NOISE_TOKENS)) {
    score -= 25;
    issues.push("出现偏空泛风格词，降低纪实可信度");
  }

  return { score: clamp(score, 0, 100), issues };
};

const scoreRealism = ({ payload = {}, prompt = "" }) => {
  let score = 100;
  const issues = [];
  const text = String(prompt || "");

  const sensoryCueOk = /空气|潮湿|反光|风|噪声|气味|灯/.test(text);
  if (!sensoryCueOk) {
    score -= 12;
    issues.push("缺少现场感线索（空气/光线/环境噪声）");
  }

  const bodyCueOk = /毛孔|细汗|勒痕|灰尘|折痕|痘印|黑眼圈/.test(text);
  if (!bodyCueOk) {
    score -= 14;
    issues.push("缺少真实人体/材质细节");
  }

  if (containsAny(text, AI_STYLE_TOKENS)) {
    score -= 22;
    issues.push("出现AI渲染味词汇");
  }

  const mechanicalHits = MECHANICAL_TEMPLATE_TOKENS.filter((token) => text.includes(token)).length;
  if (mechanicalHits >= 3) {
    score -= 20;
    issues.push("模板痕迹过重，语言机械");
  }

  const wardrobeA = String(payload.wardrobeA || "");
  const wardrobeB = String(payload.wardrobeB || "");
  if (wardrobeA && wardrobeB && wardrobeA === wardrobeB) {
    score -= 10;
    issues.push("服装搭配重复，缺少真实造型关系");
  }

  return { score: clamp(score, 0, 100), issues };
};

const scoreDiversity = ({ similarity, maxSimilarityAllowed, forceAvoidEmotion, emotion }) => {
  let score = 100;
  const issues = [];
  if (similarity > maxSimilarityAllowed) {
    const overflow = similarity - maxSimilarityAllowed;
    score -= Math.ceil(overflow * 160);
    issues.push(`与近期提示词相似度过高(${similarity.toFixed(3)})`);
  }
  if (forceAvoidEmotion && emotion === forceAvoidEmotion) {
    score -= 25;
    issues.push(`连续情绪重复(${emotion})`);
  }
  return { score: clamp(score, 0, 100), issues };
};

export const evaluatePromptCriticSkill = ({
  candidate,
  similarity = 0,
  maxSimilarityAllowed = 0.45,
  forceAvoidEmotion = "",
  physics = {},
  adversarial = {},
  hardNegative = {},
  anchor = {},
} = {}) => {
  const payload = candidate?.payload || {};
  const prompt = candidate?.prompt || "";
  const length = Number(candidate?.length || String(prompt).length);
  const target = Number(candidate?.target || 200);
  const range = Array.isArray(candidate?.range) ? candidate.range : [180, 220];

  const lengthScore = scoreLength({ length, range, target });
  const completeness = scoreCompleteness(payload);
  const consistency = scoreConsistency({ payload, prompt });
  const realism = scoreRealism({ payload, prompt });
  const diversity = scoreDiversity({
    similarity,
    maxSimilarityAllowed,
    forceAvoidEmotion,
    emotion: payload.emotion,
  });
  const physicsScore = clamp(Number(physics?.score || 100), 0, 100);
  const adversarialScore = clamp(Number(adversarial?.score || 100), 0, 100);
  const hardNegativePenalty = clamp(Number(hardNegative?.penalty || 0), 0, 60);
  const anchorMissing = Number(anchor?.missingCount || 0);
  const anchorScore = clamp(100 - anchorMissing * 18, 0, 100);

  const weightedScore = Math.round(
    lengthScore * 0.14 +
      completeness.score * 0.16 +
      consistency.score * 0.18 +
      realism.score * 0.18 +
      diversity.score * 0.14 +
      physicsScore * 0.1 +
      adversarialScore * 0.1
  );
  const finalScore = clamp(Math.round(weightedScore - hardNegativePenalty * 0.35), 0, 100);

  const issues = [
    ...completeness.missing.map((key) => `缺少字段:${key}`),
    ...consistency.issues,
    ...realism.issues,
    ...diversity.issues,
  ];
  if (physicsScore < 80) issues.push("动作物理可拍性不足");
  if (adversarialScore < 84) issues.push("对抗评审风险偏高");
  if (hardNegativePenalty > 0) issues.push("命中负例词库");
  if (anchorMissing > 1) issues.push("多模态锚点不足");

  const pass =
    finalScore >= 78 &&
    issues.length === 0 &&
    realism.score >= 84 &&
    physicsScore >= 80 &&
    adversarialScore >= 84;
  return {
    pass,
    score: finalScore,
    issues,
    breakdown: {
      length: lengthScore,
      completeness: completeness.score,
      consistency: consistency.score,
      realism: realism.score,
      diversity: diversity.score,
      physics: physicsScore,
      adversarial: adversarialScore,
      anchor: anchorScore,
      hardNegativePenalty,
    },
  };
};
