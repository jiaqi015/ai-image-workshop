import React, { useCallback } from 'react';
import { AppState } from '../../types';
import type { DirectorModel, Frame, ImageModel, ShootPlan, TextModel } from '../../types';
import type { HistoryItem } from '../../components/HistorySidebar';
import {
  applyMasterProfileToPlan,
  expandParallelUniverses,
  generateMicroCasting,
  generateShootPlan,
} from '../../application/studioFacade';
import { buildConceptProposalFrames } from '../../domain/workflow/sessionOrchestrator';
import { canExpandConceptUniverse } from '../../services/routing/policy';
import type { WorkflowEvent } from '../../domain/workflow/stateMachine';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

interface PlanningWorkflowParams {
  appState: AppState;
  userInput: string;
  keyConfigured: boolean;
  directorModel: DirectorModel;
  textModel: TextModel;
  imageModel: ImageModel;
  masterMode: boolean;
  plan: ShootPlan | null;
  frames: Frame[];
  isShootingRef: React.MutableRefObject<boolean>;
  planningAbortController: React.MutableRefObject<AbortController | null>;
  setStreamingPlanText: Setter<string>;
  setFrames: Setter<Frame[]>;
  setLogs: Setter<any[]>;
  setSelectedConceptUrl: Setter<string | undefined>;
  setElapsedTime: Setter<number>;
  setSelectedProposalId: Setter<number | null>;
  setCurrentHistoryId: Setter<string | null>;
  setPlan: Setter<ShootPlan | null>;
  setIsExpandingUniverse: Setter<boolean>;
  transitionWorkflow: (event: WorkflowEvent) => void;
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'network', latency?: number) => void;
  addToHistory: (plan: ShootPlan, userInput: string, patch?: Partial<HistoryItem>) => Promise<string | null | undefined>;
  updateHistoryItem: (timestampId: string, updatedFrames?: Frame[] | null, patch?: Partial<HistoryItem>) => Promise<void>;
  executeFrameBatch: (
    framesToProcess: Frame[],
    currentPlan: ShootPlan,
    currentStrategy: 'pro' | 'flash' | 'hybrid',
    setFrames: Setter<Frame[]>,
    setPlan: Setter<ShootPlan | null>
  ) => Promise<void>;
  shootStreamBatch: (
    frames: Frame[],
    plan: ShootPlan,
    strategy: 'pro' | 'flash' | 'hybrid',
    setFrames: Setter<Frame[]>,
    setPlan: Setter<ShootPlan | null>
  ) => Promise<void>;
  setRewritingFrameIds: Setter<number[]>;
  setExpandingFromProposalId: Setter<number | null>;
  onTaskStarted: () => void;
}

const buildDraftPlan = (userInput: string): ShootPlan => ({
  title: '正在准备方案',
  directorInsight: `正在理解你的需求：${String(userInput || '').slice(0, 120)}`,
  productionNotes: {
    lighting: '整理中',
    palette: '整理中',
    composition: '整理中',
  },
  continuity: {
    character: {
      description: '整理中',
      body: '整理中',
      details: [],
    },
    wardrobe: {
      description: '整理中',
      material: '整理中',
      accessories: [],
    },
    set: {
      environment: '整理中',
      timeOfDay: '整理中',
      atmosphere: '整理中',
    },
  },
  shootScope: {
    nonNegotiables: [],
    flexibleElements: [],
    complexityLevel: 'medium',
  },
  contract: {
    subjectIdentity: '整理中',
    wardrobe: '整理中',
    location: '整理中',
    lighting: '整理中',
    cameraLanguage: '整理中',
    texture: '整理中',
  },
  frames: [],
  visualVariants: [],
  conceptFrames: [],
});

const waitWithAbort = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = window.setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(new Error('Aborted'));
    };
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });

export const usePlanningWorkflow = ({
  appState,
  userInput,
  keyConfigured,
  directorModel,
  textModel,
  imageModel,
  masterMode,
  plan,
  frames,
  isShootingRef,
  planningAbortController,
  setStreamingPlanText,
  setFrames,
  setLogs,
  setSelectedConceptUrl,
  setElapsedTime,
  setSelectedProposalId,
  setCurrentHistoryId,
  setPlan,
  setIsExpandingUniverse,
  transitionWorkflow,
  addLog,
  addToHistory,
  updateHistoryItem,
  executeFrameBatch,
  shootStreamBatch,
  setRewritingFrameIds,
  setExpandingFromProposalId,
  onTaskStarted,
}: PlanningWorkflowParams) => {
  const handleStartPlanning = useCallback(
    async (options?: { conceptCount?: number }) => {
      if (!userInput.trim() || appState !== AppState.IDLE) return;
      const conceptCount = Math.max(4, Math.min(12, Math.floor(options?.conceptCount || 4)));
      const planningStartedAt = Date.now();

      if (planningAbortController.current) planningAbortController.current.abort();
      planningAbortController.current = new AbortController();
      const signal = planningAbortController.current.signal;

      isShootingRef.current = true;
      transitionWorkflow({ type: 'PLAN_REQUESTED' });
      setStreamingPlanText('');
      setFrames([]);
      setLogs([]);
      setSelectedConceptUrl(undefined);
      setElapsedTime(0);
      setSelectedProposalId(null);
      setCurrentHistoryId(null);
      onTaskStarted();
      let activeHistoryId: string | null = null;

      try {
        addLog('已收到你的需求，正在整理可落地方案。', 'info');
        const draftPlan = buildDraftPlan(userInput);
        const draftId = await addToHistory(draftPlan, userInput, { taskStatus: 'planning' });
        activeHistoryId = draftId || null;
        if (activeHistoryId) {
          setCurrentHistoryId(activeHistoryId);
        }

        if (!keyConfigured) {
          addLog('连接状态异常，请先检查后端配置。', 'network');
        }
        addLog(`开始生成候选画面（文本模型：${directorModel}）...`, 'info');

        const generatedPlan = await generateShootPlan(
          userInput,
          (text) => {
            if (isShootingRef.current) setStreamingPlanText(text);
          },
          directorModel,
          'dramatic',
          signal
        );
        if (!isShootingRef.current || signal.aborted) return;

        const MIN_PLANNING_DISPLAY_MS = 3200;
        const elapsedMs = Date.now() - planningStartedAt;
        if (elapsedMs < MIN_PLANNING_DISPLAY_MS) {
          addLog('正在做风格一致性检查...', 'network');
          await waitWithAbort(MIN_PLANNING_DISPLAY_MS - elapsedMs, signal);
          if (!isShootingRef.current || signal.aborted) return;
        }

        const planForExecution = masterMode ? applyMasterProfileToPlan(generatedPlan) : generatedPlan;
        if (masterMode) {
          addLog('已启用风格锁定：角色与画面语言将保持一致。', 'network');
        }
        const microCasting = planForExecution.continuity?.character?.details?.join('、') || generateMicroCasting();
        const proposalFrames = buildConceptProposalFrames(planForExecution, conceptCount, imageModel, microCasting);

        planForExecution.conceptFrames = proposalFrames;
        setPlan(planForExecution);
        setFrames(proposalFrames);
        transitionWorkflow({ type: 'PLAN_READY' });
        if (activeHistoryId) {
          await updateHistoryItem(activeHistoryId, proposalFrames, { plan: planForExecution, taskStatus: 'concept' });
          setCurrentHistoryId(activeHistoryId);
        } else {
          const historyId = await addToHistory(planForExecution, userInput, { taskStatus: 'concept' });
          setCurrentHistoryId(historyId || null);
        }
        addLog(`候选画面已就绪，请从 ${conceptCount} 组里选一组主方案。`, 'success');
        await executeFrameBatch(proposalFrames, planForExecution, 'flash', setFrames, setPlan);
      } catch (e: any) {
        if (e.message !== 'Aborted') {
          if (activeHistoryId) {
            await updateHistoryItem(activeHistoryId, null, { taskStatus: 'failed' });
          }
          addLog(`候选画面生成失败: ${e.message}`, 'error');
          transitionWorkflow({ type: 'PLAN_FAILED' });
        } else {
          addLog('已取消本次创作', 'info');
        }
      }
    },
    [
      addLog,
      addToHistory,
      appState,
      directorModel,
      executeFrameBatch,
      imageModel,
      isShootingRef,
      keyConfigured,
      masterMode,
      planningAbortController,
      setCurrentHistoryId,
      setElapsedTime,
      setFrames,
      setLogs,
      setPlan,
      setSelectedConceptUrl,
      setSelectedProposalId,
      setStreamingPlanText,
      transitionWorkflow,
      updateHistoryItem,
      userInput,
      onTaskStarted,
    ]
  );

  const handleExpandUniverse = useCallback(async () => {
    if (!plan) return;
    if (!canExpandConceptUniverse(masterMode)) {
      addLog('风格锁定已开启，暂不支持追加随机方案。', 'info');
      return;
    }

    setIsExpandingUniverse(true);
    isShootingRef.current = true;
    addLog('正在追加候选画面...', 'info');
    try {
      const newVariants = await expandParallelUniverses(plan, 6, textModel);
      const startIdx = frames.length;
      const newFrames: Frame[] = newVariants.map((desc, i) => ({
        id: -1 - (startIdx + i),
        description: desc,
        status: 'pending',
        metadata: {
          model: imageModel,
          provider: 'Hybrid',
          strategy: 'Concept',
          resolution: 'Std',
          variant: desc,
          variantType: 'creative',
          type: 'reference',
        },
      }));

      setFrames((prev) => [...prev, ...newFrames]);
      setPlan((prev) => (prev ? { ...prev, conceptFrames: [...(prev.conceptFrames || []), ...newFrames] } : null));
      await executeFrameBatch(newFrames, plan, 'flash', setFrames, setPlan);
      addLog('追加完成。', 'success');
    } catch (e: any) {
      addLog(`追加失败: ${e.message}`, 'error');
    } finally {
      setIsExpandingUniverse(false);
    }
  }, [addLog, executeFrameBatch, frames.length, imageModel, isShootingRef, masterMode, plan, setFrames, setIsExpandingUniverse, setPlan, textModel]);

  const handleRewriteProposal = useCallback(
    async (frameId: number) => {
      if (!plan || appState !== AppState.CONCEPT) return;
      const target = frames.find((frame) => frame.id === frameId);
      if (!target) return;

      setRewritingFrameIds((prev) => (prev.includes(frameId) ? prev : [...prev, frameId]));
      addLog(`候选 ${frameId} 正在改写描述并重新生成...`, 'network');

      try {
        const rewrites = await expandParallelUniverses(plan, 1, textModel);
        const rewrittenDesc = String(rewrites?.[0] || target.description).trim();
        const rewrittenFrame: Frame = {
          ...target,
          description: rewrittenDesc,
          status: 'pending',
          error: undefined,
          metadata: {
            ...(target.metadata || {
              model: imageModel,
              provider: 'Gateway',
              strategy: 'Concept',
              resolution: 'Std',
            }),
            variant: rewrittenDesc,
            variantType: target.metadata?.variantType || 'balanced',
            type: 'reference',
          },
        };

        setFrames((prev) => prev.map((frame) => (frame.id === frameId ? rewrittenFrame : frame)));
        setPlan((prev) =>
          prev
            ? {
                ...prev,
                conceptFrames: (prev.conceptFrames || []).map((frame) => (frame.id === frameId ? rewrittenFrame : frame)),
              }
            : prev
        );
        await shootStreamBatch([rewrittenFrame], plan, 'flash', setFrames, setPlan);
        addLog(`候选 ${frameId} 改写完成。`, 'success');
      } catch (error: any) {
        const message = error?.message || '未知错误';
        addLog(`候选 ${frameId} 改写失败: ${message}`, 'error');
      } finally {
        setRewritingFrameIds((prev) => prev.filter((id) => id !== frameId));
      }
    },
    [addLog, appState, frames, imageModel, plan, setFrames, setPlan, setRewritingFrameIds, shootStreamBatch, textModel]
  );

  const handleGenerateRelatedProposals = useCallback(
    async (frameId: number, count = 4) => {
      if (!plan || appState !== AppState.CONCEPT) return;
      const seed = frames.find((frame) => frame.id === frameId);
      if (!seed) return;

      setExpandingFromProposalId(frameId);
      setIsExpandingUniverse(true);
      addLog(`基于候选 ${frameId} 正在追加 ${count} 组相近画面...`, 'network');

      try {
        const variants = await expandParallelUniverses(plan, count, textModel);
        const minId = frames.reduce((min, frame) => Math.min(min, frame.id), 0);
        const startId = minId <= 0 ? minId - 1 : -1;
        const seedVariant = seed.metadata?.variant || seed.description;
        const newFrames: Frame[] = variants.map((desc, index) => ({
          id: startId - index,
          description: desc,
          status: 'pending',
          metadata: {
            model: imageModel,
            provider: 'Hybrid',
            strategy: 'Concept',
            resolution: 'Std',
            variant: `${desc} | 延展基线: ${seedVariant}`,
            variantType: 'creative',
            type: 'reference',
          },
        }));

        setFrames((prev) => [...prev, ...newFrames]);
        setPlan((prev) => (prev ? { ...prev, conceptFrames: [...(prev.conceptFrames || []), ...newFrames] } : null));
        await shootStreamBatch(newFrames, plan, 'flash', setFrames, setPlan);
        addLog(`候选 ${frameId} 的延展画面已生成。`, 'success');
      } catch (error: any) {
        const message = error?.message || '未知错误';
        addLog(`延展失败: ${message}`, 'error');
      } finally {
        setIsExpandingUniverse(false);
        setExpandingFromProposalId(null);
      }
    },
    [
      addLog,
      appState,
      frames,
      imageModel,
      plan,
      setExpandingFromProposalId,
      setFrames,
      setIsExpandingUniverse,
      setPlan,
      shootStreamBatch,
      textModel,
    ]
  );

  return {
    handleStartPlanning,
    handleExpandUniverse,
    handleRewriteProposal,
    handleGenerateRelatedProposals,
  };
};
