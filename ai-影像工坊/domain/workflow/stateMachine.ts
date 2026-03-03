import { AppState } from '../../types';

export type WorkflowEvent =
  | { type: 'RESET' }
  | { type: 'PLAN_REQUESTED' }
  | { type: 'PLAN_READY' }
  | { type: 'PLAN_FAILED' }
  | { type: 'SHOOT_REQUESTED' }
  | { type: 'RESTORE_TO_CONCEPT' }
  | { type: 'FORCE_SET'; state: AppState };

export const transitionWorkflowState = (current: AppState, event: WorkflowEvent): AppState => {
  switch (event.type) {
    case 'RESET':
      return AppState.IDLE;
    case 'PLAN_REQUESTED':
      return current === AppState.IDLE ? AppState.PLANNING : current;
    case 'PLAN_READY':
      return current === AppState.PLANNING ? AppState.CONCEPT : current;
    case 'PLAN_FAILED':
      return current === AppState.PLANNING ? AppState.IDLE : current;
    case 'SHOOT_REQUESTED':
      return current === AppState.CONCEPT ? AppState.SHOOTING : current;
    case 'RESTORE_TO_CONCEPT':
      return AppState.CONCEPT;
    case 'FORCE_SET':
      return event.state;
    default:
      return current;
  }
};
