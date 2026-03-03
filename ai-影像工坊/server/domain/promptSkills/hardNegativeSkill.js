const HARD_NEGATIVE_RULES = [
  { id: "ai-render-token", pattern: /(?:8k|4k|cgi|octane|unreal engine|ray tracing|超现实渲染)/gi, penalty: 28 },
  { id: "plastic-skin", pattern: /(?:无瑕|完美皮肤|塑料皮肤|陶瓷肌|丝滑肌理)/gi, penalty: 22 },
  { id: "template-command-tone", pattern: /(?:情绪定调为|选角是|场景放在|服装用|道具给|动作是|拍法用)/g, penalty: 18 },
  { id: "fantasy-ad-like", pattern: /(?:唯美|梦幻|大片感|仙气|韩系柔焦)/g, penalty: 16 },
];

const REPLACEMENTS = [
  { pattern: /(?:8k|4k|cgi|octane|unreal engine|ray tracing|超现实渲染)/gi, to: "" },
  { pattern: /(?:完美皮肤|塑料皮肤|陶瓷肌|无瑕)/g, to: "真实皮肤纹理" },
  { pattern: /(?:唯美|梦幻|大片感|仙气)/g, to: "纪实" },
];

const clean = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .replace(/，{2,}/g, "，")
    .trim();

export const applyHardNegativeFilterSkill = ({ prompt = "" } = {}) => {
  const source = String(prompt || "");
  const hits = [];
  let penalty = 0;

  for (const rule of HARD_NEGATIVE_RULES) {
    const matched = source.match(rule.pattern);
    if (!matched || matched.length === 0) continue;
    hits.push({
      id: rule.id,
      count: matched.length,
    });
    penalty += rule.penalty;
  }

  let rewritten = source;
  for (const rule of REPLACEMENTS) {
    rewritten = rewritten.replace(rule.pattern, rule.to);
  }
  rewritten = clean(rewritten);

  return {
    prompt: rewritten,
    hits,
    penalty,
    blocked: penalty >= 38,
  };
};
