const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MODE_PROFILE = {
  fast: {
    maxAttempts: 7,
    maxSimilarityAllowed: 0.5,
    baseExploration: 0.52,
    criticPassScore: 76,
  },
  pro: {
    maxAttempts: 12,
    maxSimilarityAllowed: 0.45,
    baseExploration: 0.62,
    criticPassScore: 79,
  },
};

const TENSION_PROFILE = {
  low: {
    explorationDelta: -0.06,
    similarityDelta: 0.03,
    passScoreDelta: -1,
  },
  medium: {
    explorationDelta: 0,
    similarityDelta: 0,
    passScoreDelta: 0,
  },
  high: {
    explorationDelta: 0.07,
    similarityDelta: -0.03,
    passScoreDelta: 1,
  },
};

const resolveMode = (mode) => {
  const normalized = String(mode || "pro").toLowerCase();
  return normalized === "fast" ? "fast" : "pro";
};

const resolveTensionLevel = (value) => {
  const normalized = String(value || "medium").toLowerCase();
  if (normalized === "low") return "low";
  if (normalized === "high") return "high";
  return "medium";
};

const resolveTargetLength = (targetLength) => {
  const value = Number(targetLength);
  if (!Number.isFinite(value)) return 200;
  return clamp(Math.round(value), 180, 240);
};

const computeRecentDiversity = (recentHistory = []) => {
  if (!recentHistory.length) return 1;
  const sample = recentHistory.slice(-6);
  const uniqueThemes = new Set(sample.map((item) => item.themeKey).filter(Boolean));
  return clamp(uniqueThemes.size / sample.length, 0, 1);
};

const mergeThemeWeights = (memory = {}) => {
  const baseMap = memory?.themeWeightByKey && typeof memory.themeWeightByKey === "object" ? memory.themeWeightByKey : {};
  const pairwiseMap =
    memory?.pairwiseThemeBiasByKey && typeof memory.pairwiseThemeBiasByKey === "object"
      ? memory.pairwiseThemeBiasByKey
      : {};
  const keys = new Set([...Object.keys(baseMap), ...Object.keys(pairwiseMap)]);
  const output = {};

  for (const key of keys) {
    const baseWeight = Number(baseMap[key] || 0);
    const pairwiseWeight = Number(pairwiseMap[key] || 0);
    output[key] = Number(clamp(baseWeight + pairwiseWeight * 0.75, -1, 1).toFixed(3));
  }
  return output;
};

export const resolvePromptRouteSkill = ({
  mode = "pro",
  tensionLevel = "medium",
  targetLength = 200,
  recentHistory = [],
  memory = {},
} = {}) => {
  const normalizedMode = resolveMode(mode);
  const normalizedTension = resolveTensionLevel(tensionLevel);
  const profile = MODE_PROFILE[normalizedMode];
  const tensionProfile = TENSION_PROFILE[normalizedTension];
  const target = resolveTargetLength(targetLength);
  const diversity = computeRecentDiversity(recentHistory);
  const observed = Number(memory?.totals?.observed || 0);

  let exploration = profile.baseExploration;
  if (diversity < 0.45) exploration += 0.12;
  if (diversity > 0.8) exploration -= 0.05;
  if (observed >= 20) exploration -= 0.04;
  exploration += tensionProfile.explorationDelta;

  exploration = clamp(exploration, 0.3, 0.85);

  const preferredThemes = Array.isArray(memory?.preferredThemes) ? memory.preferredThemes.slice(0, 3) : [];
  const discouragedThemes = Array.isArray(memory?.discouragedThemes) ? memory.discouragedThemes.slice(0, 3) : [];
  const themeWeightByKey = mergeThemeWeights(memory);
  const maxSimilarityAllowed = clamp(profile.maxSimilarityAllowed + tensionProfile.similarityDelta, 0.36, 0.58);
  const criticPassScore = clamp(profile.criticPassScore + tensionProfile.passScoreDelta, 72, 86);

  return {
    mode: normalizedMode,
    tensionLevel: normalizedTension,
    targetLength: target,
    lengthWindow: {
      min: target - 20,
      max: target + 20,
    },
    maxAttempts: profile.maxAttempts,
    maxSimilarityAllowed: Number(maxSimilarityAllowed.toFixed(3)),
    criticPassScore: Math.round(criticPassScore),
    exploration: Number(exploration.toFixed(3)),
    preferredThemes,
    discouragedThemes,
    themeWeightByKey,
    diversity: Number(diversity.toFixed(3)),
  };
};
