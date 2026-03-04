import React, { useEffect, useRef, useState } from 'react';
import { LogEntry } from '../types';
import { FilmIcon } from './Icons';

interface ConsoleLogProps {
  logs: LogEntry[];
  isBusy?: boolean;
  activitySignalKey?: string;
}

const STALL_THRESHOLD_MS = 90_000;
const PLANNING_STALL_THRESHOLD_MS = 300_000;
const ACTIVE_RENDER_STALL_THRESHOLD_MS = 180_000;

export const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs, isBusy = false, activitySignalKey = '' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const now = Date.now();
    setLastActivityAt(now);
    setNowMs(now);
  }, [activitySignalKey]);

  useEffect(() => {
    if (!isBusy) {
      setNowMs(Date.now());
      return;
    }
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isBusy]);

  const signalParts = activitySignalKey.split('|');
  const busyStage = signalParts[0] || '';
  const activeRequests = Number(signalParts[2] || 0);
  const dynamicThresholdMs =
    busyStage === 'PLANNING'
      ? PLANNING_STALL_THRESHOLD_MS
      : activeRequests > 0
      ? ACTIVE_RENDER_STALL_THRESHOLD_MS
      : STALL_THRESHOLD_MS;
  const silentSeconds = Math.max(0, Math.floor((nowMs - lastActivityAt) / 1000));
  const isStalled = isBusy && nowMs - lastActivityAt > dynamicThresholdMs;
  const signalText = !isBusy ? '空闲' : isStalled ? '无进展' : '运行中';

  return (
    <div className="flex flex-col h-full ui-surface-soft rounded-[10px] font-sans">
      <div className="flex items-center gap-3 px-3 py-2 border-b" style={{ borderColor: 'var(--ui-border)' }}>
        <span style={{ color: 'var(--ui-text-muted)' }}>
          <FilmIcon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--ui-text-secondary)' }}>任务日志</span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: !isBusy ? '#b7bfcc' : isStalled ? '#f0b429' : 'var(--ui-accent)' }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-mono ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
            任务状态: {signalText}
          </span>
          {isBusy && (
            <span className="text-[9px] font-mono ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
              无更新 {silentSeconds}秒
            </span>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 text-[11px] space-y-2 min-h-[120px]">
        {logs.length === 0 && (
          <div className="italic px-2" style={{ color: 'var(--ui-text-muted)' }}>当前无任务，等待开始。</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 group px-2 py-1 border-l" style={{ borderColor: 'var(--ui-border)' }}>
            <span className="shrink-0 font-mono text-[9px] pt-0.5 ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
              {log.timestamp}
            </span>
            <div className="flex-1 break-all">
              <span className="leading-relaxed" style={{ color: 'var(--ui-text-secondary)' }}>
                {log.message}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
