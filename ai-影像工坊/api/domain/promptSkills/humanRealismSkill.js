const pick = (items = []) => items[Math.floor(Math.random() * items.length)];

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();

const stripMechanicalPhrases = (text) =>
  String(text || "")
    .replace(/情绪定调为/g, "")
    .replace(/选角是/g, "")
    .replace(/场景放在/g, "")
    .replace(/服装用/g, "")
    .replace(/道具给/g, "")
    .replace(/动作是/g, "")
    .replace(/拍法用/g, "")
    .replace(/禁止/g, "避免");

const compact = (text) =>
  String(text || "")
    .replace(/保持自然/g, "自然")
    .replace(/，动作自然并有停顿/g, "，动作带停顿")
    .replace(/，保留/g, "，留住")
    .replace(/，/g, "，");

const normalizeTexture = (value) =>
  String(value || "")
    .replace(/必须/g, "")
    .replace(/要可见/g, "可见")
    .replace(/要看见/g, "看见")
    .replace(/，+/g, "，")
    .replace(/\s+/g, "")
    .trim();

const describeAtmosphere = (value) => {
  const text = clean(value);
  if (!text) return "";
  if (/^(空气|湿气|风|人流|冷白灯|金属|混凝土|地面|窗外)/.test(text)) return text;
  return `现场是${text}`;
};

const sceneLineTemplates = [
  (p) => `${p.time}的${p.location}，${describeAtmosphere(p.atmosphere)}，${p.cast}，情绪偏${p.emotion}`,
  (p) => `地点在${p.location}，时间是${p.time}，画面先给到${p.cast}，基调是${p.emotion}，现场体感是${p.atmosphere}`,
  (p) => `${p.cast}出现在${p.location}，时间落在${p.time}，情绪不是表演型，而是${p.emotion}，环境感觉${describeAtmosphere(p.atmosphere)}`,
];

const stylingLineTemplates = [
  (p) => `穿${p.wardrobeA}配${p.wardrobeB}，手边有${p.propA}和${p.propB}`,
  (p) => `服装控制在${p.wardrobeA}+${p.wardrobeB}，道具留${p.propA}、${p.propB}，看起来像刚被用过`,
  (p) => `造型别精修，${p.wardrobeA}和${p.wardrobeB}保留褶皱，道具用${p.propA}与${p.propB}`,
];

const actionLineTemplates = [
  (p) => `动作抓${p.action}，不是摆拍，要有半拍停顿`,
  (p) => `人物动作是${p.action}，让动作落在刚停住的瞬间`,
  (p) => `别做标准姿势，直接拍${p.action}这个动作未完成的时刻`,
];

const cameraLineTemplates = [
  (p) => `${p.camera}，细节留${normalizeTexture(p.texture)}，允许轻微失焦、噪点和偏轴`,
  (p) => `镜头走${p.camera}，不要磨平质感，${normalizeTexture(p.texture)}，允许小瑕疵`,
  (p) => `拍法用${p.camera}，别追求干净，${normalizeTexture(p.texture)}，颗粒和炸点保留`,
];

const negativeLineTemplates = [
  (p) => `避免${p.banA}、${p.banB}、${p.banC}，拒绝机械感和无瑕广告脸`,
  (p) => `不要${p.banA}、${p.banB}、${p.banC}，画面要有体温，不要AI塑料质感`,
  (p) => `禁用${p.banA}、${p.banB}、${p.banC}，宁可粗粝也不要假完美`,
];

const introLineTemplates = [
  "先拍活人，再拍风格。",
  "先保证人物成立，再追求风格张力。",
  "先要真实，再要冲击力。",
];

const chooseTemplatePack = (mode) => {
  if (mode === "fast") {
    return {
      includeIntro: false,
      addOnCount: 1,
    };
  }
  return {
    includeIntro: Math.random() > 0.45,
    addOnCount: 2,
  };
};

const trimToWindow = (text, window) => {
  let output = clean(text);
  if (output.length <= window.max) return output;

  output = compact(output);
  if (output.length <= window.max) return output;

  const sentences = output
    .split("。")
    .map((line) => clean(line))
    .filter(Boolean);

  while (sentences.length > 6 && `${sentences.join("。")}。`.length > window.max) {
    sentences.pop();
  }

  output = `${sentences.join("。")}。`;
  if (output.length > window.max) {
    const hardCap = Math.max(0, window.max - 1);
    output = `${output.slice(0, hardCap).replace(/[，；、\s]+$/g, "")}。`;
  }
  return clean(output);
};

export const composeHumanRealismPromptSkill = ({ payload = {}, mode = "pro", window = { min: 180, max: 220 } } = {}) => {
  const template = chooseTemplatePack(mode);
  const lines = [];

  if (template.includeIntro) {
    lines.push(pick(introLineTemplates));
  }

  lines.push(pick(sceneLineTemplates)(payload));
  lines.push(pick(stylingLineTemplates)(payload));
  lines.push(pick(actionLineTemplates)(payload));
  lines.push(pick(cameraLineTemplates)(payload));
  lines.push(pick(negativeLineTemplates)(payload));

  const addOns = Array.isArray(payload.addOns) ? [...payload.addOns] : [];
  for (let i = 0; i < template.addOnCount && addOns.length > 0; i += 1) {
    lines.push(addOns.shift());
  }

  let prompt = `${lines.map((line) => clean(line)).filter(Boolean).join("。")}。`;
  while (prompt.length < window.min && addOns.length > 0) {
    prompt = `${prompt}${clean(addOns.shift())}。`;
  }

  prompt = trimToWindow(prompt, window);
  prompt = stripMechanicalPhrases(prompt);
  return clean(prompt);
};
