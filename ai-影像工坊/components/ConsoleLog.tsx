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

  // 自动滚动到底部 (Auto-scroll to bottom on new log)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // 捕捉“任务有进展”的时刻
  useEffect(() => {
    const now = Date.now();
    setLastActivityAt(now);
    setNowMs(now);
  }, [activitySignalKey]);

  // 运行中每秒刷新一次，用于判断是否超时无进展
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
  const isStalled = isBusy && (nowMs - lastActivityAt) > dynamicThresholdMs;
  const signalText = !isBusy ? "待机" : isStalled ? "疑似卡住" : "活着";
  const signalDotClass = !isBusy
    ? "bg-zinc-500"
    : isStalled
      ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
      : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.75)]";
  const signalTextClass = !isBusy ? "text-zinc-500" : isStalled ? "text-red-300" : "text-emerald-300";

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e] border-t border-white/5 font-sans">
      <div className="flex items-center gap-3 px-6 py-3 bg-white/5 border-b border-white/5">
        <FilmIcon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[11px] font-bold text-zinc-400 tracking-[0.2em] font-serif">拍摄日志</span>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${signalDotClass}`} aria-hidden="true" />
          <span className={`text-[10px] font-mono tracking-wide ${signalTextClass}`}>任务信号: {signalText}</span>
          {isBusy && (
            <span className="text-[9px] font-mono text-zinc-500">静默 {silentSeconds}s</span>
          )}
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 text-[11px] space-y-3 custom-scrollbar min-h-[120px]"
      >
        {logs.length === 0 && (
           <div className="text-zinc-600 italic px-2 font-serif opacity-50">暗房待机中... 等待导演指令。</div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex gap-4 group px-2 py-1 border-l border-white/5 hover:border-amber-500/50 transition-colors">
            <span className="text-zinc-600 shrink-0 font-mono text-[9px] pt-0.5">{log.timestamp}</span>
            <div className="flex-1 break-all">
               <span className={`
                 leading-relaxed font-light tracking-wide
                 ${log.type === 'success' ? 'text-zinc-300' : ''}
                 ${log.type === 'error' ? 'text-red-400 italic' : ''}
                 ${log.type === 'network' ? 'text-zinc-500' : ''}
                 ${log.type === 'info' ? 'text-zinc-400' : ''}
               `}>
                 {log.message}
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
