const FALLBACK_PLAN = {
  title: "未命名项目 (应急模式)",
  directorInsight: "备用方案启用。手动调整细节。",
  productionNotes: { lighting: "自然光", palette: "中性", composition: "中心构图" },
  shootScope: { nonNegotiables: [], flexibleElements: [], complexityLevel: "low" },
  continuity: {
    character: { description: "通用主体", body: "标准身材", details: [], origin: "director" },
    wardrobe: { description: "简约造型", material: "棉麻", accessories: [], origin: "director" },
    set: { environment: "极简背景", timeOfDay: "日间", atmosphere: "平静", origin: "director" },
  },
  shootGuide: { keyPoses: ["站立"], emotionalSpectrum: ["平静"] },
  contract: {
    subjectIdentity: "主体",
    wardrobe: "基础款",
    location: "影棚",
    lighting: "柔光",
    cameraLanguage: "平视",
    texture: "数码",
  },
  frames: ["特写镜头", "中景镜头", "全景镜头"],
  visualVariants: ["经典方案 - 选角: 默认"],
};

const toText = (value, fallback = "") => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
};

const toStringArray = (value, fallback = []) => {
  if (!Array.isArray(value)) return [...fallback];
  const output = [];
  for (const item of value) {
    const text = toText(item, "");
    if (text) output.push(text);
  }
  return output.length ? output : [...fallback];
};

const splitOptions = (value) =>
  String(value || "")
    .split("||")
    .map((item) => item.replace(/^(Option|Variant|方案)[:.\-\s]*[A-Z0-9]*[:：]?\s*/i, "").trim())
    .filter(Boolean);

const tryParseJson = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const extractJsonObject = (raw) => {
  const text = String(raw || "").trim();
  if (!text) return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1]);
    if (parsed && typeof parsed === "object") return parsed;
  }

  const direct = tryParseJson(text);
  if (direct && typeof direct === "object") return direct;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = tryParseJson(text.slice(start, end + 1));
    if (parsed && typeof parsed === "object") return parsed;
  }

  return null;
};

const styleByTension = (tension) => {
  const mode = String(tension || "dramatic").toLowerCase();
  if (mode === "minimalist") {
    return "[DIRECTOR STYLE: BRESSON] static camera, sparse dialogue, restrained emotion, raw realism";
  }
  if (mode === "surreal") {
    return "[DIRECTOR STYLE: TARKOVSKY] temporal ambiguity, nature motifs, dreamlike transitions";
  }
  return "[DIRECTOR STYLE: WONG KAR-WAI] humidity, emotional distance, shallow depth, analog texture";
};

const buildAnalysisSummary = (analysis = {}) => {
  const hardLocks = analysis?.hardLocks || {};
  const lines = [];
  const subjectType = toText(hardLocks.subjectType, "");
  const gender = toText(hardLocks.gender, "");
  const product = toText(hardLocks.specificProduct, "");
  const traits = toStringArray(hardLocks.explicitTraits, []);
  const moods = toStringArray(hardLocks.moodKeywords, []);

  if (subjectType) lines.push(`subjectType=${subjectType}`);
  if (gender) lines.push(`gender=${gender}`);
  if (product) lines.push(`specificProduct=${product}`);
  if (traits.length) lines.push(`explicitTraits=${traits.slice(0, 6).join(" | ")}`);
  if (moods.length) lines.push(`moodKeywords=${moods.slice(0, 6).join(" | ")}`);
  return lines.join("\n");
};

const pickPrimary = (value, fallback) => {
  const options = splitOptions(value);
  return options[0] || toText(value, fallback);
};

const inferCameraType = (desc) => {
  const text = String(desc || "").toLowerCase();
  if (text.includes("close-up") || text.includes("特写")) return "close_up";
  if (text.includes("wide") || text.includes("全景")) return "wide";
  if (text.includes("low-angle") || text.includes("仰拍")) return "low_angle";
  if (text.includes("over shoulder") || text.includes("肩后")) return "over_shoulder";
  return "medium";
};

const inferMood = (desc, fallback = "neutral") => {
  const text = String(desc || "").toLowerCase();
  if (/(sad|grief|lonely|cold|melanch)/.test(text) || /(孤独|悲|冷|忧郁)/.test(text)) return "melancholic";
  if (/(rage|anger|tense|stress|panic)/.test(text) || /(紧张|焦虑|愤怒)/.test(text)) return "tense";
  if (/(joy|warm|smile|hope)/.test(text) || /(温暖|喜悦|微笑|希望)/.test(text)) return "warm";
  return fallback;
};

export const buildDirectorPlanMessages = ({
  userIdea = "",
  analysis = {},
  creativeBrief = {},
  tension = "dramatic",
} = {}) => {
  const styleDirective = styleByTension(tension);
  const summary = buildAnalysisSummary(analysis);
  const microCasting = toText(creativeBrief?.microCasting, "");

  const system = `
You are a world-class film director and visual planner.
Generate a STRICT JSON object only (no markdown).

${styleDirective}

Rules:
1. Keep the output cinematic, organic, analog film texture.
2. continuity.character.description/body and continuity.wardrobe.description must each provide multiple options using "||".
3. shootGuide.keyPoses should include at least 12 distinct poses.
4. visualVariants should include at least 12 distinct variants.
5. frames should include at least 12 shot descriptions.
6. Keep language concise and production-friendly.

Required JSON shape:
{
  "title": "string",
  "directorInsight": "string",
  "productionNotes": { "lighting": "string", "palette": "string", "composition": "string" },
  "continuity": {
    "character": { "description": "string", "body": "string", "details": ["string"], "origin": "director" },
    "wardrobe": { "description": "string", "material": "string", "accessories": ["string"], "origin": "director" },
    "set": { "environment": "string", "timeOfDay": "string", "atmosphere": "string", "origin": "director" }
  },
  "shootScope": { "nonNegotiables": ["string"], "flexibleElements": ["string"], "complexityLevel": "high|medium|low" },
  "shootGuide": { "keyPoses": ["string"], "emotionalSpectrum": ["string"] },
  "contract": { "subjectIdentity": "string", "wardrobe": "string", "location": "string", "lighting": "string", "cameraLanguage": "string", "texture": "string" },
  "visualVariants": ["string"],
  "frames": ["string"]
}
`.trim();

  const user = `
Project brief:
${String(userIdea || "").trim() || "Untitled visual story"}

Analysis constraints:
${summary || "none"}

Micro-casting cue:
${microCasting || "natural human details"}
`.trim();

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
};

const buildBlueprintToken = (plan, analysis = {}) => {
  const hardLocks = [];
  const specificProduct = toText(analysis?.hardLocks?.specificProduct, "");
  if (specificProduct) {
    hardLocks.push({ kind: "product", where: "GLOBAL", strength: "MUST", productId: specificProduct });
  }

  const gender = toText(analysis?.hardLocks?.gender, "");
  if (gender && gender !== "NEUTRAL") {
    hardLocks.push({ kind: "text", where: "GLOBAL", strength: "SHOULD", text: `Gender: ${gender}` });
  }

  for (const trait of toStringArray(analysis?.hardLocks?.explicitTraits, []).slice(0, 8)) {
    hardLocks.push({ kind: "text", where: "GLOBAL", strength: "SHOULD", text: trait });
  }

  const charOptions = splitOptions(plan?.continuity?.character?.description);
  const bodyOptions = splitOptions(plan?.continuity?.character?.body);
  const wardrobeOptions = splitOptions(plan?.continuity?.wardrobe?.description);
  const keyPoses = toStringArray(plan?.shootGuide?.keyPoses, ["Standing"]);
  const emotions = toStringArray(plan?.shootGuide?.emotionalSpectrum, ["Neutral"]);

  const option = (optionId, index) => ({
    optionId,
    anchors: {
      facial: charOptions[index] || charOptions[0] || "Default Subject",
      bodyForm: bodyOptions[index] || bodyOptions[0] || "Default Body",
      wardrobe: wardrobeOptions[index] || wardrobeOptions[0] || "Default Outfit",
      persona: "",
    },
    grammar: {
      camera: [toText(plan?.contract?.cameraLanguage, "Cinematic camera")],
      composition: [toText(plan?.productionNotes?.composition, "Balanced framing")],
      lighting: [toText(plan?.productionNotes?.lighting, "Natural light")],
      environment: [toText(plan?.continuity?.set?.environment, "Studio")],
    },
    palette: {
      expressionPool: emotions.length ? emotions : ["Neutral"],
      posturePool: keyPoses.length ? keyPoses : ["Standing"],
      microGesturePool: [],
    },
  });

  const payload = {
    constraints: {
      hardLocks,
      directorScope: {
        allowedSlots: ["facial", "bodyForm", "wardrobe", "cameraGrammar", "lightingGrammar", "expression", "posture"],
      },
    },
    options: {
      A: option("A", 0),
      B: option("B", 1),
    },
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `BP::${encoded}`;
};

export const normalizeDirectorPlan = ({ rawText = "", userIdea = "", analysis = {} } = {}) => {
  const parsed = extractJsonObject(rawText) || {};
  const source = parsed && typeof parsed === "object" ? parsed : {};

  const continuitySource = source.continuity || {};
  const characterSource = continuitySource.character || {};
  const wardrobeSource = continuitySource.wardrobe || {};
  const setSource = continuitySource.set || {};
  const shootGuideSource = source.shootGuide || {};

  const plan = {
    title: toText(source.title, FALLBACK_PLAN.title),
    directorInsight: toText(source.directorInsight, FALLBACK_PLAN.directorInsight),
    productionNotes: {
      lighting: toText(source?.productionNotes?.lighting, FALLBACK_PLAN.productionNotes.lighting),
      palette: toText(source?.productionNotes?.palette, FALLBACK_PLAN.productionNotes.palette),
      composition: toText(source?.productionNotes?.composition, FALLBACK_PLAN.productionNotes.composition),
    },
    shootScope: {
      nonNegotiables: toStringArray(source?.shootScope?.nonNegotiables, [
        toText(userIdea, "保持核心叙事一致"),
      ]),
      flexibleElements: toStringArray(source?.shootScope?.flexibleElements, []),
      complexityLevel: ["high", "medium", "low"].includes(String(source?.shootScope?.complexityLevel || ""))
        ? String(source.shootScope.complexityLevel)
        : "high",
    },
    continuity: {
      character: {
        description: toText(characterSource.description, FALLBACK_PLAN.continuity.character.description),
        body: toText(characterSource.body, FALLBACK_PLAN.continuity.character.body),
        details: toStringArray(characterSource.details, []),
        origin: "director",
      },
      wardrobe: {
        description: toText(wardrobeSource.description, FALLBACK_PLAN.continuity.wardrobe.description),
        material: toText(wardrobeSource.material, FALLBACK_PLAN.continuity.wardrobe.material),
        accessories: toStringArray(wardrobeSource.accessories, []),
        origin: "director",
      },
      set: {
        environment: toText(setSource.environment, FALLBACK_PLAN.continuity.set.environment),
        timeOfDay: toText(setSource.timeOfDay, FALLBACK_PLAN.continuity.set.timeOfDay),
        atmosphere: toText(setSource.atmosphere, FALLBACK_PLAN.continuity.set.atmosphere),
        origin: "director",
      },
    },
    shootGuide: {
      keyPoses: toStringArray(shootGuideSource.keyPoses, FALLBACK_PLAN.shootGuide.keyPoses),
      emotionalSpectrum: toStringArray(
        shootGuideSource.emotionalSpectrum,
        FALLBACK_PLAN.shootGuide.emotionalSpectrum
      ),
    },
    contract: {
      subjectIdentity: toText(source?.contract?.subjectIdentity, FALLBACK_PLAN.contract.subjectIdentity),
      wardrobe: toText(source?.contract?.wardrobe, FALLBACK_PLAN.contract.wardrobe),
      location: toText(source?.contract?.location, FALLBACK_PLAN.contract.location),
      lighting: toText(source?.contract?.lighting, FALLBACK_PLAN.contract.lighting),
      cameraLanguage: toText(source?.contract?.cameraLanguage, FALLBACK_PLAN.contract.cameraLanguage),
      texture: toText(source?.contract?.texture, FALLBACK_PLAN.contract.texture),
    },
    visualVariants: toStringArray(source.visualVariants, FALLBACK_PLAN.visualVariants).slice(0, 20),
    frames: toStringArray(source.frames, FALLBACK_PLAN.frames).slice(0, 40),
  };

  if (plan.visualVariants.length < 12) {
    const base = plan.visualVariants[0] || "标准方案";
    while (plan.visualVariants.length < 12) {
      plan.visualVariants.push(`${base} - 变体 ${plan.visualVariants.length + 1}`);
    }
  }
  if (plan.frames.length < 12) {
    const base = plan.frames[0] || "镜头描述";
    while (plan.frames.length < 12) {
      plan.frames.push(`${base} - 镜头 ${plan.frames.length + 1}`);
    }
  }
  if (plan.shootGuide.keyPoses.length < 12) {
    const base = plan.shootGuide.keyPoses[0] || "站立";
    while (plan.shootGuide.keyPoses.length < 12) {
      plan.shootGuide.keyPoses.push(`${base} - 姿态 ${plan.shootGuide.keyPoses.length + 1}`);
    }
  }

  const blueprintToken = buildBlueprintToken(plan, analysis);
  const details = toStringArray(plan?.continuity?.character?.details, []);
  const existingIndex = details.findIndex((item) => item.startsWith("BP::"));
  if (existingIndex >= 0) details[existingIndex] = blueprintToken;
  else details.unshift(blueprintToken);
  plan.continuity.character.details = details;

  return plan;
};

export const buildDirectorPacket = ({ plan, userIdea = "", analysis = {}, tension = "dramatic" } = {}) => {
  const styleVariant = toText(plan?.visualVariants?.[0], "Cinematic");
  const negativePack = toStringArray(analysis?.hardLocks?.immuneSystem, []);

  const shots = toStringArray(plan?.frames, [])
    .slice(0, 12)
    .map((description, index) => ({
      shotId: `S${String(index + 1).padStart(2, "0")}`,
      beatIndex: index + 1,
      description,
      camera: inferCameraType(description),
      mood: inferMood(description, toText(plan?.shootGuide?.emotionalSpectrum?.[0], "neutral")),
      promptPack: {
        base: description,
        style: styleVariant,
        variantHint: styleVariant,
      },
      negativePack: negativePack.slice(0, 24),
    }));

  return {
    project: {
      premise: toText(userIdea, plan?.title || "Untitled"),
      title: toText(plan?.title, "Untitled"),
      tension: toText(tension, "dramatic"),
      complexityLevel: toText(plan?.shootScope?.complexityLevel, "high"),
    },
    styleProfile: {
      visualSignature: styleVariant,
      lightingRule: toText(plan?.productionNotes?.lighting, "Natural light"),
      paletteRule: toText(plan?.productionNotes?.palette, "Neutral"),
      compositionRule: toText(plan?.productionNotes?.composition, "Balanced"),
    },
    characterProfile: {
      identityAnchor: pickPrimary(plan?.continuity?.character?.description, "Main character"),
      bodyAnchor: pickPrimary(plan?.continuity?.character?.body, "Standard body"),
      wardrobeAnchor: pickPrimary(plan?.continuity?.wardrobe?.description, "Simple outfit"),
      detailAnchors: toStringArray(plan?.continuity?.character?.details, []),
    },
    shots,
  };
};

