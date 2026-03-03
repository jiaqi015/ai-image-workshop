import { evaluatePromptCriticSkill } from "./promptSkills/criticSkill.js";
import { snapshotPromptMemorySkill, rememberPromptOutcomeSkill } from "./promptSkills/memorySkill.js";
import { resolvePromptRouteSkill } from "./promptSkills/routerSkill.js";
import { planPromptRetrySkill } from "./promptSkills/retrySkill.js";
import { composeHumanRealismPromptSkill } from "./promptSkills/humanRealismSkill.js";

const HISTORY_LIMIT = 20;
const DEFAULT_TARGET_LENGTH = 200;
const recentHistory = [];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, "")
    .replace(/[，。；、！？【】（）\[\]\-:：]/g, "")
    .toLowerCase();

const pick = (items = []) => items[Math.floor(Math.random() * items.length)];
const pickDistinct = (items = [], count = 1) => {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
};

const weightedPick = (items = [], weightResolver = () => 1) => {
  const weighted = items
    .map((item) => ({ item, weight: Math.max(0, Number(weightResolver(item)) || 0) }))
    .filter((entry) => entry.weight > 0);
  if (!weighted.length) return items[0];
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return weighted[weighted.length - 1].item;
};

const THEME_PACKS = [
  {
    key: "restless-night-street",
    label: "躁动夜街",
    emotionPool: ["躁动", "挑衅", "不安", "疲惫但清醒"],
    castPool: [
      "真实亚洲成年人23+，东亚骨相，眼神警觉",
      "真实亚洲成年人23+，东亚面孔，动作松弛但防备",
      "真实亚洲成年人23+，东亚轮廓，呼吸急促却克制",
    ],
    locationPool: ["便利店门口", "地铁换乘通道", "夜班出租车后座", "旧楼楼道", "天桥下路口"],
    timePool: ["凌晨一点", "夜里十一点", "雨后深夜", "收店前十分钟"],
    atmospherePool: ["地面反光发黏", "空气有潮湿汽油味", "霓虹只打到半张脸"],
    wardrobePool: ["旧T恤", "运动外套", "褪色牛仔裤", "皱褶短裙", "连帽衫", "工装夹克", "球鞋"],
    propPool: ["塑料袋", "罐装饮料", "打火机", "公交卡", "耳机", "旧报纸", "零钱票据"],
    actionPool: ["回头盯住镜头一秒", "靠墙坐下抬膝", "俯身系鞋带后停住", "抬手抹掉嘴角水痕", "点烟又掐灭"],
    cameraNightPool: [
      "28mm贴近广角+机顶直闪，允许边缘变形",
      "35mm近距离抓拍+硬阴影，黑位压深",
      "50mm半身低机位+反差直闪，允许轻微糊焦",
    ],
    cameraDayPool: ["35mm近景，保留高反差和颗粒"],
    texturePool: ["保留毛孔和细汗", "保留布料勒痕", "保留脚底灰尘与小划痕"],
    addOnPool: ["镜头离人很近，像擦身而过", "构图允许轻微歪斜，不追求端正", "留一点失控感，不做干净棚拍"],
    banPool: ["过度磨皮", "网红滤镜", "甜美摆拍", "二次元卡通化"],
  },
  {
    key: "intimate-rental-room",
    label: "亲密日常",
    emotionPool: ["暧昧", "亲密但疏离", "松弛", "低声对峙"],
    castPool: [
      "真实亚洲成年人23+，眼神柔软但不讨好",
      "真实亚洲成年人23+，表情克制，动作自然",
      "真实亚洲成年人23+，面部有疲态和生活痕迹",
    ],
    locationPool: ["出租屋厨房", "狭窄阳台", "公共洗衣房角落", "浴室门口", "单人床边"],
    timePool: ["傍晚蓝调时段", "凌晨两点", "清晨六点", "雨天午后"],
    atmospherePool: ["湿气贴在墙面", "风扇声和水声混在一起", "窗外光线很冷，室内偏暖"],
    wardrobePool: ["旧背心", "薄针织衫", "宽松衬衫", "短裤", "运动长裤", "棉袜", "拖鞋"],
    propPool: ["水杯", "毛巾", "耳机线", "手机充电器", "洗衣篮", "便利店袋子"],
    actionPool: ["坐在床沿系头发", "倚着门框发呆", "弯腰拧干毛巾", "抬手整理衣领", "低头翻找口袋"],
    cameraNightPool: [
      "35mm近距离直闪，保留阴影硬边",
      "50mm中近景，暗部颗粒明显",
      "28mm贴脸抓拍，允许局部过曝",
    ],
    cameraDayPool: ["35mm自然光近景，保留阴影层次", "50mm中近景，低饱和冷暖对撞"],
    texturePool: ["皮肤细纹和黑眼圈要可见", "衣物褶皱和水渍要保留", "桌面划痕和墙皮脱落要看见"],
    addOnPool: ["动作不要演，像生活被突然截帧", "保持距离压迫感，但别做戏剧表演", "人物和道具要像刚刚使用过"],
    banPool: ["精修皮肤", "梦幻柔焦", "偶像剧式对称构图", "无生活痕迹的布景"],
  },
  {
    key: "cold-commute",
    label: "冷感通勤",
    emotionPool: ["麻木", "克制", "孤独", "压抑"],
    castPool: [
      "真实亚洲成年人23+，通勤状态，精神略透支",
      "真实亚洲成年人23+，表情空白，眼神游离",
      "真实亚洲成年人23+，脸上有轻微浮肿和疲态",
    ],
    locationPool: ["早高峰地铁口", "公交站台", "写字楼电梯厅", "地下通道", "十字路口斑马线边"],
    timePool: ["清晨七点半", "工作日晚高峰", "阴天傍晚", "小雨天早晨"],
    atmospherePool: ["冷白灯把肤色压淡", "人流不断但主体像静止", "金属和玻璃反光很硬"],
    wardrobePool: ["衬衫", "风衣", "西装外套", "直筒裤", "帆布托特包", "运动鞋", "黑色长袜"],
    propPool: ["公交卡", "咖啡纸杯", "工牌", "雨伞", "耳机", "便利店收据"],
    actionPool: ["站着看向列车灯带", "低头捏着工牌边缘", "抬手看时间后放下", "背靠墙短暂停住", "边走边扯平衣角"],
    cameraNightPool: [
      "35mm中景直闪，背景压暗",
      "28mm低机位抓拍，线条倾斜",
      "50mm半身硬光，保留噪点",
    ],
    cameraDayPool: ["35mm平视抓拍，反差稍硬", "50mm中景，压缩通道纵深"],
    texturePool: ["汗痕和衣料摩擦痕要留住", "鞋面灰尘和折痕要清楚", "灯管反光和玻璃污迹要可见"],
    addOnPool: ["让人群成为压迫背景，不要虚化成奶油景深", "画面要冷，不要柔美", "保持纪实速度感，允许轻微拖影"],
    banPool: ["高甜配色", "大片式摆拍", "极致美颜", "夸张赛博特效"],
  },
  {
    key: "humid-rooftop",
    label: "闷热天台",
    emotionPool: ["闷热", "冲动", "失重感", "短暂自由"],
    castPool: [
      "真实亚洲成年人23+，呼吸明显，神态游离",
      "真实亚洲成年人23+，身体放松但眼神紧绷",
      "真实亚洲成年人23+，有汗感和真实皮肤质地",
    ],
    locationPool: ["老楼天台", "水箱旁边", "广告牌阴影下", "栏杆附近", "屋顶边缘安全区域"],
    timePool: ["夏夜十点", "黄昏后十五分钟", "午后闷热时段", "雷雨前傍晚"],
    atmospherePool: ["空气发闷，远处霓虹在抖", "混凝土地面返热明显", "风很小，背景噪声很重"],
    wardrobePool: ["汗湿T恤", "背心", "短袖衬衫", "牛仔短裤", "运动长裤", "旧球鞋", "长袜"],
    propPool: ["罐装汽水", "毛巾", "钥匙串", "折叠椅", "塑料水瓶", "旧耳机"],
    actionPool: ["扶着栏杆向下看", "坐地抬膝喘气", "抬手擦汗后停住", "侧身靠着水箱", "走两步又回头"],
    cameraNightPool: [
      "28mm广角贴近+机顶直闪，保留高反差",
      "35mm低机位抓拍，天空压暗",
      "50mm近景硬光，汗光可炸点",
    ],
    cameraDayPool: ["35mm逆光近景，允许高光溢出", "28mm低机位，背景热浪感明显"],
    texturePool: ["汗珠、毛孔、发丝黏连必须清楚", "衣物潮湿痕迹必须保留", "水泥颗粒和鞋底灰尘必须可见"],
    addOnPool: ["画面要有空气阻力感，不要轻盈广告味", "动作像被抓拍到，不要摆标准姿势", "留下粗颗粒，不做精修润色"],
    banPool: ["棚拍级干净背景", "过度戏剧打光", "韩系柔焦滤镜", "无瑕疵皮肤"],
  },
];

const mergeFingerprints = (parts = []) =>
  new Set(
    parts
      .flatMap((part) => String(part || "").split(/[，。；、\s]+/))
      .map((part) => normalizeText(part))
      .filter(Boolean)
  );

const jaccardSimilarity = (a, b) => {
  if (!a?.size || !b?.size) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
};

const resolveTargetWindow = (targetLength) => {
  const target = clamp(Number.isFinite(Number(targetLength)) ? Number(targetLength) : DEFAULT_TARGET_LENGTH, 180, 240);
  return {
    target,
    min: target - 20,
    max: target + 20,
  };
};

const tryCompactText = (text) =>
  String(text || "")
    .replace(/真实亚洲成年人23\+，/g, "亚洲成年人23+，")
    .replace(/，保留褶皱和磨损痕迹/g, "，保留褶皱磨损")
    .replace(/，不要偶像化脸谱/g, "，拒绝偶像脸")
    .replace(/，动作保持自然但带停顿/g, "，动作自然并有停顿")
    .replace(/，允许轻微糊焦和噪点/g, "，允许糊焦和噪点")
    .replace(/，不做精修润色/g, "，不做精修")
    .replace(/，/g, "，");

const WARDROBE_TOP_RE = /T恤|衬衫|外套|背心|风衣|西装|夹克|连帽|针织/;
const WARDROBE_BOTTOM_RE = /裤|裙/;
const WARDROBE_FOOT_RE = /鞋|袜|拖鞋/;

const classifyWardrobe = (item) => {
  const text = String(item || "");
  if (WARDROBE_TOP_RE.test(text)) return "top";
  if (WARDROBE_BOTTOM_RE.test(text)) return "bottom";
  if (WARDROBE_FOOT_RE.test(text)) return "foot";
  return "other";
};

const pickWardrobePair = (pool = []) => {
  const byType = {
    top: [],
    bottom: [],
    foot: [],
    other: [],
  };
  for (const item of pool) {
    byType[classifyWardrobe(item)].push(item);
  }

  const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
  if (byType.top.length > 0 && byType.bottom.length > 0) {
    return [choose(byType.top), choose(byType.bottom)];
  }
  if (byType.top.length > 0 && byType.foot.length > 0) {
    return [choose(byType.top), choose(byType.foot)];
  }
  if (byType.bottom.length > 0 && byType.foot.length > 0) {
    return [choose(byType.bottom), choose(byType.foot)];
  }

  return pickDistinct(pool, 2);
};

const PROP_HAND_RE = /打火机|公交卡|耳机|钥匙|收据|工牌|纸杯|罐装|手机|雨伞|毛巾/;

const pickPropPair = (pool = []) => {
  const hand = pool.filter((item) => PROP_HAND_RE.test(String(item || "")));
  const ambient = pool.filter((item) => !PROP_HAND_RE.test(String(item || "")));
  if (hand.length > 0 && ambient.length > 0) {
    return [pick(hand), pick(ambient)];
  }
  return pickDistinct(pool, 2);
};

const toSet = (input = []) => new Set((Array.isArray(input) ? input : []).map((item) => String(item || "").trim()).filter(Boolean));

const pickThemePack = ({
  excludedThemeKeys = [],
  preferredThemeKeys = [],
  discouragedThemeKeys = [],
  themeWeightByKey = {},
  exploration = 0.6,
} = {}) => {
  const recent = recentHistory.slice(-4);
  const lastTheme = recent.length > 0 ? recent[recent.length - 1].themeKey : "";
  const counts = new Map();
  for (const item of recent) {
    counts.set(item.themeKey, (counts.get(item.themeKey) || 0) + 1);
  }

  const excluded = toSet(excludedThemeKeys);
  const preferred = toSet(preferredThemeKeys);
  const discouraged = toSet(discouragedThemeKeys);

  return weightedPick(THEME_PACKS, (pack) => {
    if (excluded.has(pack.key)) return 0.01;
    let weight = 1;
    if (pack.key === lastTheme) weight *= 0.35;
    weight *= 1 / (1 + (counts.get(pack.key) || 0) * 0.6);
    const memoryWeight = Number(themeWeightByKey?.[pack.key] || 0);
    weight *= 1 + memoryWeight;
    if (preferred.has(pack.key)) {
      weight *= 1 + (1 - exploration) * 0.8;
    }
    if (discouraged.has(pack.key)) {
      weight *= 0.55 + exploration * 0.25;
    }
    return weight;
  });
};

const pickEmotion = (pack, forcedAvoidEmotion, blockedEmotions = []) => {
  const blocked = toSet([forcedAvoidEmotion, ...blockedEmotions]);
  const choices = pack.emotionPool.filter((item) => !blocked.has(item));
  return pick(choices.length ? choices : pack.emotionPool);
};

const needsNightCamera = (time, location) => /凌晨|深夜|夜|晚|雨后/.test(`${time}${location}`);

const ensureSceneConsistency = (payload) => {
  const isConvenienceScene = String(payload.location).includes("便利店");
  if (isConvenienceScene && ![payload.propA, payload.propB].some((item) => item.includes("塑料袋") || item.includes("罐装饮料"))) {
    payload.propA = Math.random() > 0.5 ? "塑料袋" : "罐装饮料";
  }
  if (needsNightCamera(payload.time, payload.location) && !payload.camera.includes("直闪")) {
    payload.camera = `${payload.camera}，可加机顶直闪`;
  }
  return payload;
};

const buildCandidate = ({
  mode = "pro",
  targetLength = DEFAULT_TARGET_LENGTH,
  forcedAvoidEmotion = "",
  routingContext = {},
  retryState = {},
} = {}) => {
  const pack = pickThemePack({
    excludedThemeKeys: retryState.excludedThemeKeys,
    preferredThemeKeys: routingContext.preferredThemes,
    discouragedThemeKeys: routingContext.discouragedThemes,
    themeWeightByKey: routingContext.themeWeightByKey,
    exploration: routingContext.exploration,
  });
  const location = pick(pack.locationPool);
  const time = pick(pack.timePool);
  const isNight = needsNightCamera(time, location);
  const [wardrobeA, wardrobeB] = pickWardrobePair(pack.wardrobePool);
  const [propA, propB] = pickPropPair(pack.propPool);
  const [banA, banB, banC] = pickDistinct(pack.banPool, 3);
  const cameraPool = isNight ? pack.cameraNightPool : pack.cameraDayPool;

  const payload = ensureSceneConsistency({
    themeKey: pack.key,
    themeLabel: pack.label,
    emotion: pickEmotion(pack, forcedAvoidEmotion, retryState.excludedEmotions),
    cast: pick(pack.castPool),
    location,
    time,
    atmosphere: pick(pack.atmospherePool),
    wardrobeA,
    wardrobeB,
    propA,
    propB,
    action: pick(pack.actionPool),
    camera: pick(cameraPool.length ? cameraPool : [...pack.cameraNightPool, ...pack.cameraDayPool]),
    texture: pick(pack.texturePool),
    banA,
    banB,
    banC,
    addOns: pickDistinct(pack.addOnPool, pack.addOnPool.length),
  });

  const window = resolveTargetWindow(targetLength);
  let prompt = composeHumanRealismPromptSkill({
    payload,
    mode: mode === "fast" ? "fast" : "pro",
    window,
  });
  if (prompt.length > window.max) {
    prompt = tryCompactText(prompt);
  }
  if (prompt.length > window.max) {
    const hardCap = Math.max(0, window.max - 1);
    prompt = `${prompt.slice(0, hardCap).replace(/[，；、\s]+$/g, "")}。`;
  }
  const signature = mergeFingerprints([
    payload.themeKey,
    payload.emotion,
    payload.cast,
    payload.location,
    payload.time,
    payload.wardrobeA,
    payload.wardrobeB,
    payload.propA,
    payload.propB,
    payload.action,
    payload.camera,
    payload.texture,
    payload.banA,
    payload.banB,
    payload.banC,
  ]);

  return {
    prompt,
    payload,
    signature,
    length: prompt.length,
    target: window.target,
    range: [window.min, window.max],
  };
};

const calcMaxSimilarity = (signature) => {
  if (!recentHistory.length) return 0;
  let max = 0;
  for (const item of recentHistory) {
    max = Math.max(max, jaccardSimilarity(signature, item.signature));
  }
  return max;
};

const pushHistory = (candidate) => {
  recentHistory.push({
    themeKey: candidate.payload.themeKey,
    emotion: candidate.payload.emotion,
    signature: candidate.signature,
    prompt: candidate.prompt,
  });
  if (recentHistory.length > HISTORY_LIMIT) recentHistory.shift();
};

const resolveForcedEmotion = () => {
  const latest = recentHistory.slice(-2).map((item) => item.emotion);
  if (latest.length < 2) return "";
  return latest[0] && latest[0] === latest[1] ? latest[0] : "";
};

export const generateRandomPromptSkill = ({ mode = "pro", targetLength = DEFAULT_TARGET_LENGTH } = {}) => {
  const memoryBefore = snapshotPromptMemorySkill();
  const routingContext = resolvePromptRouteSkill({
    mode,
    targetLength,
    recentHistory,
    memory: memoryBefore,
  });

  const normalizedMode = routingContext.mode;
  const forceAvoidEmotion = resolveForcedEmotion();
  let passScoreFloor = routingContext.criticPassScore;
  let similarityCap = routingContext.maxSimilarityAllowed;
  let targetLengthCursor = routingContext.targetLength;
  const retryState = {
    excludedThemeKeys: [],
    excludedEmotions: [],
  };
  const retryReasons = [];

  let winner = null;
  let winnerSimilarity = Number.POSITIVE_INFINITY;
  let winnerCritic = null;
  let winnerRank = Number.NEGATIVE_INFINITY;
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= routingContext.maxAttempts; attempt += 1) {
    attemptsUsed = attempt;
    const candidate = buildCandidate({
      mode: normalizedMode,
      targetLength: targetLengthCursor,
      forcedAvoidEmotion: forceAvoidEmotion,
      routingContext,
      retryState,
    });
    const similarity = calcMaxSimilarity(candidate.signature);
    const critic = evaluatePromptCriticSkill({
      candidate,
      similarity,
      maxSimilarityAllowed: similarityCap,
      forceAvoidEmotion,
    });

    const isQualified = critic.pass && critic.score >= passScoreFloor && similarity <= similarityCap;
    if (isQualified) {
      winner = candidate;
      winnerSimilarity = similarity;
      winnerCritic = critic;
      break;
    }

    const rank = critic.score - similarity * 18;
    if (!winner || rank > winnerRank) {
      winner = candidate;
      winnerSimilarity = similarity;
      winnerCritic = critic;
      winnerRank = rank;
    }

    const retryPlan = planPromptRetrySkill({
      attempt,
      maxAttempts: routingContext.maxAttempts,
      route: routingContext,
      critic,
      candidate,
      similarity,
      currentTargetLength: targetLengthCursor,
      currentMaxSimilarityAllowed: similarityCap,
    });

    targetLengthCursor = retryPlan.nextTargetLength;
    similarityCap = retryPlan.nextMaxSimilarityAllowed;
    passScoreFloor = retryPlan.nextPassScore;
    if (retryPlan.excludeThemeKey) {
      retryState.excludedThemeKeys = [...new Set([...retryState.excludedThemeKeys, retryPlan.excludeThemeKey])].slice(-3);
    }
    if (retryPlan.excludeEmotion) {
      retryState.excludedEmotions = [...new Set([...retryState.excludedEmotions, retryPlan.excludeEmotion])].slice(-3);
    }
    retryReasons.push(...retryPlan.reasons);
  }

  if (!winnerCritic) {
    winnerCritic = evaluatePromptCriticSkill({
      candidate: winner,
      similarity: winnerSimilarity,
      maxSimilarityAllowed: similarityCap,
      forceAvoidEmotion,
    });
  }

  const acceptedOutcome = winnerCritic.pass && winnerCritic.score >= passScoreFloor && winnerSimilarity <= similarityCap;
  rememberPromptOutcomeSkill({
    themeKey: winner.payload.themeKey,
    emotion: winner.payload.emotion,
    accepted: acceptedOutcome,
    score: winnerCritic.score,
    issues: winnerCritic.issues,
  });

  pushHistory(winner);
  const memoryAfter = snapshotPromptMemorySkill();
  return {
    prompt: winner.prompt,
    metadata: {
      mode: normalizedMode,
      theme: winner.payload.themeLabel,
      targetLength: winner.target,
      actualLength: winner.length,
      similarityToRecent: Number(winnerSimilarity.toFixed(3)),
      dedupeWindowSize: HISTORY_LIMIT,
      attemptsUsed,
      critic: {
        pass: winnerCritic.pass,
        score: winnerCritic.score,
        issues: winnerCritic.issues.slice(0, 3),
        breakdown: winnerCritic.breakdown,
      },
      router: {
        exploration: routingContext.exploration,
        maxAttempts: routingContext.maxAttempts,
        maxSimilarityAllowed: routingContext.maxSimilarityAllowed,
        diversity: routingContext.diversity,
        preferredThemes: routingContext.preferredThemes,
      },
      retry: {
        attemptsUsed,
        passScoreFloor,
        similarityCap,
        reasons: [...new Set(retryReasons)].slice(0, 5),
      },
      memory: {
        observedBefore: memoryBefore?.totals?.observed || 0,
        observedAfter: memoryAfter?.totals?.observed || 0,
        preferredThemes: memoryAfter.preferredThemes.slice(0, 3),
      },
    },
  };
};

export const __unsafeResetRandomPromptSkillHistory = () => {
  recentHistory.length = 0;
};
