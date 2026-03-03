import React from 'react';
import type { PlanningStreamSnapshot } from '../hooks/usePlanningStream';

interface PlanningStagePreloadProps {
  textModel: string;
  imageModel: string;
  stream: PlanningStreamSnapshot;
}

export const PlanningStagePreload: React.FC<PlanningStagePreloadProps> = ({
  textModel,
  imageModel,
  stream,
}) => {
  const progress = stream.stageProgress;
  const statusText = stream.currentThought || stream.displaySubThought || '正在构思';
  const activeStep = stream.preheatSteps[stream.activeStepIndex];

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0c0c0f] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-300 truncate">导演处理中：{statusText}</div>
          <div className="text-xs font-mono text-zinc-500">{progress}%</div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 text-[11px] text-zinc-500">当前步骤：{activeStep}</div>
        <div className="mt-1 text-[10px] text-zinc-600">
          文本模型 <span className="font-mono text-zinc-400">{textModel}</span>
          <span className="mx-2 text-zinc-700">|</span>
          生图模型 <span className="font-mono text-zinc-400">{imageModel}</span>
        </div>
      </div>
    </div>
  );
};
