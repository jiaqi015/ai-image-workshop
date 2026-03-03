const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const state = {
  themes: {},
  emotions: {},
  issues: {},
  totals: {
    observed: 0,
    accepted: 0,
    rejected: 0,
  },
};

const ensureSlot = (bucket, key) => {
  if (!bucket[key]) {
    bucket[key] = {
      seen: 0,
      accepted: 0,
      rejected: 0,
      scoreSum: 0,
    };
  }
  return bucket[key];
};

const normalizeKey = (value, fallback = "unknown") => {
  const key = String(value || "").trim();
  return key || fallback;
};

const computeThemeWeight = (slot) => {
  const seen = Math.max(1, Number(slot?.seen || 0));
  const accepted = Number(slot?.accepted || 0);
  const rejected = Number(slot?.rejected || 0);
  const avgScore = Number(slot?.scoreSum || 0) / seen;
  const quality = (avgScore - 75) / 40; // roughly [-1,1]
  const successBalance = (accepted - rejected) / seen;
  return clamp(successBalance * 0.8 + quality * 0.6, -0.8, 0.8);
};

const summarizeThemes = () => {
  const entries = Object.entries(state.themes).map(([themeKey, slot]) => ({
    themeKey,
    seen: slot.seen,
    accepted: slot.accepted,
    rejected: slot.rejected,
    avgScore: slot.seen > 0 ? Number((slot.scoreSum / slot.seen).toFixed(1)) : 0,
    weight: Number(computeThemeWeight(slot).toFixed(3)),
  }));

  entries.sort((a, b) => b.weight - a.weight || b.avgScore - a.avgScore);
  const preferredThemes = entries.filter((item) => item.weight >= 0.15).map((item) => item.themeKey);
  const discouragedThemes = entries.filter((item) => item.weight <= -0.12).map((item) => item.themeKey);
  const themeWeightByKey = Object.fromEntries(entries.map((item) => [item.themeKey, item.weight]));

  return {
    entries,
    preferredThemes,
    discouragedThemes,
    themeWeightByKey,
  };
};

const summarizeIssues = () => {
  const entries = Object.entries(state.issues)
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count);
  return entries.slice(0, 5);
};

export const rememberPromptOutcomeSkill = ({
  themeKey,
  emotion,
  accepted = false,
  score = 0,
  issues = [],
} = {}) => {
  const normalizedTheme = normalizeKey(themeKey, "unknown-theme");
  const normalizedEmotion = normalizeKey(emotion, "unknown-emotion");
  const numericScore = Number.isFinite(Number(score)) ? Number(score) : 0;

  const themeSlot = ensureSlot(state.themes, normalizedTheme);
  themeSlot.seen += 1;
  themeSlot.scoreSum += numericScore;
  if (accepted) themeSlot.accepted += 1;
  else themeSlot.rejected += 1;

  const emotionSlot = ensureSlot(state.emotions, normalizedEmotion);
  emotionSlot.seen += 1;
  emotionSlot.scoreSum += numericScore;
  if (accepted) emotionSlot.accepted += 1;
  else emotionSlot.rejected += 1;

  state.totals.observed += 1;
  if (accepted) state.totals.accepted += 1;
  else state.totals.rejected += 1;

  for (const issue of issues || []) {
    const key = normalizeKey(issue, "");
    if (!key) continue;
    state.issues[key] = (state.issues[key] || 0) + 1;
  }
};

export const snapshotPromptMemorySkill = () => {
  const themeSummary = summarizeThemes();
  const issueHotspots = summarizeIssues();

  return {
    totals: { ...state.totals },
    preferredThemes: themeSummary.preferredThemes,
    discouragedThemes: themeSummary.discouragedThemes,
    themeWeightByKey: themeSummary.themeWeightByKey,
    issueHotspots,
  };
};

export const __unsafeResetPromptMemorySkill = () => {
  state.themes = {};
  state.emotions = {};
  state.issues = {};
  state.totals = {
    observed: 0,
    accepted: 0,
    rejected: 0,
  };
};
