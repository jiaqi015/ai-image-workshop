
import React from 'react';
import { ShootPlan } from '../types';
import { FilmIcon, TrashIcon, CameraIcon } from './Icons';

// 历史记录单项结构
export interface HistoryItem {
  id: string;
  timestamp: number;
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
  return (
    <>
      {/* 遮罩层 (Backdrop) */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 侧边栏面板 (Sliding Panel) */}
      <div 
        className={`fixed inset-y-0 left-0 w-80 md:w-96 bg-[#09090b] border-r border-white/5 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-full flex flex-col">
          {/* 顶部标题 */}
          <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-[#0c0c0e]">
            <h2 className="font-bold text-zinc-200 flex items-center gap-3 text-sm tracking-wide">
              <div className="bg-amber-500/10 text-amber-500 p-2 rounded border border-amber-500/20">
                <FilmIcon className="w-4 h-4" />
              </div>
              <span className="tracking-widest text-xs">制作档案库</span>
            </h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full">✕</button>
          </div>

          {/* 历史列表 (可滚动) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {history.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-zinc-700 space-y-4">
                <CameraIcon className="w-10 h-10 opacity-20" />
                <span className="text-xs font-mono uppercase tracking-widest">暂无历史记录</span>
              </div>
            ) : (
              history.map((item) => (
                <div 
                  key={item.id} 
                  className="group relative bg-zinc-900/40 border border-white/5 rounded-lg p-5 hover:border-amber-500/30 hover:bg-zinc-800/60 transition-all cursor-pointer"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex justify-between items-start mb-3">
                     <span className="text-[10px] font-mono text-zinc-500 tracking-wider uppercase">
                        {new Date(item.timestamp).toLocaleDateString()}
                     </span>
                     <span className="text-[10px] font-mono text-amber-500/70 bg-amber-900/10 px-1.5 py-0.5 rounded border border-amber-500/10">
                        {item.plan.frames.length} 帧
                     </span>
                  </div>
                  
                  <h3 className="text-sm font-bold text-zinc-200 mb-2 line-clamp-1 group-hover:text-amber-400 transition-colors">
                    {item.plan.title}
                  </h3>
                  <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed font-light group-hover:text-zinc-400">
                    {item.userInput}
                  </p>
                  
                  {/* 删除按钮 (Hover显示) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="absolute bottom-4 right-4 p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-full opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0"
                    title="删除"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
          
          {/* 底部统计 */}
          <div className="p-4 border-t border-white/5 bg-[#0c0c0e]">
             <div className="text-[10px] text-zinc-600 text-center font-mono tracking-widest uppercase">
                总场次: {history.length}
             </div>
          </div>
        </div>
      </div>
    </>
  );
};
