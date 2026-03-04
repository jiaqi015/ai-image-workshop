import React from 'react';
import type { PlanningStreamSnapshot } from '../hooks/usePlanningStream';

interface DirectorThinkingProps {
  stream: PlanningStreamSnapshot;
}

export const DirectorThinking: React.FC<DirectorThinkingProps> = ({ stream }) => {
  const statusText = stream.currentThought || stream.displaySubThought || '正在生成候选画面';
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
  const isWarning = silentSeconds >= 18;

  return (
    <div className="w-full h-full flex items-start p-1">
      <div className="w-full ui-surface-soft px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs truncate" style={{ color: 'var(--ui-text-secondary)' }}>当前进度：{statusText}</p>
          <span className={`ui-tag ${isStalled ? 'ui-tag-muted' : isWarning ? 'ui-tag-info' : 'ui-tag-success'}`}>
            {isStalled ? '可能卡住' : isWarning ? '速度偏慢' : '处理中'}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="ui-cine-pulse h-2 w-2 rounded-full" style={{ background: isStalled ? 'var(--ui-warning)' : 'var(--ui-accent)' }} />
          <span className="ui-meta ui-numeric">最近更新：{silentSeconds} 秒前</span>
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
        <div className="mt-2 ui-meta">正在处理：{stream.preheatSteps[stream.activeStepIndex]}</div>
        <div className="mt-1 ui-meta truncate">{stream.displaySubThought || '正在补全候选内容...'}</div>
      </div>
    </div>
  );
};
