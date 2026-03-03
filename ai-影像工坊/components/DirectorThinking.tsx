import React from 'react';
import type { PlanningStreamSnapshot } from '../hooks/usePlanningStream';

interface DirectorThinkingProps {
  stream: PlanningStreamSnapshot;
}

export const DirectorThinking: React.FC<DirectorThinkingProps> = ({ stream }) => {
  const statusText = stream.currentThought || stream.displaySubThought || '正在构思';

  return (
    <div className="w-full h-full flex items-start p-4">
      <div className="w-full rounded-lg border border-white/10 bg-black/25 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-300 truncate">导演处理中：{statusText}</p>
          <span className="text-xs font-mono text-zinc-500">{stream.streamProgress}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${stream.streamProgress}%` }} />
        </div>
        <div className="mt-2 text-[11px] text-zinc-500">当前步骤：{stream.preheatSteps[stream.activeStepIndex]}</div>
        <div className="mt-1 text-[10px] text-zinc-600 font-mono">流式字符：{stream.charCount}</div>
        <div className="mt-1 text-[10px] text-zinc-600 truncate">{stream.displaySubThought}</div>
      </div>
    </div>
  );
};
