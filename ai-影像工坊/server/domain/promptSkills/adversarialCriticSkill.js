const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hasAny = (text, tokens = []) => tokens.some((token) => String(text || "").includes(token));

export const evaluateAdversarialCriticSkill = ({ prompt = "", payload = {}, hardNegative = {} } = {}) => {
  const findings = [];
  let score = 100;
  const text = String(prompt || "");

  if (hardNegative?.blocked) {
    score -= 24;
    findings.push("命中硬负例词，存在明显 AI 化风险");
  } else if ((hardNegative?.hits || []).length > 0) {
    score -= 12;
    findings.push("命中负例词，建议进一步去模板化");
  }

  if (!hasAny(text, ["停住", "半拍", "未完成", "游离", "发呆"])) {
    score -= 10;
    findings.push("缺少微停顿或未完成动作信号，情绪可能过于表演化");
  }

  if (!hasAny(text, ["毛孔", "细汗", "灰尘", "折痕", "勒痕", "噪点", "失焦"])) {
    score -= 14;
    findings.push("缺少不完美锚点，容易偏向光滑假感");
  }

  if (hasAny(text, ["绝美", "完美", "顶级时尚广告"])) {
    score -= 18;
    findings.push("出现广告腔词，可能背离纪实欲望张力");
  }

  const location = String(payload.location || "");
  const action = String(payload.action || "");
  if (hasAny(location, ["地铁", "站台"]) && hasAny(action, ["点烟", "掐灭"])) {
    score -= 20;
    findings.push("场景行为冲突：公共通勤场景中的点烟动作");
  }

  const pass = score >= 80 && findings.length === 0;
  return {
    pass,
    score: clamp(score, 0, 100),
    findings,
    riskLevel: score >= 90 ? "low" : score >= 80 ? "medium" : "high",
  };
};
