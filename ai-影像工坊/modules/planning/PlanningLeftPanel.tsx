import React from 'react';
import { AppState } from '../../types';
import { ConsoleLog } from '../../components/ConsoleLog';
import { ContractCard } from '../../components/ContractCard';
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
    <aside className={`min-h-0 overflow-hidden ui-surface ${className}`.trim()}>
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          <section className="ui-surface-soft p-3">
            <div className="ui-meta">当前状态</div>
            <div className="mt-1 text-sm text-zinc-100">{stageName}</div>
            <div className="mt-1 ui-meta">{stageDesc}</div>
          </section>

          <section className="ui-surface-soft p-3 text-[11px] text-zinc-300 space-y-2">
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

          <details className="ui-surface-soft p-3">
            <summary className="cursor-pointer select-none text-[11px] text-zinc-300">模式与模型</summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="ui-meta mb-1.5">生成模式</div>
                {renderStrategySelector(true)}
              </div>
              <div>
                <div className="ui-meta mb-1.5">模型配置</div>
                {renderModelSelectors()}
              </div>
            </div>
          </details>

          <details className="ui-surface-soft p-3">
            <summary className="cursor-pointer select-none text-[11px] text-zinc-300">项目详情</summary>
            <div className="mt-3 max-h-[360px] overflow-y-auto pr-1">
              {studio.appState === AppState.PLANNING && !studio.plan ? (
                <DirectorThinking stream={stream} />
              ) : studio.plan ? (
                <ContractCard
                  contract={studio.plan.contract}
                  title={studio.plan.title}
                  directorInsight={studio.plan.directorInsight}
                  productionNotes={studio.plan.productionNotes}
                  shootGuide={studio.plan.shootGuide}
                  shootScope={studio.plan.shootScope}
                  directorPacket={studio.plan.directorPacket}
                  continuity={studio.plan.continuity}
                  conceptFrames={studio.plan.conceptFrames}
                  selectedConceptId={studio.plan.selectedConceptId}
                  visualReferenceImageUrl={studio.selectedConceptUrl}
                  onSelectConcept={studio.handleSelectSidebarConcept}
                  onGenerateMore={() => studio.handleGenerateMore(20)}
                  isExtending={studio.isExtending}
                  onPreviewConcept={(url) => studio.setConceptPreviewUrl(url)}
                />
              ) : (
                <div className="ui-meta">当前暂无详情。</div>
              )}
            </div>
          </details>
        </div>

        <div className="h-56 border-t border-white/10">
          <ConsoleLog logs={studio.logs} isBusy={isTaskBusy} activitySignalKey={activitySignalKey} />
        </div>
      </div>
    </aside>
  );
};
