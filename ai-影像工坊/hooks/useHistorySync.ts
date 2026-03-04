import { useEffect, useMemo, useRef } from 'react';
import { AppState, Frame } from '../types';
import type { HistoryTaskStatus } from '../components/HistorySidebar';

type UpdateHistoryItemFn = (
  timestampId: string,
  updatedFrames?: Frame[] | null,
  patch?: { taskStatus?: HistoryTaskStatus }
) => Promise<void>;

interface HistorySyncParams {
  currentHistoryId: string | null;
  appState: AppState;
  activeRequests: number;
  frames: Frame[];
  updateHistoryItem: UpdateHistoryItemFn;
}

const frameInFlight = (frame: Frame) =>
  frame.status === 'pending' || frame.status === 'generating' || frame.status === 'scripting';

export const useHistorySync = ({
  currentHistoryId,
  appState,
  activeRequests,
  frames,
  updateHistoryItem,
}: HistorySyncParams) => {
  const lastHistoryStatusRef = useRef<HistoryTaskStatus | null>(null);
  const lastHistoryFrameSignatureRef = useRef<string>('');

  useEffect(() => {
    if (!currentHistoryId) return;
    if (frames.length === 0) return;
    if (activeRequests > 0) return;
    if (appState !== AppState.CONCEPT && appState !== AppState.SHOOTING) return;

    const hasRenderableFrames = frames.some((frame) => frame.status === 'completed' || frame.status === 'failed');
    if (!hasRenderableFrames) return;

    const signature = `${appState}|${frames
      .map((frame) => `${frame.id}:${frame.status}:${Boolean(frame.imageUrl)}:${String(frame.error || '')}`)
      .join('|')}`;
    if (lastHistoryFrameSignatureRef.current === signature) return;
    lastHistoryFrameSignatureRef.current = signature;

    updateHistoryItem(currentHistoryId, frames).catch(() => undefined);
  }, [currentHistoryId, appState, activeRequests, frames, updateHistoryItem]);

  const derivedHistoryStatus = useMemo<HistoryTaskStatus>(() => {
    if (appState === AppState.PLANNING) return 'planning';
    if (appState === AppState.CONCEPT) return 'concept';
    if (appState === AppState.SHOOTING) {
      const hasInFlight = activeRequests > 0 || frames.some(frameInFlight);
      if (hasInFlight) return 'shooting';
      const hasCompleted = frames.some((frame) => frame.status === 'completed');
      return hasCompleted ? 'completed' : 'failed';
    }
    return 'completed';
  }, [appState, activeRequests, frames]);

  useEffect(() => {
    if (!currentHistoryId) return;
    // IDLE often means reset/failure fallback; avoid overriding an explicit failed/planning status.
    if (appState === AppState.IDLE) return;
    if (lastHistoryStatusRef.current === derivedHistoryStatus) return;
    lastHistoryStatusRef.current = derivedHistoryStatus;
    updateHistoryItem(currentHistoryId, null, { taskStatus: derivedHistoryStatus }).catch(() => undefined);
  }, [currentHistoryId, appState, derivedHistoryStatus, updateHistoryItem]);

  useEffect(() => {
    if (currentHistoryId) return;
    lastHistoryStatusRef.current = null;
    lastHistoryFrameSignatureRef.current = '';
  }, [currentHistoryId]);

  return {
    derivedHistoryStatus,
  };
};
