import React from 'react';
import { AppState } from '../../types';
import { ConsoleLog } from '../../components/ConsoleLog';
import { ContractCard } from '../../components/ContractCard';
import { DirectorThinking } from '../../components/DirectorThinking';
import type { PlanningStreamSnapshot } from '../../hooks/usePlanningStream';
import type { StudioViewModel } from './types';

interface PlanningLeftPanelProps {
  studio: StudioViewModel;
  stream: PlanningStreamSnapshot;
  isTaskBusy: boolean;
  activitySignalKey: string;
  className?: string;
}

export const PlanningLeftPanel: React.FC<PlanningLeftPanelProps> = ({
  studio,
  stream,
  isTaskBusy,
  activitySignalKey,
  className = '',
}) => {
  return (
    <aside className={`min-h-0 overflow-hidden rounded-xl border border-white/10 bg-[#0c0c0f] ${className}`}>
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 p-4 overflow-hidden">
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
            <div className="h-full flex items-center justify-center text-zinc-600 text-sm">等待任务启动</div>
          )}
        </div>
        <div className="h-64 border-t border-white/10">
          <ConsoleLog logs={studio.logs} isBusy={isTaskBusy} activitySignalKey={activitySignalKey} />
        </div>
      </div>
    </aside>
  );
};
