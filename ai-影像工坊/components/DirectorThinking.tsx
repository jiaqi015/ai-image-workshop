import React from 'react';
import type { PlanningStreamSnapshot } from '../hooks/usePlanningStream';

interface DirectorThinkingProps {
  stream: PlanningStreamSnapshot;
}

export const DirectorThinking: React.FC<DirectorThinkingProps> = ({ stream }) => {
  const statusText = stream.currentThought || stream.displaySubThought || '正在生成方案';
  const pulseKey = `${stream.charCount}|${stream.activeStepIndex}|${stream.currentThought}|${stream.displaySubThought}`;
  const [lastPulseAt, setLastPulseAt] = React.useState(() => Date.now());
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const now = Date.now();
    setLastPulseAt(now);
    setNowMs(now);
  }, [pulseKey]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const silentSeconds = Math.max(0, Math.floor((nowMs - lastPulseAt) / 1000));
  const isStalled = silentSeconds >= 40;

  return (
    <div className="w-full h-full flex items-start p-1">
      <div className="w-full ui-surface-soft px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs truncate" style={{ color: 'var(--ui-text-secondary)' }}>暗房状态：{statusText}</p>
          <span className={`ui-tag ${isStalled ? 'ui-tag-muted' : 'ui-tag-success'}`}>
            {isStalled ? '可能卡住' : '处理中'}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          {stream.preheatSteps.map((step, index) => {
            const active = index === stream.activeStepIndex;
            return (
              <span
                key={step}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: active ? 'var(--ui-accent)' : 'rgba(255, 255, 255, 0.12)' }}
              />
            );
          })}
        </div>
        <div className="mt-2 ui-meta">当前步骤：{stream.preheatSteps[stream.activeStepIndex]}</div>
        <div className="mt-1 ui-meta ui-numeric">最近更新：{silentSeconds} 秒前</div>
        <div className="mt-1 ui-meta truncate">{stream.displaySubThought || '正在补全候选内容...'}</div>
      </div>
    </div>
  );
};
