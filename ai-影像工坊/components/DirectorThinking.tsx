import React from 'react';
import type { PlanningStreamSnapshot } from '../hooks/usePlanningStream';

interface DirectorThinkingProps {
  stream: PlanningStreamSnapshot;
}

export const DirectorThinking: React.FC<DirectorThinkingProps> = ({ stream }) => {
  const statusText = stream.currentThought || stream.displaySubThought || '正在生成方案';

  return (
    <div className="w-full h-full flex items-start p-4">
      <div className="w-full ui-surface-soft px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-300 truncate">系统处理中：{statusText}</p>
          <span className="text-xs font-mono text-zinc-500">{stream.streamProgress}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-zinc-200 transition-all duration-300" style={{ width: `${stream.streamProgress}%` }} />
        </div>
        <div className="mt-2 ui-meta">当前步骤：{stream.preheatSteps[stream.activeStepIndex]}</div>
        <div className="mt-1 ui-meta font-mono">生成字数：{stream.charCount}</div>
        <div className="mt-1 ui-meta truncate">{stream.displaySubThought}</div>
      </div>
    </div>
  );
};
