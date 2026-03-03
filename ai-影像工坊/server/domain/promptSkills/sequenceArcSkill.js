const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const ARC_TEMPLATE = [
  { key: "observe", mood: "克制观察", hint: "动作轻、距离近、眼神不对齐" },
  { key: "approach", mood: "靠近试探", hint: "停顿更明显，手部动作进入画面" },
  { key: "friction", mood: "轻微对抗", hint: "眼神短暂对上，呼吸和肩线更紧" },
  { key: "withdraw", mood: "回避抽离", hint: "转身或低头，动作未完成就停住" },
  { key: "aftertaste", mood: "余波停留", hint: "画面安静但细节刺痛" },
];

const pickArcStage = (index, total) => {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  if (ratio <= 0.2) return ARC_TEMPLATE[0];
  if (ratio <= 0.45) return ARC_TEMPLATE[1];
  if (ratio <= 0.68) return ARC_TEMPLATE[2];
  if (ratio <= 0.88) return ARC_TEMPLATE[3];
  return ARC_TEMPLATE[4];
};

export const buildSequenceArcSkill = ({ total = 3 } = {}) => {
  const count = clamp(Math.floor(Number(total) || 3), 2, 8);
  const stages = [];
  for (let i = 0; i < count; i += 1) {
    const stage = pickArcStage(i, count);
    stages.push({
      index: i,
      stageKey: stage.key,
      mood: stage.mood,
      hint: stage.hint,
      intensity: Number((0.42 + (i / Math.max(1, count - 1)) * 0.45).toFixed(3)),
    });
  }
  return stages;
};

export const applyArcStageToPayloadSkill = ({ payload = {}, stage = null } = {}) => {
  if (!stage) return payload;
  const next = { ...payload };
  next.arcStage = stage.stageKey;
  next.arcMood = stage.mood;
  next.arcHint = stage.hint;
  if (stage.stageKey === "friction") {
    next.action = next.action || "回头盯住镜头一秒";
  } else if (stage.stageKey === "withdraw") {
    next.action = "低头翻找口袋后停住";
  }
  return next;
};
