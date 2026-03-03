const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const adjustTargetLength = ({ currentTargetLength, candidate }) => {
  const [min, max] = Array.isArray(candidate?.range) ? candidate.range : [180, 220];
  const length = Number(candidate?.length || 0);
  let next = Number(currentTargetLength || 200);
  if (length < min) next += 8;
  if (length > max) next -= 8;
  return clamp(Math.round(next), 180, 240);
};

export const planPromptRetrySkill = ({
  attempt = 1,
  maxAttempts = 12,
  route = {},
  critic = {},
  adversarial = {},
  feasibility = {},
  physics = {},
  hardNegative = {},
  candidate = {},
  similarity = 0,
  currentTargetLength = 200,
  currentMaxSimilarityAllowed = 0.45,
} = {}) => {
  const reasons = [];
  let excludeThemeKey = "";
  let excludeEmotion = "";

  let nextTargetLength = adjustTargetLength({ currentTargetLength, candidate });
  let nextMaxSimilarityAllowed = Number(currentMaxSimilarityAllowed || route.maxSimilarityAllowed || 0.45);

  const breakdown = critic?.breakdown || {};
  const hasLengthIssue = Number(breakdown.length || 0) < 90;
  const hasConsistencyIssue = Number(breakdown.consistency || 0) < 90;
  const hasRealismIssue = Number(breakdown.realism || 0) < 88;
  const hasDiversityIssue = Number(breakdown.diversity || 0) < 90;
  const hasAdversarialIssue = Number(adversarial?.score || 100) < 84;
  const hasPhysicsIssue = Number(physics?.score || 100) < 80;
  const hasFeasibilityIssue = Number(feasibility?.feasibilityScore || 100) < 76;
  const hasHardNegative = Number(hardNegative?.penalty || 0) > 0;

  if (hasLengthIssue) {
    reasons.push("length");
  }

  if (hasConsistencyIssue) {
    reasons.push("consistency");
    excludeThemeKey = String(candidate?.payload?.themeKey || "");
  }

  if (hasRealismIssue) {
    reasons.push("realism");
    excludeThemeKey = String(candidate?.payload?.themeKey || excludeThemeKey || "");
    excludeEmotion = String(candidate?.payload?.emotion || "");
    nextMaxSimilarityAllowed = clamp(nextMaxSimilarityAllowed - 0.02, 0.38, 0.58);
  }

  if (hasAdversarialIssue || hasHardNegative) {
    reasons.push("anti_ai");
    excludeThemeKey = String(candidate?.payload?.themeKey || excludeThemeKey || "");
    nextMaxSimilarityAllowed = clamp(nextMaxSimilarityAllowed - 0.01, 0.36, 0.58);
  }

  if (hasPhysicsIssue || hasFeasibilityIssue) {
    reasons.push("shootability");
    excludeEmotion = String(candidate?.payload?.emotion || excludeEmotion || "");
  }

  if (similarity > nextMaxSimilarityAllowed || hasDiversityIssue) {
    reasons.push("diversity");
    excludeThemeKey = String(candidate?.payload?.themeKey || excludeThemeKey || "");
    excludeEmotion = String(candidate?.payload?.emotion || "");
  }

  const lateStage = attempt >= Math.ceil(maxAttempts * 0.66);
  if (lateStage) {
    nextMaxSimilarityAllowed = clamp(nextMaxSimilarityAllowed + 0.03, 0.4, 0.58);
  }

  const basePassScore = Number(route?.criticPassScore || 79);
  const nextPassScore = clamp(basePassScore - Math.floor(attempt / 3), 72, basePassScore);

  return {
    nextTargetLength,
    nextMaxSimilarityAllowed: Number(nextMaxSimilarityAllowed.toFixed(3)),
    nextPassScore,
    excludeThemeKey,
    excludeEmotion,
    reasons,
  };
};
