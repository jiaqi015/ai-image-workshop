import React from 'react';
import { AppState } from '../../types';
import { ConsoleLog } from '../../components/ConsoleLog';
import { DirectorThinking } from '../../components/DirectorThinking';
import type { PlanningStreamSnapshot } from '../../hooks/usePlanningStream';
import type { FrameStats, StudioViewModel } from './types';

interface PlanningLeftPanelProps {
  studio: StudioViewModel;
  stream: PlanningStreamSnapshot;
  stageName: string;
  stageDesc: string;
  frameStats: FrameStats;
  renderStrategySelector: (compact?: boolean) => React.ReactNode;
  renderModelSelectors: () => React.ReactNode;
  isTaskBusy: boolean;
  activitySignalKey: string;
  className?: string;
}

export const PlanningLeftPanel: React.FC<PlanningLeftPanelProps> = ({
  studio,
  stream,
  stageName,
  stageDesc,
  frameStats,
  renderStrategySelector,
  renderModelSelectors,
  isTaskBusy,
  activitySignalKey,
  className = '',
}) => {
  const total = studio.frames.length;
  const progress = total > 0 ? Math.round((frameStats.completed / total) * 100) : 0;

  return (
    <aside className={`min-h-0 overflow-hidden ui-surface ui-reveal ${className}`.trim()}>
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <section className="ui-surface-soft p-3">
            <div className="ui-meta">当前阶段</div>
            <div className="mt-1 text-sm font-semibold" style={{ color: 'var(--ui-text-primary)' }}>{stageName}</div>
            <div className="mt-1 ui-meta">{stageDesc}</div>
          </section>

          <section className="ui-surface-soft p-3 text-[12px] space-y-2 ui-numeric" style={{ color: 'var(--ui-text-secondary)' }}>
            <div className="flex justify-between">
              <span className="ui-meta">总帧数</span>
              <span>{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="ui-meta">已完成</span>
              <span>{frameStats.completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="ui-meta">进行中</span>
              <span>{studio.activeRequests}</span>
            </div>
            <div className="flex justify-between">
              <span className="ui-meta">失败</span>
              <span>{frameStats.failed}</span>
            </div>
            <div className="flex justify-between">
              <span className="ui-meta">完成率</span>
              <span>{progress}%</span>
            </div>
          </section>

          <details className="ui-surface-soft ui-fieldset p-3">
            <summary className="cursor-pointer select-none text-[12px] flex items-center" style={{ color: 'var(--ui-text-secondary)' }}>
              质量与模型
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="ui-meta mb-1.5">产出策略</div>
                {renderStrategySelector(true)}
              </div>
              <div>
                <div className="ui-meta mb-1.5">使用引擎</div>
                {renderModelSelectors()}
              </div>
            </div>
          </details>

          <details className="ui-surface-soft ui-fieldset p-3">
            <summary className="cursor-pointer select-none text-[12px] flex items-center" style={{ color: 'var(--ui-text-secondary)' }}>
              决策依据（摘要）
            </summary>
            <div className="mt-2 max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {studio.appState === AppState.PLANNING && !studio.plan ? (
                <DirectorThinking stream={stream} />
              ) : studio.plan ? (
                <>
                  <div className="ui-surface p-2.5 rounded-md">
                    <div className="ui-meta">项目标题</div>
                    <div className="mt-1 text-xs" style={{ color: 'var(--ui-text-secondary)' }}>{studio.plan.title}</div>
                  </div>
                  {studio.plan.directorInsight && (
                    <div className="ui-surface p-2.5 rounded-md">
                      <div className="ui-meta">方向说明</div>
                      <div className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                        {studio.plan.directorInsight}
                      </div>
                    </div>
                  )}
                  {studio.plan.shootScope && (
                    <div className="ui-surface p-2.5 rounded-md">
                      <div className="ui-meta">需求约束</div>
                      <div className="mt-1 space-y-1 text-xs" style={{ color: 'var(--ui-text-secondary)' }}>
                        {(studio.plan.shootScope.nonNegotiables || []).slice(0, 4).map((item, i) => (
                          <div key={`rule-${i}`}>- {item}</div>
                        ))}
                        {(studio.plan.shootScope.flexibleElements || []).slice(0, 3).map((item, i) => (
                          <div key={`flex-${i}`} style={{ color: 'var(--ui-text-muted)' }}>
                            可调整：{item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="ui-meta">当前暂无详情。</div>
              )}
            </div>
          </details>

          <details className="ui-surface-soft ui-fieldset p-3">
            <summary className="cursor-pointer select-none text-[12px] flex items-center" style={{ color: 'var(--ui-text-secondary)' }}>
              任务日志
            </summary>
            <div className="mt-2 h-56 border rounded-[10px]" style={{ borderColor: 'var(--ui-border)' }}>
              <ConsoleLog logs={studio.logs} isBusy={isTaskBusy} activitySignalKey={activitySignalKey} />
            </div>
          </details>
        </div>
      </div>
    </aside>
  );
};
