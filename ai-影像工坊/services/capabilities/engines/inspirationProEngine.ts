
import { Infrastructure } from "../../api/client";
import { SafetySentinel } from "../guardrails/safetySentinel";

// ==========================================
// 灵感引擎 Pro (Inspiration Engine Professional)
// 职责: 利用 Gemini 3 Pro 的推理能力，将随机的灵感碎片熔炼成大师级摄影指令
// 风格: 亚洲美学特化 (中/日/港台) - 私房、情绪、蒙太奇
// ==========================================

// 1. 灵感分子库 (Inspiration Molecules) - 扩展至 10x 组合可能性
const MOLECULES = {
    // 角色 (Who)
    SUBJECTS: [
        "刚失恋的昭和风少女", "疲惫的便利店夜班店员", "满身纹身的地下贝斯手", "眼神空洞的玩偶修复师", 
        "穿着校服逃课的学生", "在浴缸里睡着的女人", "对着镜子剪头发的人", "满脸伤痕的拳击手",
        "穿着旗袍的神秘客", "迷失在重庆大厦的旅人", "在天台放烟花的少年", "正在卸妆的京剧演员",
        "雨夜中的杀手", "在这个城市没有家的流浪诗人", "拥有金鱼般记忆的女孩", "像猫一样的女人"
    ],
    // 场景 (Where)
    LOCATIONS: [
        "布满蒸汽的公共浴室", "凌晨三点的24小时洗衣房", "贴满小广告的电梯间", "长满青苔的废弃泳池",
        "霓虹闪烁的九龙城寨暗巷", "堆满旧书和唱片的狭窄房间", "在此刻下雪的东京铁塔下", "摇晃的绿皮火车车厢",
        "充满消毒水味的医院走廊", "红色灯光的复古发廊", "透明雨伞下的涩谷街头", "空无一人的午夜地铁",
        "廉价的情人旅馆", "夏日的学校天台", "烟雾缭绕的麻将馆", "水族馆的蓝色幽光中"
    ],
    // 情绪/氛围 (Mood)
    MOODS: [
        "极度暧昧", "疏离与孤独", "躁动不安", "湿润且粘稠", "濒临崩溃的边缘", 
        "像梦一样虚幻", "具有攻击性的性感", "压抑的暴力美学", "世纪末的颓废感", "冷酷的理智",
        "热恋后的空虚", "无法言说的秘密", "对未知的恐惧", "沉溺于过去", "野蛮生长"
    ],
    // 视觉元素/道具 (Props/Visuals)
    ELEMENTS: [
        "死去的昆虫", "融化的冰淇淋", "燃烧的香烟", "破碎的镜子", "散落一地的药片",
        "鲜红的口红印", "缠绕的耳机线", "金鱼缸", "过期罐头", "老式胶片相机",
        "纠缠的肢体", "半个西瓜", "透明雨衣", "发光的灯管", "流血的石膏像"
    ],
    // 摄影风格/流派 (Style)
    STYLES: [
        "王家卫式抽帧 (Wong Kar-wai Step-printing)", 
        "荒木经惟式私房 (Araki Eroticism)", 
        "森山大道式粗颗粒黑白 (Moriyama High Contrast)", 
        "蜷川实花式高饱和 (Ninagawa Acid Color)", 
        "筱山纪信式少女写真 (Kishin Shinoyama)",
        "滨田英明式日系清透 (Hideaki Hamada)",
        "盖·伯丁式超现实 (Guy Bourdin Surrealism)",
        "胶片漏光 Lomo 风格",
        "90年代港片质感",
        "王兵式原生纪录片感"
    ]
};

const getRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export const InspirationProEngine = {
    
    /**
     * 生成大师级灵感提示词
     */
    generateMasterpiece: async (signal?: AbortSignal): Promise<string> => {
        // 1. 随机抽取灵感分子
        const seeds = {
            subject: getRandom(MOLECULES.SUBJECTS),
            location: getRandom(MOLECULES.LOCATIONS),
            mood: getRandom(MOLECULES.MOODS),
            element: getRandom(MOLECULES.ELEMENTS),
            style: getRandom(MOLECULES.STYLES)
        };

        // 2. 构建 Meta-Prompt
        const systemPrompt = `
        Role: A legendary Art Director & Photographer (Fusion of Wong Kar-wai, Nobuyoshi Araki, and Daido Moriyama).
        Task: Synthesize a coherent, artistic, and visually stunning photography prompt based on the provided random fragments.
        Language: Chinese (中文).
        
        Input Fragments:
        - Subject: ${seeds.subject}
        - Location: ${seeds.location}
        - Mood: ${seeds.mood}
        - Key Element: ${seeds.element}
        - Aesthetic Style: ${seeds.style}
        
        Requirements:
        1. **Logic Consistency**: Ensure the subject and location make sense together. If they conflict, create a surreal justification.
        2. **Visual Poetry**: Don't just list words. Describe the lighting, texture, and the specific moment.
        3. **Format**: Return a single paragraph describing the shot (approx 80-120 words).
        4. **Safety**: Avoid explicit NSFW or gore. Sublimate into "Artistic Tension".
        5. **No Explanations**: Just output the final prompt text.
        
        Example Output: 
        "王家卫美学风格。一名刚失恋的短发少女，独自坐在凌晨三点的便利店窗边。窗外是倾盆大雨和模糊的霓虹灯光。她手里握着一罐过期的凤梨罐头，眼神空洞地注视着玻璃上的倒影。高对比度的冷暖色调对冲，画面带有明显的胶片颗粒感和轻微的动态模糊，传递出一种都市中极致的疏离与孤独感。"
        `;

        try {
            // 3. 统一文本路由：使用当前用户选择的文本模型
            const targetModel = Infrastructure.getModelPreferences().textModel;
            const resultText = await Infrastructure.routeRequest(
                targetModel,
                [{ role: "system", content: systemPrompt }],
                undefined,
                signal
            );

            // 4. 安全过筛 (Final Safety Check)
            const safePrompt = SafetySentinel.sanitize(resultText);
            
            return safePrompt || `${seeds.style}。${seeds.subject}在${seeds.location}，伴随着${seeds.element}，充满${seeds.mood}。`;

        } catch (e) {
            console.error("InspirationProEngine Failed:", e);
            // 兜底：直接拼接
            return `${seeds.style}。${seeds.subject}出现在${seeds.location}，画面中包含${seeds.element}，整体氛围${seeds.mood}。`;
        }
    }
};
