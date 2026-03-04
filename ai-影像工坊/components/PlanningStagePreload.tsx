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
  const CONTACT_SHEET = [0, 1, 2, 3];
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
    <div className="h-full w-full flex items-start justify-center p-2.5 md:p-4">
      <div className="w-full max-w-[1100px] ui-surface p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] tracking-[0.16em]" style={{ color: 'var(--ui-text-muted)' }}>
            联系表预览
          </div>
          <span className={liveStateClass}>{liveStateText}</span>
        </div>

        <div className="mt-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_236px] gap-3">
          <div
            className="relative overflow-hidden rounded-[11px] border p-3 md:p-4"
            style={{
              borderColor: 'var(--ui-border)',
              background: 'linear-gradient(180deg, rgba(26,27,30,0.96), rgba(15,16,18,0.98))',
            }}
          >
            <div className="ui-cine-grain absolute inset-0 pointer-events-none" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CONTACT_SHEET.map((id) => (
                <div
                  key={id}
                  className="relative h-24 sm:h-28 lg:h-32 overflow-hidden rounded-[8px] border"
                  style={{ borderColor: 'rgba(255, 255, 255, 0.16)', background: 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(217,205,184,0.08), rgba(255,255,255,0.02))' }} />
                  <div className="ui-cine-sweep absolute inset-0 pointer-events-none" />
                  <div className="absolute left-2 top-2 text-[9px] font-mono ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
                    #{String(id + 1).padStart(2, '0')}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-xs truncate" style={{ color: 'var(--ui-text-secondary)' }}>
                  {statusText}
                </div>
                <div className="mt-1 ui-meta">当前步骤：{activeStep}</div>
              </div>
              <div className="text-[11px] font-mono ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
                {progress}%
              </div>
            </div>
          </div>

          <div className="ui-surface-soft p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <span className="ui-cine-pulse h-2 w-2 rounded-full" style={{ background: isStalled ? 'var(--ui-warning)' : 'var(--ui-accent)' }} />
              <span className="ui-meta ui-numeric">最近更新：{silentSeconds} 秒前</span>
            </div>

            <div className="space-y-1.5">
              {stream.preheatSteps.map((step, index) => {
                const active = index === stream.activeStepIndex;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: active ? 'var(--ui-accent)' : 'rgba(255,255,255,0.22)' }}
                    />
                    <span className="text-[11px]" style={{ color: active ? 'var(--ui-text-primary)' : 'var(--ui-text-muted)' }}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-1.5 border-t space-y-1" style={{ borderColor: 'var(--ui-border)' }}>
              <div className="ui-meta">
                文本模型：<span className="font-mono" style={{ color: 'var(--ui-text-secondary)' }}>{textModel}</span>
              </div>
              <div className="ui-meta">
                图像模型：<span className="font-mono" style={{ color: 'var(--ui-text-secondary)' }}>{imageModel}</span>
              </div>
            </div>

            {isStalled && (
              <div className="pt-1.5 space-y-2">
                <div className="text-[11px]" style={{ color: 'var(--ui-text-secondary)' }}>
                  已超过 40 秒无新内容，建议重新发起。
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
