import React, { useEffect, useMemo } from 'react';
import { AppState, Frame } from '../types';
import { curateFrames, summarizeCuration } from '../services/public';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

interface AutoCurationParams {
  masterMode: boolean;
  appState: AppState;
  activeRequests: number;
  frames: Frame[];
  setFrames: Setter<Frame[]>;
  curationSignatureRef: React.MutableRefObject<string>;
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'network', latency?: number) => void;
}

export const useAutoCuration = ({
  masterMode,
  appState,
  activeRequests,
  frames,
  setFrames,
  curationSignatureRef,
  addLog,
}: AutoCurationParams) => {
  useEffect(() => {
    if (!masterMode) return;
    if (appState !== AppState.SHOOTING || activeRequests > 0) return;

    const completedFrames = frames.filter((frame) => frame.status === 'completed' && Boolean(frame.imageUrl));
    if (completedFrames.length === 0) return;

    const signature = completedFrames
      .map((frame) => `${frame.id}:${frame.metadata?.curationStatus || 'pending'}:${frame.metadata?.curationScore || 0}`)
      .join('|');
    if (curationSignatureRef.current === signature) return;

    const hasPending = completedFrames.some((frame) => {
      const status = frame.metadata?.curationStatus;
      return !status || status === 'pending';
    });
    if (!hasPending) {
      curationSignatureRef.current = signature;
      return;
    }

    const curated = curateFrames(frames, { keepRatio: 0.2, minKeep: 4, maxKeep: 20 });
    const summary = summarizeCuration(curated);
    curationSignatureRef.current = curated
      .filter((frame) => frame.status === 'completed' && Boolean(frame.imageUrl))
      .map((frame) => `${frame.id}:${frame.metadata?.curationStatus || 'pending'}:${frame.metadata?.curationScore || 0}`)
      .join('|');

    setFrames(curated);
    addLog(`[自动筛选] 保留 ${summary.keep} 张，剔除 ${summary.drop} 张。`, 'success');
  }, [masterMode, appState, activeRequests, frames, setFrames, curationSignatureRef, addLog]);

  const curationSummary = useMemo(() => summarizeCuration(frames), [frames]);

  return {
    curationSummary,
  };
};
