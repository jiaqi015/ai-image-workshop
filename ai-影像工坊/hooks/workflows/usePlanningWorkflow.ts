import React, { useCallback } from 'react';
import { AppState } from '../../types';
import type { DirectorModel, Frame, ImageModel, ShootPlan, TextModel } from '../../types';
import type { HistoryItem } from '../../components/HistorySidebar';
import {
  applyMasterProfileToPlan,
  expandParallelUniverses,
  generateMicroCasting,
  generateShootPlan,
} from '../../services/public';
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
}

const buildDraftPlan = (userInput: string): ShootPlan => ({
  title: '任务进行中',
  directorInsight: `正在解析任务：${String(userInput || '').slice(0, 120)}`,
  productionNotes: {
    lighting: '待生成',
    palette: '待生成',
    composition: '待生成',
  },
  continuity: {
    character: {
      description: '待生成',
      body: '待生成',
      details: [],
    },
    wardrobe: {
      description: '待生成',
      material: '待生成',
      accessories: [],
    },
    set: {
      environment: '待生成',
      timeOfDay: '待生成',
      atmosphere: '待生成',
    },
  },
  shootScope: {
    nonNegotiables: [],
    flexibleElements: [],
    complexityLevel: 'medium',
  },
  contract: {
    subjectIdentity: '待生成',
    wardrobe: '待生成',
    location: '待生成',
    lighting: '待生成',
    cameraLanguage: '待生成',
    texture: '待生成',
  },
  frames: [],
  visualVariants: [],
  conceptFrames: [],
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
}: PlanningWorkflowParams) => {
  const handleStartPlanning = useCallback(
    async (options?: { conceptCount?: number }) => {
      if (!userInput.trim() || appState !== AppState.IDLE) return;
      const conceptCount = Math.max(4, Math.min(12, Math.floor(options?.conceptCount || 4)));

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
      let activeHistoryId: string | null = null;

      try {
        const draftPlan = buildDraftPlan(userInput);
        const draftId = await addToHistory(draftPlan, userInput, { taskStatus: 'planning' });
        activeHistoryId = draftId || null;
        if (activeHistoryId) {
          setCurrentHistoryId(activeHistoryId);
        }

        if (!keyConfigured) {
          addLog('检测到网关状态异常，请先检查后端配置。', 'network');
        }
        addLog(`已收到任务（文本模型：${directorModel}），开始生成候选方案...`, 'info');

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

        const planForExecution = masterMode ? applyMasterProfileToPlan(generatedPlan) : generatedPlan;
        if (masterMode) {
          addLog('已启用一致性锁定：角色、风格与姿态将保持一致。', 'network');
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
        addLog(`候选方案已生成，请从 ${conceptCount} 个方案中选择主方案。`, 'success');
        await executeFrameBatch(proposalFrames, planForExecution, 'flash', setFrames, setPlan);
      } catch (e: any) {
        if (e.message !== 'Aborted') {
          if (activeHistoryId) {
            await updateHistoryItem(activeHistoryId, null, { taskStatus: 'failed' });
          }
          addLog(`方案生成失败: ${e.message}`, 'error');
          transitionWorkflow({ type: 'PLAN_FAILED' });
        } else {
          addLog('任务已取消', 'info');
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
    ]
  );

  const handleExpandUniverse = useCallback(async () => {
    if (!plan) return;
    if (!canExpandConceptUniverse(masterMode)) {
      addLog('一致性锁定已开启，暂不支持追加随机方案。', 'info');
      return;
    }

    setIsExpandingUniverse(true);
    isShootingRef.current = true;
    addLog('正在追加候选方案...', 'info');
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
      addLog('追加方案完成。', 'success');
    } catch (e: any) {
      addLog(`追加方案失败: ${e.message}`, 'error');
    } finally {
      setIsExpandingUniverse(false);
    }
  }, [addLog, executeFrameBatch, frames.length, imageModel, isShootingRef, masterMode, plan, setFrames, setIsExpandingUniverse, setPlan, textModel]);

  return {
    handleStartPlanning,
    handleExpandUniverse,
  };
};
