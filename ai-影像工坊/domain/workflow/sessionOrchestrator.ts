import type {
  DirectorPacket,
  DirectorShotPacket,
  Frame,
  FrameMetadata,
  ShootPlan,
  ShootStrategy,
} from '../../types';

const buildBaseShotMetadata = (
  seed: FrameMetadata | undefined,
  imageModel: string,
  runtimeStrategy: ShootStrategy,
  variant?: string,
  castingTraits?: string
): FrameMetadata => ({
  ...(seed || {
    model: imageModel,
    provider: 'Gateway',
    strategy: runtimeStrategy,
    resolution: runtimeStrategy === 'pro' ? '4K' : 'Std',
  }),
  model: imageModel,
  strategy: runtimeStrategy,
  resolution: runtimeStrategy === 'pro' ? '4K' : 'Std',
  type: 'shot',
  variant,
  castingTraits,
  curationStatus: 'pending',
  curationScore: undefined,
  curationReason: undefined,
});

export const buildDirectorShotPacket = (
  packet: DirectorPacket | undefined,
  description: string,
  index: number,
  seed?: Partial<DirectorShotPacket>
): DirectorShotPacket => ({
  shotId: `S${String(index + 1).padStart(2, '0')}`,
  beatIndex: index + 1,
  description,
  camera: seed?.camera || '中景',
  mood: seed?.mood || '中性',
  promptPack: {
    base: description,
    style: seed?.promptPack?.style || packet?.styleProfile?.visualSignature || '电影感',
    variantHint: seed?.promptPack?.variantHint || packet?.styleProfile?.visualSignature || '电影感',
  },
  negativePack: Array.isArray(seed?.negativePack) ? [...seed.negativePack] : [],
});

export const syncPlanWithDirectorPacket = (basePlan: ShootPlan, descriptions: string[]): ShootPlan => {
  const normalized = descriptions.map((item) => String(item || '').trim()).filter(Boolean);
  if (!normalized.length) return basePlan;

  if (!basePlan.directorPacket) {
    return { ...basePlan, frames: normalized };
  }

  const existingShots = Array.isArray(basePlan.directorPacket.shots) ? basePlan.directorPacket.shots : [];
  const nextShots = normalized.map((desc, idx) => {
    const previous = existingShots[idx];
    return buildDirectorShotPacket(basePlan.directorPacket, desc, idx, previous);
  });

  return {
    ...basePlan,
    frames: normalized,
    directorPacket: {
      ...basePlan.directorPacket,
      shots: nextShots,
    },
  };
};

export const buildConceptProposalFrames = (
  plan: ShootPlan,
  conceptCount: number,
  imageModel: string,
  castingTraits: string
): Frame[] => {
  let variants = plan.visualVariants || [];
  if (variants.length < conceptCount) {
    variants = [...variants, ...Array(conceptCount - variants.length).fill('标准视觉方案 - 选角: 默认')];
  }

  const strictBound = Math.max(1, Math.floor(conceptCount / 3));
  const balancedBound = Math.max(strictBound + 1, Math.floor((conceptCount * 2) / 3));

  return variants.slice(0, conceptCount).map((variantDesc, index) => {
    let variantType: 'strict' | 'balanced' | 'creative' = 'balanced';
    if (index < strictBound) variantType = 'strict';
    else if (index < balancedBound) variantType = 'balanced';
    else variantType = 'creative';

    return {
      id: -1 - index,
      description: variantDesc,
      status: 'pending',
      metadata: {
        model: imageModel,
        provider: 'Hybrid',
        strategy: 'Concept',
        resolution: 'Std',
        variant: variantDesc,
        variantType,
        type: 'reference',
        castingTraits,
        curationStatus: 'pending',
      },
    };
  });
};

interface ShootFrameBuildInput {
  descriptions: string[];
  selectedFrame: Frame;
  imageModel: string;
  runtimeStrategy: ShootStrategy;
  targetCount: number;
  placeholderDescription?: string;
}

export const buildShootFrames = ({
  descriptions,
  selectedFrame,
  imageModel,
  runtimeStrategy,
  targetCount,
  placeholderDescription = '正在等待导演分镜指令...',
}: ShootFrameBuildInput): { framesToShoot: Frame[]; needed: number } => {
  const lockedVariant = selectedFrame.metadata?.variant;
  const lockedCasting = selectedFrame.metadata?.castingTraits;
  const baseMetadata = selectedFrame.metadata;

  const framesToShoot: Frame[] = descriptions.map((description, index) => ({
    id: index + 1,
    description,
    status: 'pending',
    metadata: buildBaseShotMetadata(baseMetadata, imageModel, runtimeStrategy, lockedVariant, lockedCasting),
  }));

  const needed = Math.max(0, targetCount - framesToShoot.length);
  for (let i = 0; i < needed; i += 1) {
    framesToShoot.push({
      id: framesToShoot.length + 1,
      description: placeholderDescription,
      status: 'scripting',
      metadata: buildBaseShotMetadata(baseMetadata, imageModel, runtimeStrategy, lockedVariant, lockedCasting),
    });
  }

  return { framesToShoot, needed };
};

interface ChunkFrameBuildInput {
  descriptions: string[];
  startId: number;
  selectedFrame: Frame;
  imageModel: string;
  runtimeStrategy: ShootStrategy;
}

export const buildChunkFrames = ({
  descriptions,
  startId,
  selectedFrame,
  imageModel,
  runtimeStrategy,
}: ChunkFrameBuildInput): Frame[] => {
  const lockedVariant = selectedFrame.metadata?.variant;
  const lockedCasting = selectedFrame.metadata?.castingTraits;
  const baseMetadata = selectedFrame.metadata;

  return descriptions.map((description, index) => ({
    id: startId + index,
    description,
    status: 'pending',
    metadata: buildBaseShotMetadata(baseMetadata, imageModel, runtimeStrategy, lockedVariant, lockedCasting),
  }));
};
