import React, { useCallback } from 'react';
import { AppState } from '../../types';
import type {
  DirectorPacket,
  DirectorShotPacket,
  Frame,
  FrameMetadata,
  ImageModel,
  ShootPlan,
  ShootStrategy,
  TextModel,
} from '../../types';
import {
  applyMasterProfileToPlan,
  buildMasterShotList,
  generateMoreFrames,
} from '../../services/public';
import { resolveRuntimeStrategy } from '../../services/routing/policy';
import type { WorkflowEvent } from '../../domain/workflow/stateMachine';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

interface ShootingWorkflowParams {
  appState: AppState;
  plan: ShootPlan | null;
  frames: Frame[];
  selectedProposalId: number | null;
  strategy: ShootStrategy;
  masterMode: boolean;
  textModel: TextModel;
  imageModel: ImageModel;
  isShootingRef: React.MutableRefObject<boolean>;
  startTimeRef: React.MutableRefObject<number>;
  mainContentRef: React.MutableRefObject<HTMLDivElement | null>;
  retryingFrameIdsRef: React.MutableRefObject<Set<number>>;
  curationSignatureRef: React.MutableRefObject<string>;
  setSelectedConceptUrl: Setter<string | undefined>;
  setFrames: Setter<Frame[]>;
  setPlan: Setter<ShootPlan | null>;
  setIsExtending: Setter<boolean>;
  setRetryingFrameIds: Setter<number[]>;
  transitionWorkflow: (event: WorkflowEvent) => void;
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'network', latency?: number) => void;
  shootStreamBatch: (
    frames: Frame[],
    plan: ShootPlan,
    strategy: ShootStrategy,
    setFrames: Setter<Frame[]>,
    setPlan: Setter<ShootPlan | null>
  ) => Promise<void>;
}

const buildDirectorShotPacket = (
  packet: DirectorPacket | undefined,
  description: string,
  index: number,
  seed?: Partial<DirectorShotPacket>
): DirectorShotPacket => ({
  shotId: `S${String(index + 1).padStart(2, '0')}`,
  beatIndex: index + 1,
  description,
  camera: seed?.camera || 'medium',
  mood: seed?.mood || 'neutral',
  promptPack: {
    base: description,
    style: seed?.promptPack?.style || packet?.styleProfile?.visualSignature || 'Cinematic',
    variantHint: seed?.promptPack?.variantHint || packet?.styleProfile?.visualSignature || 'Cinematic',
  },
  negativePack: Array.isArray(seed?.negativePack) ? [...seed.negativePack] : [],
});

const syncPlanWithDirectorPacket = (basePlan: ShootPlan, descriptions: string[]): ShootPlan => {
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

export const useShootingWorkflow = ({
  appState,
  plan,
  frames,
  selectedProposalId,
  strategy,
  masterMode,
  textModel,
  imageModel,
  isShootingRef,
  startTimeRef,
  mainContentRef,
  retryingFrameIdsRef,
  curationSignatureRef,
  setSelectedConceptUrl,
  setFrames,
  setPlan,
  setIsExtending,
  setRetryingFrameIds,
  transitionWorkflow,
  addLog,
  shootStreamBatch,
}: ShootingWorkflowParams) => {
  const handleConfirmShoot = useCallback(async () => {
    if (!plan || selectedProposalId === null) return;
    const selectedFrame = frames.find((f) => f.id === selectedProposalId);
    if (!selectedFrame || !selectedFrame.imageUrl) return;

    isShootingRef.current = true;
    transitionWorkflow({ type: 'SHOOT_REQUESTED' });
    if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
    startTimeRef.current = Date.now();
    setSelectedConceptUrl(selectedFrame.imageUrl);

    const lockedVariant = selectedFrame.metadata?.variant;
    const lockedCasting = selectedFrame.metadata?.castingTraits;
    const runtimeStrategy = resolveRuntimeStrategy(strategy, masterMode);
    const shootPlan = masterMode ? applyMasterProfileToPlan(plan) : plan;

    addLog(`视觉基调已锁定: [${lockedVariant?.substring(0, 15)}...]。全流水线启动...`, 'info');
    if (masterMode) {
      addLog('母版锁定模式执行中：使用固定姿态库和统一风格模板。', 'network');
    }

    const TARGET_COUNT = 20;
    const packetDescriptions = (shootPlan.directorPacket?.shots || []).map((shot) => shot.description).filter(Boolean);
    const existingDescriptions = masterMode
      ? buildMasterShotList(shootPlan.continuity?.set?.environment || '', TARGET_COUNT)
      : packetDescriptions.length > 0
      ? packetDescriptions
      : shootPlan.frames || [];

    const framesToShoot: Frame[] = [];
    existingDescriptions.forEach((desc, i) => {
      framesToShoot.push({
        id: i + 1,
        description: desc,
        status: 'pending',
        metadata: {
          ...selectedFrame.metadata,
          model: imageModel,
          strategy: runtimeStrategy,
          resolution: runtimeStrategy === 'pro' ? '4K' : 'Std',
          type: 'shot' as const,
          variant: lockedVariant,
          castingTraits: lockedCasting,
          curationStatus: 'pending',
          curationScore: undefined,
          curationReason: undefined,
        },
      });
    });

    const needed = TARGET_COUNT - framesToShoot.length;
    for (let i = 0; i < needed; i++) {
      framesToShoot.push({
        id: framesToShoot.length + 1,
        description: '正在等待导演分镜指令...',
        status: 'scripting',
        metadata: {
          ...selectedFrame.metadata,
          model: imageModel,
          strategy: runtimeStrategy,
          resolution: runtimeStrategy === 'pro' ? '4K' : 'Std',
          type: 'shot' as const,
          variant: lockedVariant,
          castingTraits: lockedCasting,
          curationStatus: 'pending',
        },
      });
    }

    curationSignatureRef.current = '';
    setPlan((prev) => ({ ...shootPlan, conceptFrames: prev?.conceptFrames || shootPlan.conceptFrames, selectedConceptId: selectedFrame.id }));
    setFrames(framesToShoot);

    const initialBatch = framesToShoot.filter((f) => f.status === 'pending');
    if (initialBatch.length > 0) {
      shootStreamBatch(initialBatch, shootPlan, runtimeStrategy, setFrames, setPlan);
    }

    if (!masterMode && needed > 0) {
      const startIdx = existingDescriptions.length;
      const CHUNK_SIZE = 5;
      const onChunkReady = async (newScripts: string[], chunkIndex: number) => {
        const chunkStartGlobalIdx = startIdx + chunkIndex * CHUNK_SIZE;
        const chunkFrames: Frame[] = newScripts.map((desc, i) => {
          const realId = chunkStartGlobalIdx + i + 1;
          return {
            id: realId,
            description: desc,
            status: 'pending',
            metadata: {
              ...selectedFrame.metadata,
              model: imageModel,
              strategy: runtimeStrategy,
              resolution: runtimeStrategy === 'pro' ? '4K' : 'Std',
              type: 'shot' as const,
              variant: lockedVariant,
              castingTraits: lockedCasting,
              curationStatus: 'pending',
            },
          };
        });
        setFrames((prev) => {
          const next = [...prev];
          chunkFrames.forEach((cf) => {
            const idx = next.findIndex((f) => f.id === cf.id);
            if (idx !== -1) next[idx] = cf;
          });
          return next;
        });
        await shootStreamBatch(chunkFrames, shootPlan, runtimeStrategy, setFrames, setPlan);
      };

      try {
        addLog('[流水线] 启动并行编剧（目标 20 帧）...', 'network');
        const allDescriptions = await generateMoreFrames(
          shootPlan,
          needed,
          textModel,
          (msg) => addLog(msg, 'network'),
          lockedVariant,
          onChunkReady
        );
        const fullList = [...existingDescriptions, ...allDescriptions];
        const syncedPlan = syncPlanWithDirectorPacket(shootPlan, fullList);
        setPlan({ ...syncedPlan, conceptFrames: frames, selectedConceptId: selectedFrame.id });
        addLog('[流水线] 所有剧本分发完毕。', 'success');
      } catch (e) {
        addLog('剧本扩充遇到阻碍。', 'error');
      }
    } else {
      const syncedPlan = syncPlanWithDirectorPacket(shootPlan, existingDescriptions);
      setPlan({ ...syncedPlan, conceptFrames: frames, selectedConceptId: selectedFrame.id });
    }
  }, [
    addLog,
    curationSignatureRef,
    frames,
    imageModel,
    isShootingRef,
    mainContentRef,
    masterMode,
    plan,
    selectedProposalId,
    setFrames,
    setPlan,
    setSelectedConceptUrl,
    shootStreamBatch,
    startTimeRef,
    strategy,
    textModel,
    transitionWorkflow,
  ]);

  const handleGenerateMore = useCallback(
    async (count: number) => {
      if (!plan) return;
      setIsExtending(true);
      isShootingRef.current = true;

      const activeVariantMetadata: FrameMetadata =
        frames[0]?.metadata || { model: imageModel, provider: 'Hybrid', strategy: 'Concept', resolution: 'Std' };
      const activeStyle = activeVariantMetadata.variant;
      const runtimeStrategy = resolveRuntimeStrategy(strategy, masterMode);
      const basePlan = masterMode ? applyMasterProfileToPlan(plan) : plan;

      addLog(masterMode ? `[母版模式] 正在按姿态模板补齐 ${count} 帧...` : `[编剧部] 正在构思 ${count} 个新分镜...`, 'network');
      const startId = frames.length + 1;

      if (masterMode) {
        try {
          const deterministicDescriptions = buildMasterShotList(basePlan.continuity?.set?.environment || '', count).map(
            (desc, idx) => `${desc}, sequence take ${startId + idx}`
          );
          const newFrames: Frame[] = deterministicDescriptions.map((desc, idx) => ({
            id: startId + idx,
            description: desc,
            status: 'pending',
            metadata: {
              ...activeVariantMetadata,
              strategy: runtimeStrategy,
              resolution: '4K',
              type: 'shot' as const,
              curationStatus: 'pending',
            },
          }));
          setFrames((prev) => [...prev, ...newFrames]);
          await shootStreamBatch(newFrames, basePlan, runtimeStrategy, setFrames, setPlan);
          const existingDescriptions = (basePlan.directorPacket?.shots || []).map((shot) => shot.description).filter(Boolean);
          const fullList = [...(existingDescriptions.length ? existingDescriptions : basePlan.frames || []), ...deterministicDescriptions];
          const syncedPlan = syncPlanWithDirectorPacket(basePlan, fullList);
          setPlan(syncedPlan);
          addLog('[母版模式] 续拍任务分发完毕。', 'success');
        } catch (e) {
          console.error(e);
          addLog('[母版模式] 续拍失败。', 'error');
        } finally {
          setIsExtending(false);
        }
        return;
      }

      const CHUNK_SIZE = 5;
      const onChunkReady = async (newScripts: string[], chunkIndex: number) => {
        const chunkFrames: Frame[] = newScripts.map((desc, i) => ({
          id: startId + chunkIndex * CHUNK_SIZE + i,
          description: desc,
          status: 'pending',
          metadata: { ...activeVariantMetadata, type: 'shot' as const, curationStatus: 'pending' },
        }));
        setFrames((prev) => [...prev, ...chunkFrames]);
        await shootStreamBatch(chunkFrames, basePlan, runtimeStrategy, setFrames, setPlan);
      };

      try {
        const generatedDescriptions = await generateMoreFrames(
          basePlan,
          count,
          textModel,
          (msg) => addLog(msg, 'network'),
          activeStyle,
          onChunkReady
        );
        const existingDescriptions = (basePlan.directorPacket?.shots || []).map((shot) => shot.description).filter(Boolean);
        const baseDescriptions = existingDescriptions.length ? existingDescriptions : basePlan.frames || [];
        const fullList = [...baseDescriptions, ...generatedDescriptions];
        const syncedPlan = syncPlanWithDirectorPacket(basePlan, fullList);
        setPlan(syncedPlan);
        addLog('[编剧部] 续拍任务分发完毕。', 'success');
      } catch (e) {
        console.error(e);
      } finally {
        setIsExtending(false);
      }
    },
    [addLog, frames, imageModel, isShootingRef, masterMode, plan, setFrames, setIsExtending, setPlan, shootStreamBatch, strategy, textModel]
  );

  const handleRetryFrame = useCallback(
    async (frameId: number) => {
      if (!plan) return;
      if (retryingFrameIdsRef.current.has(frameId)) return;
      const failedFrame = frames.find((f) => f.id === frameId);
      if (!failedFrame || failedFrame.status !== 'failed') return;

      retryingFrameIdsRef.current.add(frameId);
      setRetryingFrameIds((prev) => (prev.includes(frameId) ? prev : [...prev, frameId]));

      const runtimeStrategy = resolveRuntimeStrategy(strategy, masterMode);
      const retryFrame: Frame = {
        ...failedFrame,
        status: 'pending',
        error: undefined,
        metadata: {
          ...(failedFrame.metadata || {
            model: imageModel,
            provider: 'Gateway',
            strategy,
            resolution: strategy === 'pro' ? '4K' : 'Std',
          }),
          curationStatus: 'pending',
          curationScore: undefined,
          curationReason: undefined,
        },
      };
      setFrames((prev) => prev.map((f) => (f.id === frameId ? retryFrame : f)));
      setPlan((prev) => {
        if (!prev?.conceptFrames) return prev;
        return {
          ...prev,
          conceptFrames: prev.conceptFrames.map((f) => (f.id === frameId ? retryFrame : f)),
        };
      });

      addLog(`重试帧 #${frameId}...`, 'network');
      isShootingRef.current = true;
      try {
        if (appState === AppState.CONCEPT) {
          await shootStreamBatch([retryFrame], plan, 'flash', setFrames, setPlan);
          return;
        }
        await shootStreamBatch([retryFrame], plan, runtimeStrategy, setFrames, setPlan);
      } finally {
        retryingFrameIdsRef.current.delete(frameId);
        setRetryingFrameIds((prev) => prev.filter((id) => id !== frameId));
      }
    },
    [
      addLog,
      appState,
      frames,
      imageModel,
      isShootingRef,
      masterMode,
      plan,
      retryingFrameIdsRef,
      setFrames,
      setPlan,
      setRetryingFrameIds,
      shootStreamBatch,
      strategy,
    ]
  );

  return {
    handleConfirmShoot,
    handleGenerateMore,
    handleRetryFrame,
  };
};
