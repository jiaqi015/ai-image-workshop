const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hasAny = (text, tokens = []) => tokens.some((token) => String(text || "").includes(token));

const resolveActionMagnitude = (action) => {
  const text = String(action || "");
  if (hasAny(text, ["走两步", "俯身", "抬膝", "扶着栏杆"])) return "medium";
  if (hasAny(text, ["靠墙", "回头", "低头", "捏", "抬手", "擦汗", "发呆", "停住"])) return "small";
  return "small";
};

export const evaluateActionPhysicsSkill = ({ payload = {} } = {}) => {
  const action = String(payload.action || "");
  const location = String(payload.location || "");
  const wardrobeA = String(payload.wardrobeA || "");
  const wardrobeB = String(payload.wardrobeB || "");
  const camera = String(payload.camera || "");
  const propA = String(payload.propA || "");
  const propB = String(payload.propB || "");

  const issues = [];
  let score = 100;
  const magnitude = resolveActionMagnitude(action);

  const narrowSpace = hasAny(location, ["出租车后座", "电梯", "楼道", "浴室"]);
  if (narrowSpace && magnitude === "medium") {
    score -= 18;
    issues.push("狭窄场景里动作幅度偏大");
  }

  const fragileLook = hasAny(`${wardrobeA}${wardrobeB}`, ["短裙", "拖鞋"]);
  const highMotion = hasAny(action, ["走两步", "抬膝", "俯身"]);
  if (fragileLook && highMotion && hasAny(location, ["天台边缘", "天桥", "斑马线"])) {
    score -= 14;
    issues.push("服装与动作组合存在执行风险");
  }

  const bothHandsOccupied =
    hasAny(propA, ["雨伞", "纸杯", "毛巾", "塑料袋"]) &&
    hasAny(propB, ["雨伞", "纸杯", "毛巾", "塑料袋"]);
  if (bothHandsOccupied && hasAny(action, ["系鞋带", "整理头发", "抹"])) {
    score -= 12;
    issues.push("双手道具占用与动作不兼容");
  }

  if (hasAny(camera, ["低机位"]) && hasAny(location, ["出租车后座"])) {
    score -= 8;
    issues.push("机位与空间冲突，落地难度高");
  }

  return {
    score: clamp(score, 0, 100),
    issues,
    magnitude,
    pass: score >= 78 && issues.length === 0,
  };
};
