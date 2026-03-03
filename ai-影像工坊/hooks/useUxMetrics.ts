import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Frame } from '../types';
import type { HistoryTaskStatus } from '../components/HistorySidebar';

type UXMetricsStore = {
  tasksStarted: number;
  tasksCompleted: number;
  tasksFailed: number;
  firstImageMsSamples: number[];
  retriesAttempted: number;
  retriesRecovered: number;
  sessionsStarted: number;
  returningSessions: number;
};

const UX_METRICS_KEY = 'ai_studio_ux_metrics_v1';
const DEFAULT_UX_METRICS: UXMetricsStore = {
  tasksStarted: 0,
  tasksCompleted: 0,
  tasksFailed: 0,
  firstImageMsSamples: [],
  retriesAttempted: 0,
  retriesRecovered: 0,
  sessionsStarted: 0,
  returningSessions: 0,
};

interface UseUxMetricsParams {
  historyLength: number;
  frames: Frame[];
  currentHistoryId: string | null;
  derivedHistoryStatus: HistoryTaskStatus;
}

export const useUxMetrics = ({ historyLength, frames, currentHistoryId, derivedHistoryStatus }: UseUxMetricsParams) => {
  const [uxMetrics, setUxMetrics] = useState<UXMetricsStore>(() => {
    try {
      const raw = localStorage.getItem(UX_METRICS_KEY);
      if (!raw) return DEFAULT_UX_METRICS;
      const parsed = JSON.parse(raw) as Partial<UXMetricsStore>;
      return {
        ...DEFAULT_UX_METRICS,
        ...parsed,
        firstImageMsSamples: Array.isArray(parsed.firstImageMsSamples) ? parsed.firstImageMsSamples.slice(-50) : [],
      };
    } catch {
      return DEFAULT_UX_METRICS;
    }
  });

  const taskStartAtRef = useRef<number | null>(null);
  const firstImageTrackedRef = useRef(false);
  const finalizedHistoryIdsRef = useRef<Set<string>>(new Set());
  const retrySessionKeyRef = useRef<string>('');
  const retryAttemptedKeysRef = useRef<Set<string>>(new Set());
  const retryRecoveredKeysRef = useRef<Set<string>>(new Set());

  const updateUXMetrics = useCallback((updater: (prev: UXMetricsStore) => UXMetricsStore) => {
    setUxMetrics((prev) => {
      const next = updater(prev);
      localStorage.setItem(UX_METRICS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const markTaskStarted = useCallback(() => {
    taskStartAtRef.current = Date.now();
    firstImageTrackedRef.current = false;
    retrySessionKeyRef.current = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    retryAttemptedKeysRef.current.clear();
    retryRecoveredKeysRef.current.clear();
    updateUXMetrics((prev) => ({
      ...prev,
      tasksStarted: prev.tasksStarted + 1,
      sessionsStarted: prev.sessionsStarted + 1,
      returningSessions: prev.returningSessions + (historyLength > 0 ? 1 : 0),
    }));
  }, [historyLength, updateUXMetrics]);

  const markRetryAttempt = useCallback((frameId: number) => {
    const key = `${retrySessionKeyRef.current}:${frameId}`;
    if (retryAttemptedKeysRef.current.has(key)) return;
    retryAttemptedKeysRef.current.add(key);
    updateUXMetrics((prev) => ({ ...prev, retriesAttempted: prev.retriesAttempted + 1 }));
  }, [updateUXMetrics]);

  const resetTracking = useCallback(() => {
    retryAttemptedKeysRef.current.clear();
    retryRecoveredKeysRef.current.clear();
    retrySessionKeyRef.current = '';
    taskStartAtRef.current = null;
    firstImageTrackedRef.current = false;
  }, []);

  useEffect(() => {
    if (firstImageTrackedRef.current) return;
    if (!taskStartAtRef.current) return;
    const hasFirstCompletedFrame = frames.some((frame) => frame.status === 'completed' && Boolean(frame.imageUrl));
    if (!hasFirstCompletedFrame) return;
    firstImageTrackedRef.current = true;
    const elapsed = Math.max(0, Date.now() - taskStartAtRef.current);
    updateUXMetrics((prev) => ({
      ...prev,
      firstImageMsSamples: [...prev.firstImageMsSamples, elapsed].slice(-50),
    }));
  }, [frames, updateUXMetrics]);

  useEffect(() => {
    if (!retrySessionKeyRef.current) return;
    const recoveredKeys: string[] = [];
    for (const frame of frames) {
      if (frame.status !== 'completed') continue;
      const key = `${retrySessionKeyRef.current}:${frame.id}`;
      if (!retryAttemptedKeysRef.current.has(key)) continue;
      if (retryRecoveredKeysRef.current.has(key)) continue;
      retryRecoveredKeysRef.current.add(key);
      recoveredKeys.push(key);
    }
    if (recoveredKeys.length === 0) return;
    updateUXMetrics((prev) => ({
      ...prev,
      retriesRecovered: prev.retriesRecovered + recoveredKeys.length,
    }));
  }, [frames, updateUXMetrics]);

  useEffect(() => {
    if (!currentHistoryId) return;
    if (derivedHistoryStatus !== 'completed' && derivedHistoryStatus !== 'failed') return;
    if (finalizedHistoryIdsRef.current.has(currentHistoryId)) return;
    finalizedHistoryIdsRef.current.add(currentHistoryId);
    updateUXMetrics((prev) => ({
      ...prev,
      tasksCompleted: prev.tasksCompleted + (derivedHistoryStatus === 'completed' ? 1 : 0),
      tasksFailed: prev.tasksFailed + (derivedHistoryStatus === 'failed' ? 1 : 0),
    }));
  }, [currentHistoryId, derivedHistoryStatus, updateUXMetrics]);

  const uxMetricsSummary = useMemo(() => {
    const avgFirstImageMs = uxMetrics.firstImageMsSamples.length
      ? Math.round(uxMetrics.firstImageMsSamples.reduce((sum, value) => sum + value, 0) / uxMetrics.firstImageMsSamples.length)
      : 0;
    const completionRate = uxMetrics.tasksStarted > 0 ? uxMetrics.tasksCompleted / uxMetrics.tasksStarted : 0;
    const recoveryRate = uxMetrics.retriesAttempted > 0 ? uxMetrics.retriesRecovered / uxMetrics.retriesAttempted : 0;
    const returningRate = uxMetrics.sessionsStarted > 0 ? uxMetrics.returningSessions / uxMetrics.sessionsStarted : 0;
    return {
      avgFirstImageMs,
      completionRate,
      recoveryRate,
      returningRate,
      raw: uxMetrics,
    };
  }, [uxMetrics]);

  return {
    markTaskStarted,
    markRetryAttempt,
    resetTracking,
    uxMetricsSummary,
  };
};
