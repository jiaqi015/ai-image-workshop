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

const resolveMode = (mode) => {
  const normalized = String(mode || "pro").toLowerCase();
  return normalized === "fast" ? "fast" : "pro";
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

export const resolvePromptRouteSkill = ({
  mode = "pro",
  targetLength = 200,
  recentHistory = [],
  memory = {},
} = {}) => {
  const normalizedMode = resolveMode(mode);
  const profile = MODE_PROFILE[normalizedMode];
  const target = resolveTargetLength(targetLength);
  const diversity = computeRecentDiversity(recentHistory);
  const observed = Number(memory?.totals?.observed || 0);

  let exploration = profile.baseExploration;
  if (diversity < 0.45) exploration += 0.12;
  if (diversity > 0.8) exploration -= 0.05;
  if (observed >= 20) exploration -= 0.04;

  exploration = clamp(exploration, 0.3, 0.85);

  const preferredThemes = Array.isArray(memory?.preferredThemes) ? memory.preferredThemes.slice(0, 3) : [];
  const discouragedThemes = Array.isArray(memory?.discouragedThemes) ? memory.discouragedThemes.slice(0, 3) : [];
  const themeWeightByKey = memory?.themeWeightByKey && typeof memory.themeWeightByKey === "object" ? memory.themeWeightByKey : {};

  return {
    mode: normalizedMode,
    targetLength: target,
    lengthWindow: {
      min: target - 20,
      max: target + 20,
    },
    maxAttempts: profile.maxAttempts,
    maxSimilarityAllowed: profile.maxSimilarityAllowed,
    criticPassScore: profile.criticPassScore,
    exploration: Number(exploration.toFixed(3)),
    preferredThemes,
    discouragedThemes,
    themeWeightByKey,
    diversity: Number(diversity.toFixed(3)),
  };
};
