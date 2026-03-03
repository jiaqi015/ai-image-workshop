import type { useStudioArchitect } from '../../hooks/useStudioArchitect';

export type StudioViewModel = ReturnType<typeof useStudioArchitect>;

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
