
import React from 'react';
import { ShootPlan } from '../types';
import { FilmIcon, TrashIcon, CameraIcon } from './Icons';

export type HistoryTaskStatus = 'planning' | 'concept' | 'shooting' | 'completed' | 'failed';

// 历史记录单项结构
export interface HistoryItem {
  id: string;
  timestamp: number;
  updatedAt?: number;
  createdAtIso?: string;
  updatedAtIso?: string;
  clientIp?: string;
  source?: string;
  taskStatus?: HistoryTaskStatus;
  userInput: string;
  plan: ShootPlan; // 完整的拍摄计划快照
}

interface HistorySidebarProps {
  isOpen: boolean;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  history, 
  onSelect, 
  onDelete, 
  onClose 
}) => {
  const statusMeta: Record<HistoryTaskStatus, { label: string; className: string }> = {
    planning: { label: '进行中 · 规划', className: 'ui-tag ui-tag-info' },
    concept: { label: '进行中 · 定调', className: 'ui-tag ui-tag-info' },
    shooting: { label: '进行中 · 拍摄', className: 'ui-tag ui-tag-info' },
    completed: { label: '已完成', className: 'ui-tag ui-tag-success' },
    failed: { label: '未完成', className: 'ui-tag ui-tag-muted' },
  };

  const formatDateTime = (value: number | undefined) => {
    const ts = Number(value || 0);
    if (!Number.isFinite(ts) || ts <= 0) return '时间未知';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '时间未知';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  };

  return (
    <>
      {/* 遮罩层 (Backdrop) */}
      <div 
        className={`fixed inset-0 bg-black/75 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 侧边栏面板 (Sliding Panel) */}
      <div 
        className={`fixed inset-y-0 left-0 w-80 md:w-96 ui-surface border-r border-white/10 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl rounded-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full flex flex-col">
          {/* 顶部标题 */}
          <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center">
            <h2 className="font-semibold text-zinc-200 flex items-center gap-3 text-sm tracking-wide">
              <div className="ui-surface-soft p-2 text-zinc-300">
                <FilmIcon className="w-4 h-4" />
              </div>
              <span className="tracking-widest text-xs">历史项目</span>
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">✕</button>
          </div>

          {/* 历史列表 (可滚动) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-zinc-700 space-y-4">
                <CameraIcon className="w-10 h-10 opacity-20" />
                <span className="text-xs font-mono uppercase tracking-widest">暂无历史项目</span>
              </div>
            ) : (
              history.map((item) => {
                const recordTime = item.updatedAt || item.timestamp;
                const ipLabel = item.clientIp && item.clientIp !== 'unknown' ? item.clientIp : 'IP未知';
                const sourceLabel = item.source === 'vercel_blob' ? '云端存档' : '本地存档';
                const renderCount = Array.isArray(item.plan?.renderFrames) ? item.plan.renderFrames.length : 0;
                const conceptCount = Array.isArray(item.plan?.conceptFrames) ? item.plan.conceptFrames.length : 0;
                const scriptCount = Array.isArray(item.plan?.frames) ? item.plan.frames.length : 0;
                const frameCount = renderCount || conceptCount || scriptCount;
                const status = statusMeta[item.taskStatus || 'completed'];
                return (
                <div 
                  key={item.id} 
                  className="group relative ui-surface-soft p-5 hover:border-white/25 transition-all cursor-pointer"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex justify-between items-start mb-3">
                     <div className="space-y-1">
                       <span className="block text-[10px] font-mono text-zinc-500 tracking-wider">
                          {formatDateTime(recordTime)}
                       </span>
                       <span className={status.className}>
                         {status.label}
                       </span>
                     </div>
                     <span className="ui-tag ui-tag-muted font-mono">
                        {frameCount} 帧
                     </span>
                  </div>
                  <div className="ui-meta font-mono mb-2">
                    IP: {ipLabel} · {sourceLabel}
                  </div>
                  
                  <h3 className="text-sm font-semibold text-zinc-200 mb-2 line-clamp-1 group-hover:text-zinc-100 transition-colors">
                    {item.plan.title}
                  </h3>
                  <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed group-hover:text-zinc-300">
                    {item.userInput}
                  </p>
                  
                  {/* 删除按钮 (Hover显示) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="absolute bottom-4 right-4 p-2 text-zinc-600 hover:text-zinc-200 hover:bg-white/5 rounded-full opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                    title="删除记录"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                );
              })
            )}
          </div>
          
          {/* 底部统计 */}
          <div className="p-4 border-t border-white/10">
             <div className="ui-meta text-center font-mono tracking-widest uppercase">
                项目总数: {history.length}
             </div>
          </div>
        </div>
      </div>
    </>
  );
};
