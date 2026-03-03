import { Frame, FrameMetadata, ShootPlan } from "../../types";

export interface MasterSessionProfile {
    readonly name: string;
    readonly identityLock: string;
    readonly bodyLock: string;
    readonly styleSignature: string;
    readonly lightingLock: string;
    readonly paletteLock: string;
    readonly compositionLock: string;
    readonly environmentLock: string;
    readonly wardrobeLock: string;
    readonly emotionalSpectrum: string[];
    readonly poseLibrary: string[];
    readonly visualVariants: string[];
}

export interface FrameScoreDetail {
    score: number;
    reason: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeText = (value: string): string => String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const cleanOptionPrefix = (value: string): string =>
    String(value || "").replace(/^(Option|Variant|方案)\s*[\w\d]*[:\.\-\uff1a]\s*/i, "").trim();

const firstOption = (value: string): string => {
    const raw = normalizeText(value);
    if (!raw) return "";
    const chunks = raw.split("||").map((item) => cleanOptionPrefix(item)).filter(Boolean);
    return chunks[0] || cleanOptionPrefix(raw);
};

const mergeClause = (primary: string, secondary: string): string => {
    const left = normalizeText(primary);
    const right = normalizeText(secondary);
    if (!left) return right;
    if (!right) return left;
    if (left.includes(right)) return left;
    if (right.includes(left)) return right;
    return `${left}，${right}`;
};

const SHOT_GRAMMAR = [
    "waist-up portrait, 50mm lens, eye-level",
    "half-body profile, 50mm lens, slight shoulder turn",
    "seated pose, 50mm lens, low camera angle",
    "leaning against wall, 50mm lens, shallow depth of field",
    "hand-detail close-up, 85mm lens, shallow focus",
    "backlight silhouette, 50mm lens, negative space composition",
] as const;

const SHOT_MOODS = [
    "contained tension",
    "quiet confidence",
    "restrained intimacy",
    "controlled vulnerability",
    "cinematic stillness",
] as const;

const STYLE_KEYWORDS = [
    "50mm",
    "film grain",
    "low saturation",
    "window side light",
    "4:5 composition",
];

export const DEFAULT_MASTER_SESSION_PROFILE: MasterSessionProfile = {
    name: "OneTap Master",
    identityLock: "同一位真实东亚成年人（23+），面部与体态连续一致",
    bodyLock: "真实人体比例，避免娃娃脸和塑料皮肤",
    styleSignature: "50mm film portrait, side window key light, low saturation cinematic palette, subtle grain, soft contrast",
    lightingLock: "单侧窗光 + 柔和补光，避免爆闪与霓虹污染",
    paletteLock: "低饱和胶片肤色，暖灰底色，统一颗粒质感",
    compositionLock: "4:5 竖构图，主体占画面 55%-70%，保留负空间",
    environmentLock: "室内静态场景（窗边/墙角/床边），背景克制且不抢主体",
    wardrobeLock: "丝缎或针织材质，纯色低纹理，避免复杂图案",
    emotionalSpectrum: ["克制", "暧昧", "冷静", "张力", "沉静"],
    poseLibrary: [
        "坐姿微前倾，手指轻触锁骨",
        "背靠墙面，回眸直视镜头",
        "侧身坐在床沿，脚尖点地",
        "站立倚窗，手部整理发丝",
        "低头整理袖口，露出手腕与指节细节",
        "半躺姿态，肩颈线条自然延展",
        "单膝上椅，身体微旋转形成对角线",
        "双手环抱上臂，视线偏离镜头",
        "镜前停顿，利用反射形成双层构图",
        "坐姿交叠双腿，保持肩颈放松",
        "靠近窗帘，利用边缘光勾勒轮廓",
        "侧脸特写，强调睫毛与唇线细节",
    ],
    visualVariants: [
        "母版A: 50mm窗侧光，低饱和胶片肤色，克制张力",
        "母版B: 50mm近景，轻颗粒，暖灰底色，细节优先",
        "母版C: 85mm手部特写，低对比，强调材质触感",
        "母版D: 50mm半身构图，负空间，电影静帧感",
        "母版E: 背光轮廓构图，柔化高光，暗部保留纹理",
        "母版F: 镜面反射构图，低饱和，情绪克制",
    ],
};

export const buildMasterShotList = (
    scene: string,
    count: number,
    profile: MasterSessionProfile = DEFAULT_MASTER_SESSION_PROFILE
): string[] => {
    const safeScene = normalizeText(scene) || profile.environmentLock;
    const targetCount = Math.max(1, Math.floor(count || 1));
    const shots: string[] = [];

    for (let i = 0; i < targetCount; i += 1) {
        const pose = profile.poseLibrary[i % profile.poseLibrary.length];
        const grammar = SHOT_GRAMMAR[i % SHOT_GRAMMAR.length];
        const mood = SHOT_MOODS[i % SHOT_MOODS.length];
        shots.push(`${grammar}, ${pose}, ${safeScene}, mood: ${mood}`);
    }
    return shots;
};

export const applyMasterProfileToPlan = (
    plan: ShootPlan,
    profile: MasterSessionProfile = DEFAULT_MASTER_SESSION_PROFILE
): ShootPlan => {
    const baseCharacter = firstOption(plan.continuity?.character?.description || "");
    const baseBody = firstOption(plan.continuity?.character?.body || "");
    const baseWardrobe = firstOption(plan.continuity?.wardrobe?.description || "");
    const baseEnvironment = firstOption(plan.continuity?.set?.environment || "");
    const baseTime = normalizeText(plan.continuity?.set?.timeOfDay || "") || "黄金时段自然光";
    const baseAtmosphere = normalizeText(plan.continuity?.set?.atmosphere || "") || "安静、克制、带轻微湿度感";
    const targetFrameCount = Math.max(12, Math.min(20, (plan.frames || []).length || 12));

    const nonNegotiables = new Set<string>([
        ...(plan.shootScope?.nonNegotiables || []),
        "主体身份锁定，不更换人脸与体态",
        "风格锁定：镜头、布光、色调与构图保持一致",
        "动作仅使用母版姿态库，不引入随机大幅动作",
        "输出遵循统一后期基线（低饱和 + 轻颗粒）",
    ]);

    const mergedPlan: ShootPlan = {
        ...plan,
        productionNotes: {
            lighting: mergeClause(profile.lightingLock, plan.productionNotes?.lighting || ""),
            palette: mergeClause(profile.paletteLock, plan.productionNotes?.palette || ""),
            composition: mergeClause(profile.compositionLock, plan.productionNotes?.composition || ""),
        },
        continuity: {
            ...plan.continuity,
            character: {
                ...plan.continuity.character,
                description: mergeClause(profile.identityLock, baseCharacter),
                body: mergeClause(profile.bodyLock, baseBody),
                details: Array.from(new Set([
                    ...(plan.continuity.character.details || []),
                    "IDENTITY_LOCK: master-session",
                    "STYLE_LOCK: one-tap-master",
                ])),
            },
            wardrobe: {
                ...plan.continuity.wardrobe,
                description: mergeClause(profile.wardrobeLock, baseWardrobe),
            },
            set: {
                ...plan.continuity.set,
                environment: mergeClause(profile.environmentLock, baseEnvironment),
                timeOfDay: baseTime,
                atmosphere: baseAtmosphere,
            },
        },
        shootScope: {
            ...plan.shootScope,
            nonNegotiables: Array.from(nonNegotiables),
        },
        shootGuide: {
            keyPoses: [...profile.poseLibrary],
            emotionalSpectrum: [...profile.emotionalSpectrum],
        },
        visualVariants: [...profile.visualVariants],
        frames: buildMasterShotList(baseEnvironment || profile.environmentLock, targetFrameCount, profile),
    };

    return mergedPlan;
};

export const scoreFrameForCuration = (
    frame: Frame,
    profile: MasterSessionProfile = DEFAULT_MASTER_SESSION_PROFILE
): FrameScoreDetail => {
    const meta: Partial<FrameMetadata> = frame.metadata || {};
    const desc = normalizeText(frame.description);
    const variant = normalizeText(meta.variant || "");
    const detailTokens = normalizeText(meta.castingTraits || "");
    let score = 54;
    const reasons: string[] = [];

    if (frame.status === "completed" && frame.imageUrl) {
        score += 8;
        reasons.push("生成完成");
    }

    if (/4k/i.test(meta.resolution || "")) {
        score += 12;
        reasons.push("4K基线");
    } else {
        score += 4;
    }

    if (/pro/i.test(meta.model || "") || /pro/i.test(meta.strategy || "")) {
        score += 8;
        reasons.push("高质量模型");
    }

    if (desc.length >= 24 && desc.length <= 180) {
        score += 6;
        reasons.push("镜头描述完整");
    } else {
        score -= 6;
    }

    if (detailTokens.includes("BP::") || detailTokens.includes("IDENTITY_LOCK")) {
        score += 6;
        reasons.push("身份锚点存在");
    }

    if (STYLE_KEYWORDS.some((item) => variant.toLowerCase().includes(item))) {
        score += 6;
        reasons.push("风格命中母版关键词");
    } else if (variant) {
        score += 2;
    }

    const descLower = desc.toLowerCase();
    const riskKeywords = ["anime", "cartoon", "cgi", "3d render", "neon", "cyberpunk", "plastic skin"];
    if (riskKeywords.some((item) => descLower.includes(item) || variant.toLowerCase().includes(item))) {
        score -= 24;
        reasons.push("偏离写实母版");
    }

    if (profile.poseLibrary.some((pose) => desc.includes(pose.slice(0, 6)))) {
        score += 4;
        reasons.push("命中姿态库");
    }

    const finalScore = clamp(Math.round(score), 0, 100);
    const reason = reasons.slice(0, 3).join(" / ") || "基础通过";
    return { score: finalScore, reason };
};

interface CurateOptions {
    keepRatio?: number;
    minKeep?: number;
    maxKeep?: number;
}

export const curateFrames = (
    frames: Frame[],
    options: CurateOptions = {}
): Frame[] => {
    const completed = frames.filter((frame) => frame.status === "completed" && Boolean(frame.imageUrl));
    if (completed.length === 0) return frames;

    const keepRatio = clamp(options.keepRatio ?? 0.2, 0.05, 1);
    const minKeep = Math.max(1, options.minKeep ?? 4);
    const maxKeep = Math.max(minKeep, options.maxKeep ?? 20);
    const keepCount = clamp(
        Math.round(completed.length * keepRatio),
        Math.min(minKeep, completed.length),
        Math.min(maxKeep, completed.length)
    );

    const scored = completed.map((frame) => ({
        frameId: frame.id,
        ...scoreFrameForCuration(frame),
    })).sort((a, b) => b.score - a.score);

    const keepIds = new Set(scored.slice(0, keepCount).map((item) => item.frameId));
    const scoredMap = new Map(scored.map((item) => [item.frameId, item]));

    return frames.map((frame) => {
        if (frame.status !== "completed" || !frame.imageUrl) return frame;

        const score = scoredMap.get(frame.id);
        if (!score) return frame;

        const keep = keepIds.has(frame.id);
        return {
            ...frame,
            metadata: {
                ...(frame.metadata || {
                    model: "unknown",
                    provider: "unknown",
                    strategy: "unknown",
                    resolution: "unknown",
                }),
                curationScore: score.score,
                curationStatus: keep ? "keep" : "drop",
                curationReason: keep ? `入选: ${score.reason}` : `淘汰: ${score.reason}`,
            },
        };
    });
};

export const summarizeCuration = (frames: Frame[]) => {
    let keep = 0;
    let drop = 0;
    let pending = 0;

    for (const frame of frames) {
        const status = frame.metadata?.curationStatus;
        if (status === "keep") keep += 1;
        else if (status === "drop") drop += 1;
        else pending += 1;
    }

    return { keep, drop, pending };
};
