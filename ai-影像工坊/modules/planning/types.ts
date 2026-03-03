import type { useStudioOrchestrator } from '../../hooks/useStudioOrchestrator';

export type StudioViewModel = ReturnType<typeof useStudioOrchestrator>;

export interface StageMetaItem {
  id: number;
  name: string;
  desc: string;
}

export interface FrameStats {
  scripting: number;
  pending: number;
  generating: number;
  completed: number;
  failed: number;
}
