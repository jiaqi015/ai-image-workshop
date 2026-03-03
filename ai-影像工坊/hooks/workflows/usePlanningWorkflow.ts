import React, { useCallback } from 'react';
import { AppState } from '../../types';
import type { DirectorModel, Frame, ImageModel, ShootPlan, TextModel } from '../../types';
import {
  applyMasterProfileToPlan,
  expandParallelUniverses,
  generateMicroCasting,
  generateShootPlan,
} from '../../services/public';
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
  addToHistory: (plan: ShootPlan, userInput: string) => Promise<string | null | undefined>;
  executeFrameBatch: (
    framesToProcess: Frame[],
    currentPlan: ShootPlan,
    currentStrategy: 'pro' | 'flash' | 'hybrid',
    setFrames: Setter<Frame[]>,
    setPlan: Setter<ShootPlan | null>
  ) => Promise<void>;
}

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

      try {
        if (!keyConfigured) {
          addLog('检测到网关状态异常，请优先修复后端配置。', 'network');
        }
        addLog(`接收到导演指令（文本模型：${directorModel}），正在构建平行宇宙...`, 'info');

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
          addLog('已启用母版锁定：身份、风格、姿态模板已固定。', 'network');
        }

        let variants = planForExecution.visualVariants || [];
        if (variants.length < conceptCount) {
          variants = [...variants, ...Array(conceptCount - variants.length).fill('标准视觉方案 - 选角: 默认')];
        }

        const strictBound = Math.max(1, Math.floor(conceptCount / 3));
        const balancedBound = Math.max(strictBound + 1, Math.floor((conceptCount * 2) / 3));
        const proposalFrames: Frame[] = variants.slice(0, conceptCount).map((variantDesc, index) => {
          let vType: 'strict' | 'balanced' | 'creative' = 'balanced';
          if (index < strictBound) vType = 'strict';
          else if (index < balancedBound) vType = 'balanced';
          else vType = 'creative';
          const microCasting = planForExecution.continuity?.character?.details?.join('、') || generateMicroCasting();
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
              variantType: vType,
              type: 'reference',
              castingTraits: microCasting,
              curationStatus: 'pending',
            },
          };
        });

        planForExecution.conceptFrames = proposalFrames;
        setPlan(planForExecution);
        setFrames(proposalFrames);
        transitionWorkflow({ type: 'PLAN_READY' });
        const historyId = await addToHistory(planForExecution, userInput);
        setCurrentHistoryId(historyId || null);
        addLog(`平行宇宙构建完成。请导演检视 ${conceptCount} 种可能方案。`, 'success');
        await executeFrameBatch(proposalFrames, planForExecution, 'flash', setFrames, setPlan);
      } catch (e: any) {
        if (e.message !== 'Aborted') {
          addLog(`剧本解析受阻: ${e.message}`, 'error');
          transitionWorkflow({ type: 'PLAN_FAILED' });
        } else {
          addLog('任务已中断', 'info');
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
      userInput,
    ]
  );

  const handleExpandUniverse = useCallback(async () => {
    if (!plan) return;
    if (!canExpandConceptUniverse(masterMode)) {
      addLog('母版锁定模式已开启：不建议继续追加随机方案。', 'info');
      return;
    }

    setIsExpandingUniverse(true);
    isShootingRef.current = true;
    addLog('正在探测新的平行时空...', 'info');
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
      addLog('新时空探测完毕。', 'success');
    } catch (e: any) {
      addLog(`时空探测失败: ${e.message}`, 'error');
    } finally {
      setIsExpandingUniverse(false);
    }
  }, [addLog, executeFrameBatch, frames.length, imageModel, isShootingRef, masterMode, plan, setFrames, setIsExpandingUniverse, setPlan, textModel]);

  return {
    handleStartPlanning,
    handleExpandUniverse,
  };
};
