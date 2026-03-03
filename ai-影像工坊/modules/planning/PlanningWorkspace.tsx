import React from 'react';
import { AppState } from '../../types';
import { ContractCard } from '../../components/ContractCard';
import { DirectorThinking } from '../../components/DirectorThinking';
import { ConsoleLog } from '../../components/ConsoleLog';
import { usePlanningStream } from '../../hooks/usePlanningStream';
import { PlanningLeftPanel } from './PlanningLeftPanel';
import { PlanningRightStage } from './PlanningRightStage';
import type { FrameStats, StageMetaItem, StudioViewModel } from './types';

interface PlanningWorkspaceProps {
  studio: StudioViewModel;
  stageMeta: StageMetaItem[];
  stageIndex: number;
  frameStats: FrameStats;
  isTaskBusy: boolean;
  activitySignalKey: string;
  renderStrategySelector: (compact?: boolean) => React.ReactNode;
  renderModelSelectors: () => React.ReactNode;
}

export const PlanningWorkspace: React.FC<PlanningWorkspaceProps> = ({
  studio,
  stageMeta,
  stageIndex,
  frameStats,
  isTaskBusy,
  activitySignalKey,
  renderStrategySelector,
  renderModelSelectors,
}) => {
  const stream = usePlanningStream(studio.streamingPlanText);

  return (
    <div className="h-full min-h-0 p-4 md:p-6">
      <div className="h-full min-h-0 grid grid-cols-1 xl:grid-cols-[220px_minmax(0,1fr)_360px] gap-4">
        <aside className="hidden xl:flex flex-col gap-4 min-h-0">
          <section className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
            <div className="text-xs text-zinc-400 tracking-wider mb-3">工作流</div>
            <div className="space-y-2">
              {stageMeta.map((stage) => {
                const active = stage.id === stageIndex;
                const done = stage.id < stageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`rounded-md border px-3 py-2 ${
                      active
                        ? 'border-amber-500/60 bg-amber-500/10'
                        : done
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-white/10 bg-black/20'
                    }`}
                  >
                    <div className={`text-xs font-medium ${active ? 'text-amber-300' : done ? 'text-emerald-300' : 'text-zinc-400'}`}>
                      {stage.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">{stage.desc}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
            <div className="text-xs text-zinc-400 tracking-wider mb-3">拍摄模式</div>
            {renderStrategySelector()}
          </section>

          <section className="rounded-xl border border-white/10 bg-[#0d0d10] p-4 text-xs text-zinc-400 space-y-2">
            <div className="flex justify-between">
              <span>母版锁定</span>
              <span className={studio.masterMode ? 'text-emerald-300' : 'text-zinc-500'}>{studio.masterMode ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex justify-between">
              <span>总帧数</span>
              <span className="text-zinc-200">{studio.frames.length}</span>
            </div>
            <div className="flex justify-between">
              <span>已完成</span>
              <span className="text-emerald-300">{frameStats.completed}</span>
            </div>
            <div className="flex justify-between">
              <span>失败</span>
              <span className="text-red-300">{frameStats.failed}</span>
            </div>
            <div className="flex justify-between">
              <span>处理中</span>
              <span className="text-amber-300">{studio.activeRequests}</span>
            </div>
            {studio.masterMode && (
              <>
                <div className="flex justify-between">
                  <span>自动入选</span>
                  <span className="text-emerald-300">{studio.curationSummary.keep}</span>
                </div>
                <div className="flex justify-between">
                  <span>自动淘汰</span>
                  <span className="text-zinc-500">{studio.curationSummary.drop}</span>
                </div>
              </>
            )}
          </section>
        </aside>

        <main ref={studio.mainContentRef} className="min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-[#0d0d10] p-4 md:p-5">
          <PlanningRightStage studio={studio} stream={stream} frameStats={frameStats} />
        </main>

        <PlanningLeftPanel
          className="hidden xl:block"
          studio={studio}
          stream={stream}
          isTaskBusy={isTaskBusy}
          activitySignalKey={activitySignalKey}
        />
      </div>

      <div className="xl:hidden mt-4 space-y-4">
        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
          <div className="text-xs text-zinc-400 tracking-wider mb-3">拍摄模式</div>
          {renderStrategySelector(true)}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
          <div className="text-xs text-zinc-400 tracking-wider mb-3">模型设置</div>
          {renderModelSelectors()}
        </div>

        <details className="rounded-xl border border-white/10 bg-[#0d0d10] p-4">
          <summary className="cursor-pointer text-sm text-zinc-200">展开拍摄详情</summary>
          <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
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
            ) : null}
          </div>
        </details>

        <div className="rounded-xl border border-white/10 bg-[#0d0d10] overflow-hidden min-h-[220px]">
          <ConsoleLog logs={studio.logs} isBusy={isTaskBusy} activitySignalKey={activitySignalKey} />
        </div>
      </div>
    </div>
  );
};
