const ANCHORS = {
  body: ["毛孔", "细汗", "黑眼圈", "勒痕", "痘印", "锁骨", "灰尘"],
  material: ["折痕", "磨损", "水渍", "污迹", "颗粒", "划痕"],
  environment: ["空气", "反光", "灯", "风", "潮湿", "噪声", "霓虹"],
  imperfection: ["失焦", "噪点", "偏轴", "过曝", "轻糊", "炸点"],
};

const hasAny = (text, tokens = []) => tokens.some((token) => String(text || "").includes(token));

const pick = (items = []) => items[Math.floor(Math.random() * items.length)];

export const enforceMultimodalAnchorsSkill = ({ prompt = "", payload = {} } = {}) => {
  let output = String(prompt || "").trim();
  const report = {};

  for (const [bucket, tokens] of Object.entries(ANCHORS)) {
    const ok = hasAny(output, tokens);
    report[bucket] = ok;
  }

  const additions = [];
  if (!report.body) additions.push(`人物细节补一处：${payload.texture || "毛孔和细汗要看见"}`);
  if (!report.material) additions.push("材质痕迹别抹掉，折痕和磨损要留住");
  if (!report.environment) additions.push(`环境线索要明确：${payload.atmosphere || "空气和灯光状态要交代"}`);
  if (!report.imperfection) additions.push(`保留镜头缺陷：${pick(ANCHORS.imperfection)}可见`);

  if (additions.length > 0) {
    output = `${output}${output.endsWith("。") ? "" : "。"}${additions.slice(0, 2).join("。")}。`;
  }

  return {
    prompt: output,
    report,
    missingCount: Object.values(report).filter((value) => !value).length,
  };
};
