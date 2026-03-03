import type { ShootStrategy } from '../../types';
import { ExecutionPolicy } from '../policies/executionPolicy';

export interface FrameRouteInput {
  strategy: ShootStrategy;
  description: string;
  frameIndex: number;
  totalFrames: number;
}

export const resolveRuntimeStrategy = (strategy: ShootStrategy, masterMode: boolean): ShootStrategy => {
  return masterMode ? 'pro' : strategy;
};

export const selectFrameModelType = (input: FrameRouteInput): 'pro' | 'flash' => {
  if (input.strategy === 'pro') return 'pro';
  if (input.strategy === 'flash') return 'flash';
  return ExecutionPolicy.routeHybridFrame(input.description, input.frameIndex, input.totalFrames);
};

export const canExpandConceptUniverse = (masterMode: boolean): boolean => {
  return !masterMode;
};
