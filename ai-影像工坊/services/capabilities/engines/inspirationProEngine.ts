import { SafetySentinel } from "../guardrails/safetySentinel";

// ==========================================
// 灵感引擎 Pro（真实纪实闪光版）
// 职责: 产出“可拍、可控、真实”的高张力中文提示词
// 设计原则:
// 1) 角色合同不可变（真实亚洲成年人 23+）
// 2) 只随机镜头参数与叙事变量
// 3) 风格核固定为纪实直闪 / 粗颗粒 / 厚黑阴影
// ==========================================

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SUBJECT_POOL = [
  "短发东亚女性，成年 23+，眼神疲惫但清醒",
  "东亚男性，成年 25+，面部有轻微胡渣与黑眼圈",
  "东亚女性，成年 27+，妆面微脱、皮肤有真实毛孔",
  "东亚男性，成年 30+，颧骨明显，脸部有浅色旧疤",
];

const WARDROBE_POOL = [
  "旧 T 恤与牛仔下装，褶皱明显",
  "工装外套与运动裤，边缘磨损",
  "学院风制服（成人版），领口与袖口有使用痕迹",
  "内衣外搭造型（成人 editorial），外层透明衬衫",
];

const LOCATION_POOL = [
  "夏日天台，混凝土地面返热",
  "便利店后巷，地面有积水与烟头",
  "旧居民楼楼道，墙皮剥落",
  "夜班出租车后座，窗玻璃有指纹",
  "公共洗衣房角落，荧光灯频闪",
];

const CAMERA_POOL = [
  "35mm 近距离抓拍，轻微歪构图",
  "50mm 中近景，低机位仰拍",
  "28mm 广角贴脸，边缘轻微拉伸",
  "35mm 半身，机位略高，压缩背景",
];

const ACTION_POOL = [
  "抬手整理头发，动作停在半拍",
  "俯身系鞋带，脚底短暂暴露",
  "靠墙坐下，膝盖抬起，肩线不对称",
  "回头看向镜头，呼吸可见",
  "手指擦过嘴角，视线游离",
];

const DETAIL_POOL = [
  "脚底沾灰与细小划痕可见",
  "皮肤有毛孔、细汗、轻微痘印",
  "眼下暗沉与法令纹真实保留",
  "布料勒痕与折痕真实可见",
  "锁骨与颈侧有高光溢出",
];

const SHADOW_POOL = [
  "机顶直闪，厚黑硬阴影，背景掉入黑场",
  "单点硬光，脸部高光炸点，暗部保留噪点",
  "反差拉高，阴影区发黑但有颗粒层次",
];

const PROP_POOL = [
  "融化的冰淇淋",
  "被踩扁的纸杯",
  "塑料袋与旧报纸",
  "褪色的雨伞",
  "廉价首饰与钥匙串",
];

const MOOD_POOL = [
  "疏离",
  "疲惫",
  "挑衅",
  "冷静",
  "不安",
];

const buildPrompt = () => {
  const subject = pick(SUBJECT_POOL);
  const wardrobe = pick(WARDROBE_POOL);
  const location = pick(LOCATION_POOL);
  const camera = pick(CAMERA_POOL);
  const action = pick(ACTION_POOL);
  const detailA = pick(DETAIL_POOL);
  const detailB = pick(DETAIL_POOL.filter((d) => d !== detailA));
  const shadow = pick(SHADOW_POOL);
  const prop = pick(PROP_POOL);
  const mood = pick(MOOD_POOL);

  return `
【角色合同（不可变）】
真实亚洲成年人（23岁以上），东亚骨相，真实皮肤纹理与人体比例；严禁未成年语义与幼态化。

【分镜参数（可变）】
场景：${location}。服装：${wardrobe}。镜头：${camera}。
动作：${action}。道具：${prop}。情绪：${mood}。

【真实细节】
${detailA}；${detailB}。

【光影与质感】
${shadow}；CCD/早期数码颗粒，允许轻微过曝与失焦，不做塑料磨皮，不做卡通化。
  `.replace(/\n{2,}/g, "\n").trim();
};

export const InspirationProEngine = {
  generateMasterpiece: async (): Promise<string> => {
    const prompt = buildPrompt();
    return SafetySentinel.sanitize(prompt) || prompt;
  },
};

