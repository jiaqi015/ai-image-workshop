import React, { useCallback } from 'react';
import { AppState } from '../../types';
import type {
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
} from '../../application/studioFacade';
import { resolveRuntimeStrategy } from '../../services/routing/policy';
import type { WorkflowEvent } from '../../domain/workflow/stateMachine';
import { buildChunkFrames, buildShootFrames, syncPlanWithDirectorPacket } from '../../domain/workflow/sessionOrchestrator';

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
  onRetryAttempt: (frameId: number, mode: 'same' | 'fallback') => void;
  shootStreamBatch: (
    frames: Frame[],
    plan: ShootPlan,
    strategy: ShootStrategy,
    setFrames: Setter<Frame[]>,
    setPlan: Setter<ShootPlan | null>
  ) => Promise<void>;
}

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
  onRetryAttempt,
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
    const runtimeStrategy = resolveRuntimeStrategy(strategy, masterMode);
    const shootPlan = masterMode ? applyMasterProfileToPlan(plan) : plan;

    addLog(`已锁定主方案，开始批量生成。`, 'info');
    if (masterMode) {
      addLog('一致性锁定已启用：将使用固定模板批量生成。', 'network');
    }

    const TARGET_COUNT = 20;
    const packetDescriptions = (shootPlan.directorPacket?.shots || []).map((shot) => shot.description).filter(Boolean);
    const existingDescriptions = masterMode
      ? buildMasterShotList(shootPlan.continuity?.set?.environment || '', TARGET_COUNT)
      : packetDescriptions.length > 0
      ? packetDescriptions
      : shootPlan.frames || [];
    const { framesToShoot, needed } = buildShootFrames({
      descriptions: existingDescriptions,
      selectedFrame,
      imageModel,
      runtimeStrategy,
      targetCount: TARGET_COUNT,
    });

    curationSignatureRef.current = '';
    const conceptFramesSnapshot = (plan?.conceptFrames && plan.conceptFrames.length > 0) ? plan.conceptFrames : frames;
    setPlan((prev) => ({
      ...shootPlan,
      conceptFrames: prev?.conceptFrames?.length ? prev.conceptFrames : conceptFramesSnapshot,
      selectedConceptId: selectedFrame.id,
    }));
    setFrames(framesToShoot);

    const initialBatch = framesToShoot.filter((f) => f.status === 'pending');
    if (initialBatch.length > 0) {
      void shootStreamBatch(initialBatch, shootPlan, runtimeStrategy, setFrames, setPlan).catch((error) => {
        const message = error instanceof Error ? error.message : '未知错误';
        addLog(`首批镜头生成失败: ${message}`, 'error');
      });
    }

    if (!masterMode && needed > 0) {
      const startIdx = existingDescriptions.length;
      const CHUNK_SIZE = 5;
      const onChunkReady = async (newScripts: string[], chunkIndex: number) => {
        const chunkStartGlobalIdx = startIdx + chunkIndex * CHUNK_SIZE;
        const chunkFrames = buildChunkFrames({
          descriptions: newScripts,
          startId: chunkStartGlobalIdx + 1,
          selectedFrame,
          imageModel,
          runtimeStrategy,
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
        addLog('[流水线] 正在补充分镜脚本（目标 20 帧）...', 'network');
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
        setPlan((prev) => ({
          ...(prev || syncedPlan),
          ...syncedPlan,
          conceptFrames: prev?.conceptFrames?.length ? prev.conceptFrames : conceptFramesSnapshot,
          selectedConceptId: selectedFrame.id,
        }));
        addLog('[流水线] 分镜脚本准备完成。', 'success');
      } catch (e) {
        addLog('分镜脚本补充失败。', 'error');
      }
    } else {
      const syncedPlan = syncPlanWithDirectorPacket(shootPlan, existingDescriptions);
      setPlan((prev) => ({
        ...(prev || syncedPlan),
        ...syncedPlan,
        conceptFrames: prev?.conceptFrames?.length ? prev.conceptFrames : conceptFramesSnapshot,
        selectedConceptId: selectedFrame.id,
      }));
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

      addLog(masterMode ? `[一致性模式] 正在追加 ${count} 帧...` : `[扩展生成] 正在追加 ${count} 个镜头...`, 'network');
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
          setPlan((prev) => ({
            ...syncedPlan,
            conceptFrames: prev?.conceptFrames || syncedPlan.conceptFrames,
            selectedConceptId: prev?.selectedConceptId ?? syncedPlan.selectedConceptId,
          }));
          addLog('[一致性模式] 追加任务已提交。', 'success');
        } catch (e) {
          console.error(e);
          const message = e instanceof Error ? e.message : '未知错误';
          addLog(`[一致性模式] 追加失败: ${message}`, 'error');
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
        setPlan((prev) => ({
          ...syncedPlan,
          conceptFrames: prev?.conceptFrames || syncedPlan.conceptFrames,
          selectedConceptId: prev?.selectedConceptId ?? syncedPlan.selectedConceptId,
        }));
        addLog('[扩展生成] 追加任务已提交。', 'success');
      } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : '未知错误';
        addLog(`[扩展生成] 追加失败: ${message}`, 'error');
      } finally {
        setIsExtending(false);
      }
    },
    [addLog, frames, imageModel, isShootingRef, masterMode, plan, setFrames, setIsExtending, setPlan, shootStreamBatch, strategy, textModel]
  );

  const handleRetryFrame = useCallback(
    async (frameId: number, mode: 'same' | 'fallback' = 'same') => {
      if (!plan) return;
      if (retryingFrameIdsRef.current.has(frameId)) return;
      const failedFrame = frames.find((f) => f.id === frameId);
      if (!failedFrame || failedFrame.status !== 'failed') return;

      retryingFrameIdsRef.current.add(frameId);
      setRetryingFrameIds((prev) => (prev.includes(frameId) ? prev : [...prev, frameId]));
      onRetryAttempt(frameId, mode);

      const fallbackTail = '保持主体与构图，简化背景层级，优先保证主体清晰。';
      const fallbackDescription = failedFrame.description.includes(fallbackTail)
        ? failedFrame.description
        : `${failedFrame.description} ${fallbackTail}`;

      const runtimeStrategy = resolveRuntimeStrategy(strategy, masterMode);
      const retryFrame: Frame = {
        ...failedFrame,
        description: mode === 'fallback' ? fallbackDescription : failedFrame.description,
        status: 'pending',
        error: undefined,
        metadata: {
          ...(failedFrame.metadata || {
            model: imageModel,
            provider: 'Gateway',
            strategy,
            resolution: strategy === 'pro' ? '4K' : 'Std',
          }),
          strategy: mode === 'fallback' ? 'flash' : failedFrame.metadata?.strategy || strategy,
          resolution: mode === 'fallback' ? 'Std' : failedFrame.metadata?.resolution || (strategy === 'pro' ? '4K' : 'Std'),
          variantType: mode === 'fallback' ? 'balanced' : failedFrame.metadata?.variantType,
          curationStatus: 'pending',
          curationScore: undefined,
          curationReason: undefined,
        },
      };
      setFrames((prev) => prev.map((f) => (f.id === frameId ? retryFrame : f)));
      setPlan((prev) => {
        if (!prev) return prev;
        const patchCollection = (collection?: Frame[]) =>
          Array.isArray(collection) ? collection.map((f) => (f.id === frameId ? retryFrame : f)) : collection;
        return {
          ...prev,
          conceptFrames: patchCollection(prev.conceptFrames),
          renderFrames: patchCollection(prev.renderFrames),
        };
      });

      addLog(mode === 'fallback' ? `第 ${frameId} 帧换参数重试中...` : `第 ${frameId} 帧同参数重试中...`, 'network');
      isShootingRef.current = true;
      try {
        if (appState === AppState.CONCEPT) {
          await shootStreamBatch([retryFrame], plan, 'flash', setFrames, setPlan);
          return;
        }
        const retryStrategy = mode === 'fallback' ? 'flash' : runtimeStrategy;
        await shootStreamBatch([retryFrame], plan, retryStrategy, setFrames, setPlan);
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
      onRetryAttempt,
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
