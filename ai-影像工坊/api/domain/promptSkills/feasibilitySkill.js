const clean = (value) => String(value || "").trim();

const normalizePayload = (payload = {}) => ({
  ...payload,
  location: clean(payload.location),
  time: clean(payload.time),
  action: clean(payload.action),
  camera: clean(payload.camera),
  propA: clean(payload.propA),
  propB: clean(payload.propB),
  wardrobeA: clean(payload.wardrobeA),
  wardrobeB: clean(payload.wardrobeB),
});

const hasAny = (text, patterns = []) => patterns.some((p) => String(text || "").includes(p));

export const solveRealityConstraintsSkill = ({ payload = {} } = {}) => {
  const next = normalizePayload(payload);
  const checklist = [];
  const fixes = [];
  let feasibilityScore = 100;

  const inSubway = hasAny(next.location, ["地铁", "换乘", "站台"]);
  const inTaxi = hasAny(next.location, ["出租车后座"]);
  const inNarrowRoom = hasAny(next.location, ["浴室", "楼道", "电梯"]);

  if (inSubway && hasAny(next.action, ["点烟", "掐灭"])) {
    checklist.push({
      id: "action-no-smoking-subway",
      level: "blocker",
      reason: "地铁/站台环境不应出现点烟动作",
      fix: "改为低头捏工牌或看向列车灯带",
    });
    next.action = "低头捏着工牌边缘";
    fixes.push("action");
    feasibilityScore -= 28;
  }

  if (inTaxi && hasAny(next.action, ["靠墙坐下", "扶着栏杆", "走两步"])) {
    checklist.push({
      id: "action-space-conflict-taxi",
      level: "blocker",
      reason: "出租车后座空间不足，不支持大幅动作",
      fix: "改为回头看镜头、捏票据、擦汗停住等小动作",
    });
    next.action = "回头盯住镜头一秒";
    fixes.push("action");
    feasibilityScore -= 24;
  }

  if (inNarrowRoom && hasAny(next.camera, ["28mm贴近广角"]) && hasAny(next.action, ["走两步", "侧身靠着水箱"])) {
    checklist.push({
      id: "camera-action-overcrowd",
      level: "warning",
      reason: "狭窄场景下广角贴近与大动作同时出现，执行难度高",
      fix: "减少动作幅度或改中近景机位",
    });
    next.action = "抬手整理衣领";
    fixes.push("action");
    feasibilityScore -= 12;
  }

  const hasDayCue = hasAny(next.time, ["清晨", "午后", "傍晚"]);
  const hasNightCue = hasAny(next.time, ["深夜", "凌晨", "夜里", "夜班"]);
  if (hasDayCue && hasNightCue) {
    checklist.push({
      id: "time-inconsistent",
      level: "warning",
      reason: "时间描述冲突",
      fix: "仅保留一个时间语义",
    });
    next.time = next.time.replace(/夜里|深夜|凌晨|夜班/g, "").replace(/\s+/g, "");
    fixes.push("time");
    feasibilityScore -= 8;
  }

  const isZeroProp = !next.propA && !next.propB;
  if (isZeroProp) {
    checklist.push({
      id: "missing-prop",
      level: "warning",
      reason: "缺少现实道具，现场感不足",
      fix: "补充至少一个手持道具",
    });
    next.propA = "钥匙串";
    fixes.push("propA");
    feasibilityScore -= 10;
  }

  return {
    payload: next,
    feasibilityScore: Math.max(0, feasibilityScore),
    unshootableChecklist: checklist,
    fixes,
  };
};
