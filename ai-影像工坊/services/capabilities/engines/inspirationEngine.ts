import { SafetySentinel } from "../guardrails/safetySentinel";

// ==========================================
// 灵感引擎（快启版）
// 职责: 快速生成一条稳定可用的中文拍摄提示词
// ==========================================

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SCENES = ["天台边缘", "便利店门口", "旧楼楼道", "地铁换乘通道", "出租车后座"];
const ACTIONS = ["回头对视镜头", "俯身整理鞋带", "靠墙坐下抬膝", "抬手抹去嘴角水痕", "低头点烟后停住"];
const SHOTS = ["35mm 近景", "50mm 中景", "28mm 广角贴脸", "35mm 低机位半身"];
const DETAILS = ["脚底沾灰", "皮肤毛孔清晰", "轻微黑眼圈", "布料勒痕可见", "细汗反光"];
const LIGHTS = ["机顶直闪", "单点硬光", "反差高黑位重"];

export const InspirationEngine = {
  generateHighTensionPrompt: (): string => {
    const a = pick(DETAILS);
    const b = pick(DETAILS.filter((x) => x !== a));
    const text = `
真实亚洲成年人（23岁以上），东亚骨相，保持自然皮肤纹理与真实人体比例。
场景在${pick(SCENES)}，${pick(SHOTS)}，动作为${pick(ACTIONS)}。
光影采用${pick(LIGHTS)}，颗粒与轻微过曝保留，构图可轻微失衡。
细节必须可见：${a}、${b}。整体质感偏纪实抓拍，拒绝卡通与塑料磨皮。
    `
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return SafetySentinel.sanitize(text) || text;
  },
};

