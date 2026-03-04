import React from 'react';
import type { PlanningStreamSnapshot } from '../hooks/usePlanningStream';

interface PlanningStagePreloadProps {
  textModel: string;
  imageModel: string;
  stream: PlanningStreamSnapshot;
  onReset?: () => void;
}

export const PlanningStagePreload: React.FC<PlanningStagePreloadProps> = ({
  textModel,
  imageModel,
  stream,
  onReset,
}) => {
  const progress = stream.stageProgress;
  const statusText = stream.currentThought || stream.displaySubThought || '正在生成方案';
  const activeStep = stream.preheatSteps[stream.activeStepIndex];
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
  const isWarning = silentSeconds >= 18;
  const isStalled = silentSeconds >= 40;
  const liveStateText = isStalled ? '可能卡住' : isWarning ? '处理中偏慢' : '实时处理中';
  const liveStateClass = isStalled ? 'ui-tag ui-tag-muted' : isWarning ? 'ui-tag ui-tag-info' : 'ui-tag ui-tag-success';

  return (
    <div className="h-full w-full flex items-center justify-center p-3 md:p-4">
      <div className="w-full ui-surface p-3.5 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="ui-meta tracking-[0.16em]" style={{ color: 'var(--ui-text-muted)' }}>
            暗房处理中
          </div>
          <span className={liveStateClass}>{liveStateText}</span>
        </div>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_252px] gap-3">
          <div
            className="relative aspect-[16/10] overflow-hidden rounded-[10px] border"
            style={{
              borderColor: 'var(--ui-border)',
              background:
                'radial-gradient(120% 100% at 50% 0%, rgba(217,205,184,0.14), rgba(18,19,22,0.96) 60%), linear-gradient(180deg, rgba(16,17,20,0.9), rgba(12,13,15,0.98))',
            }}
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 3px)',
              }}
            />
            <div className="absolute left-4 right-4 top-4 bottom-4 border" style={{ borderColor: 'rgba(255,255,255,0.14)' }} />
            <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2" style={{ background: 'rgba(255,255,255,0.12)' }} />
            <div className="absolute top-1/2 left-4 right-4 h-px -translate-y-1/2" style={{ background: 'rgba(255,255,255,0.12)' }} />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(255,255,255,0.24)' }} />
                <div className="absolute inset-[4px] rounded-full border-2 border-transparent border-t-[var(--ui-accent)] border-r-[var(--ui-accent)] animate-spin" />
                <div className="absolute inset-[18px] rounded-full" style={{ background: 'rgba(217,205,184,0.22)' }} />
              </div>
            </div>

            <div className="absolute left-3 bottom-3 right-3">
              <div className="text-xs truncate" style={{ color: 'var(--ui-text-secondary)' }}>
                {statusText}
              </div>
              <div className="mt-1 ui-meta">当前步骤：{activeStep}</div>
            </div>
          </div>

          <div className="ui-surface-soft p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="ui-meta">流程进度</div>
              <div className="text-xs font-mono ui-numeric" style={{ color: 'var(--ui-text-secondary)' }}>
                {progress}%
              </div>
            </div>
            <div className="space-y-1.5">
              {stream.preheatSteps.map((step, index) => {
                const active = index === stream.activeStepIndex;
                return (
                  <div
                    key={step}
                    className="flex items-center gap-2 rounded px-2 py-1"
                    style={{
                      background: active ? 'rgba(217,205,184,0.12)' : 'rgba(255,255,255,0.02)',
                      color: active ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: active ? 'var(--ui-accent)' : 'rgba(255,255,255,0.22)' }}
                    />
                    <span className="text-[11px]">{step}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-1.5 border-t space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="ui-meta">
                最近更新：<span className="ui-numeric">{silentSeconds} 秒前</span>
              </div>
              <div className="ui-meta">
                文本模型：<span className="font-mono" style={{ color: 'var(--ui-text-secondary)' }}>{textModel}</span>
              </div>
              <div className="ui-meta">
                图像模型：<span className="font-mono" style={{ color: 'var(--ui-text-secondary)' }}>{imageModel}</span>
              </div>
            </div>
            {isStalled && (
              <div className="pt-2 space-y-2">
                <div className="text-[11px]" style={{ color: 'var(--ui-text-secondary)' }}>
                  超过 40 秒无新内容，可能已卡住。可直接重发任务。
                </div>
                {onReset && (
                  <button type="button" onClick={onReset} className="w-full ui-btn-secondary ui-btn-compact">
                    重新发起任务
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
