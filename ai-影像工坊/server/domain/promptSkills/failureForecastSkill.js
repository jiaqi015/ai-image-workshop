const mapIssueToMitigation = (issue) => {
  const text = String(issue || "");
  if (text.includes("地铁") || text.includes("站台")) {
    return "改成通勤微动作（看灯带/捏工牌），删除点烟行为";
  }
  if (text.includes("模板") || text.includes("机械")) {
    return "改成现场口吻描述，加入具体动作停顿和身体细节";
  }
  if (text.includes("不完美") || text.includes("细节")) {
    return "补充毛孔/汗痕/折痕/噪点中的至少两项";
  }
  if (text.includes("动作") || text.includes("空间")) {
    return "降低动作幅度或更换中近景机位";
  }
  return "替换冲突元素并重采样一轮";
};

export const buildFailureForecastSkill = ({
  critic = {},
  adversarial = {},
  feasibility = {},
  physics = {},
} = {}) => {
  const merged = [
    ...(critic?.issues || []),
    ...(adversarial?.findings || []),
    ...((feasibility?.unshootableChecklist || []).map((item) => item.reason)),
    ...(physics?.issues || []),
  ];

  const seen = new Set();
  const risks = [];
  for (const issue of merged) {
    const key = String(issue || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    risks.push({
      risk: key,
      mitigation: mapIssueToMitigation(key),
    });
    if (risks.length >= 3) break;
  }

  return {
    risks,
    hasRisk: risks.length > 0,
  };
};
