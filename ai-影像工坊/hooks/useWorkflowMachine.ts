import { useCallback, useReducer } from 'react';
import { AppState } from '../types';
import { transitionWorkflowState, type WorkflowEvent } from '../domain/workflow/stateMachine';

export const useWorkflowMachine = () => {
  const [appState, dispatch] = useReducer(transitionWorkflowState, AppState.IDLE);

  const transition = useCallback((event: WorkflowEvent) => {
    dispatch(event);
  }, []);

  const setAppState = useCallback((state: AppState) => {
    dispatch({ type: 'FORCE_SET', state });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    appState,
    transition,
    setAppState,
    reset,
  };
};
