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
  const statusText = stream.currentThought || stream.displaySubThought || '正在生成方案';
  const activeStep = stream.preheatSteps[stream.activeStepIndex];

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="w-full ui-hero ui-surface px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm truncate" style={{ color: 'var(--ui-text-secondary)' }}>系统处理中：{statusText}</div>
          <div className="text-xs font-mono" style={{ color: 'var(--ui-text-muted)' }}>{progress}%</div>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#edf1f5' }}>
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: 'var(--ui-accent)' }} />
        </div>
        <div className="mt-2 ui-meta">当前步骤：{activeStep}</div>
        <div className="mt-1 ui-meta">
          文本模型 <span className="font-mono" style={{ color: 'var(--ui-text-secondary)' }}>{textModel}</span>
          <span className="mx-2">|</span>
          图像模型 <span className="font-mono" style={{ color: 'var(--ui-text-secondary)' }}>{imageModel}</span>
        </div>
      </div>
    </div>
  );
};
