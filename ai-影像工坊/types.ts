
// ==========================================
// 数据类型定义层 (Type Definitions)
// 作用: 定义整个应用的数据结构、状态机和接口规范
// ==========================================

// --- 新增: 资产轴线与风险标记 (Asset Axes & Risk Flags) ---
export type AssetAxis =
  | "gaze_pressure"          // 凝视压迫
  | "camera_intrusion"       // 机位侵入
  | "material_presence"      // 材质存在感
  | "body_reality"           // 身体现实重量
  | "social_discomfort"      // 社交不适
  | "documentary_coldness"   // 纪录冷感
  | "composition_instability"// 构图不稳
  | "lighting_hardness";     // 硬光强度

export type RiskFlag =
  | "sexualized_intent"      // 易被写歪为挑逗
  | "explicit_nudity"        // 显式裸露
  | "explicit_act"           // 显式行为
  | "fetish_keyword"         // 恋物关键词
  | "minor_risk";            // 未成年风险

// --- V2 资产槽位定义 (New Slot System) ---
export type AssetSlot = 
  // Anchors (Fixed per Option)
  | "facial" | "bodyForm" | "persona"
  // Grammar (Stable per Option)
  | "cameraGrammar" | "compositionGrammar" | "lightingGrammar" | "environmentGrammar"
  // Palette (Varies per Shot)
  | "expression" | "posture" | "microGesture" | "wardrobeMaterial";

export interface CreativeAsset {
    id: string;
    content: string; // 实际的提示词内容
    tags: string[];  // 用于检索的标签 (V2 必含 slot:X, family:Y)
    intensity?: number; // 情绪强度 (1-5)
    
    // V2 增量字段
    title?: string;
    axes?: Partial<Record<AssetAxis, number>>;        // 0~1
    riskFlags?: RiskFlag[];                           // 风险提示
    usageNotes?: string[];                            // 给 promptEngine 的“怎么用”
    variants?: Array<{
        id: string;
        content: string;
        axes?: Partial<Record<AssetAxis, number>>;
        tags?: string[];
    }>;                                               // 资产自带变体（用于扩展联想）
    
    // V2 Pack 支持
    packId?: string;
    family?: string;
    slot?: AssetSlot;
}

// --- 导演与剧本相关 (Director & Script) ---

export interface ShootContract {
  subjectIdentity: string;
  wardrobe: string;
  location: string;
  lighting: string;
  cameraLanguage: string;
  texture: string;
}

export interface CharacterProfile {
  description: string; // 身份/面孔
  body: string;        // 身材 (新增)
  details: string[];   // 细节特征 (Stores BP:: token here)
  isLocked?: boolean;
  origin?: 'user' | 'director';
}

export interface WardrobeProfile {
  description: string;
  material: string;
  accessories: string[];
  origin?: 'user' | 'director';
}

export interface SetProfile {
  environment: string;
  timeOfDay: string;
  atmosphere: string;
  origin?: 'user' | 'director';
}

export interface ProductionNotes {
  lighting: string;
  palette: string;
  composition: string;
}

// --- Blueprint & Constraints System (New Architecture) ---

export type LockWhere = "GLOBAL" | "OPTION_A" | "OPTION_B" | "SHOT";
export type LockStrength = "MUST" | "SHOULD";

export type HardLock =
  | { kind: "product"; where: LockWhere; strength: LockStrength; productId: string; payload?: any }
  | { kind: "asset"; where: LockWhere; strength: LockStrength; assetId: string }
  | { kind: "shot_rule"; where: LockWhere; strength: LockStrength; rule: string; params?: any }
  | { kind: "text"; where: LockWhere; strength: LockStrength; text: string };

export type CreativeConstraints = {
  hardLocks: HardLock[];
  directorScope?: {
    allowedSlots: string[]; 
    driftCaps?: Partial<Record<string, number>>; 
  };
};

export type OptionBlueprint = {
  optionId: "A" | "B";
  anchors: {
    facial: string;    
    bodyForm: string;
    wardrobe: string;
    persona?: string;
  };
  grammar: {
    camera: string[];
    composition: string[];
    lighting: string[];
    environment: string[];
  };
  palette: {
    expressionPool: string[];
    posturePool: string[];
    microGesturePool?: string[];
  };
};

export type RuntimeBlueprint = {
    constraints: CreativeConstraints;
    options: {
        A: OptionBlueprint;
        B: OptionBlueprint;
    };
};

// --- 图像生成相关 (Image Generation) ---

export interface FrameMetadata {
  model: string;
  provider: string;
  strategy: string;
  resolution: string;
  duration?: number;
  type?: 'reference' | 'shot';
  variant?: string;
  variantType?: 'strict' | 'balanced' | 'creative';
  castingTraits?: string; // May contain BP:: token
}

export interface ShootGuide {
  keyPoses: string[];
  emotionalSpectrum: string[];
}

export interface DirectorShotPacket {
  shotId: string;
  beatIndex: number;
  description: string;
  camera: string;
  mood: string;
  promptPack: {
    base: string;
    style: string;
    variantHint?: string;
  };
  negativePack: string[];
}

export interface DirectorPacket {
  project: {
    premise: string;
    title: string;
    tension: string;
    complexityLevel: string;
  };
  styleProfile: {
    visualSignature: string;
    lightingRule: string;
    paletteRule: string;
    compositionRule: string;
  };
  characterProfile: {
    identityAnchor: string;
    bodyAnchor: string;
    wardrobeAnchor: string;
    detailAnchors: string[];
  };
  shots: DirectorShotPacket[];
}

export interface Frame {
  id: number;
  description: string;
  status: 'scripting' | 'pending' | 'generating' | 'completed' | 'failed'; 
  imageUrl?: string;
  error?: string;
  metadata?: FrameMetadata;
}

export interface ShootPlan {
  title: string;
  directorInsight: string;
  
  productionNotes?: ProductionNotes;

  continuity: {
      character: CharacterProfile;
      wardrobe: WardrobeProfile;
      set: SetProfile;
  };

  shootScope: {            
      nonNegotiables: string[];
      flexibleElements: string[];
      complexityLevel: 'high' | 'medium' | 'low';
  };
  shootGuide?: ShootGuide;
  contract: ShootContract;
  frames: string[];
  visualVariants?: string[];
  conceptFrames?: Frame[];
  selectedConceptId?: number;
  directorPacket?: DirectorPacket;
}

export enum AppState {
  IDLE = 'IDLE',
  PLANNING = 'PLANNING',
  CONCEPT = 'CONCEPT',
  SHOOTING = 'SHOOTING'
}

export type ShootStrategy = 'pro' | 'flash' | 'hybrid';
export type DirectorModel = string;
export type TextModel = string;
export type ImageModel = string;
export type TensionLevel = 'dramatic' | 'minimalist' | 'surreal';

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'network';
  message: string;
  latency?: number;
}
