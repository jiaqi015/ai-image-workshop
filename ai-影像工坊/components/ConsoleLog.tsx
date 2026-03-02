
import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { FilmIcon } from './Icons'; 

interface ConsoleLogProps {
  logs: LogEntry[];
}

export const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部 (Auto-scroll to bottom on new log)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-[#0c0c0e] border-t border-white/5 font-sans">
      <div className="flex items-center gap-3 px-6 py-3 bg-white/5 border-b border-white/5">
        <FilmIcon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-[11px] font-bold text-zinc-400 tracking-[0.2em] font-serif">拍摄日志</span>
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
