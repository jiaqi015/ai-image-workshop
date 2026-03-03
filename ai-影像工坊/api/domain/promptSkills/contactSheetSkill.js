import { pairwisePreferenceBoostSkill } from "./memorySkill.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const rankContactSheetSkill = ({ candidates = [], memory = {}, maxItems = 6 } = {}) => {
  const scored = (candidates || []).map((item, index) => {
    const criticScore = Number(item?.critic?.score || 0);
    const adversarialScore = Number(item?.adversarial?.score || 100);
    const similarityPenalty = Number(item?.similarity || 0) * 18;
    const pairwiseBoost = pairwisePreferenceBoostSkill({
      sample: {
        theme: item?.payload?.themeKey,
        emotion: item?.payload?.emotion,
        camera: item?.payload?.camera,
      },
      memory,
    });

    const rankScore = clamp(criticScore * 0.62 + adversarialScore * 0.3 + pairwiseBoost * 20 - similarityPenalty, 0, 120);
    return {
      ...item,
      sheetIndex: index,
      rankScore: Number(rankScore.toFixed(3)),
      pairwiseBoost: Number(pairwiseBoost.toFixed(3)),
    };
  });

  scored.sort((a, b) => b.rankScore - a.rankScore);
  const trimmed = scored.slice(0, Math.max(1, Math.min(8, Number(maxItems) || 6)));

  return {
    cover: trimmed[0] || null,
    items: trimmed,
  };
};
