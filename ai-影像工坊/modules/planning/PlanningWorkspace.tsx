import React from 'react';
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
  const currentStage = stageMeta.find((stage) => stage.id === stageIndex) || stageMeta[0];

  return (
    <div className="h-full min-h-0 ui-shell-pad">
      <div className="h-full min-h-0 ui-planning-grid">
        <main ref={studio.mainContentRef} className="min-h-0 overflow-y-auto ui-surface p-4 md:p-5">
          <PlanningRightStage studio={studio} stream={stream} frameStats={frameStats} />
        </main>

        <PlanningLeftPanel
          className="hidden xl:block"
          studio={studio}
          stream={stream}
          stageName={currentStage?.name || '进行中'}
          stageDesc={currentStage?.desc || ''}
          frameStats={frameStats}
          renderStrategySelector={renderStrategySelector}
          renderModelSelectors={renderModelSelectors}
          isTaskBusy={isTaskBusy}
          activitySignalKey={activitySignalKey}
        />
      </div>

      <div className="xl:hidden mt-4">
        <PlanningLeftPanel
          studio={studio}
          stream={stream}
          stageName={currentStage?.name || '进行中'}
          stageDesc={currentStage?.desc || ''}
          frameStats={frameStats}
          renderStrategySelector={renderStrategySelector}
          renderModelSelectors={renderModelSelectors}
          isTaskBusy={isTaskBusy}
          activitySignalKey={activitySignalKey}
        />
      </div>
    </div>
  );
};
