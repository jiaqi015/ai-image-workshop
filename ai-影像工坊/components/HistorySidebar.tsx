import React from 'react';
import { ShootPlan } from '../types';
import { FilmIcon, TrashIcon, CameraIcon } from './Icons';

export type HistoryTaskStatus = 'planning' | 'concept' | 'shooting' | 'completed' | 'failed';

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
  plan: ShootPlan;
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
  onClose,
}) => {
  const statusMeta: Record<HistoryTaskStatus, { label: string; className: string }> = {
    planning: { label: '进行中 · 规划', className: 'ui-tag ui-tag-info' },
    concept: { label: '进行中 · 定调', className: 'ui-tag ui-tag-info' },
    shooting: { label: '进行中 · 拍摄', className: 'ui-tag ui-tag-info' },
    completed: { label: '已完成', className: 'ui-tag ui-tag-success' },
    failed: { label: '未完成', className: 'ui-tag ui-tag-muted' },
  };
  const resumeHint: Record<HistoryTaskStatus, string> = {
    planning: '可继续：需求拆解',
    concept: '可继续：选择主方案',
    shooting: '可继续：批量出图',
    completed: '已完成：可复用参数再生成',
    failed: '需重试后继续',
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
      <div
        className={`fixed inset-0 bg-black/25 backdrop-blur-sm z-40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <div
        className={`fixed inset-y-0 left-0 ui-history-drawer ui-surface z-50 transform transition-transform duration-200 shadow-xl rounded-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="px-6 py-5 border-b flex justify-between items-center" style={{ borderColor: 'var(--ui-border)' }}>
            <h2 className="font-semibold flex items-center gap-3 text-sm" style={{ color: 'var(--ui-text-primary)' }}>
              <div className="ui-surface-soft p-2">
                <FilmIcon className="w-4 h-4" />
              </div>
              <span>历史项目</span>
            </h2>
            <button onClick={onClose} className="ui-btn-link p-1.5">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center space-y-3" style={{ color: 'var(--ui-text-muted)' }}>
                <CameraIcon className="w-9 h-9 opacity-60" />
                <span className="text-xs">暂无历史项目</span>
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
                const statusKey = (item.taskStatus || 'completed') as HistoryTaskStatus;

                return (
                  <div
                    key={item.id}
                    className="group relative ui-surface-soft ui-card-lift p-4 transition-all cursor-pointer"
                    onClick={() => onSelect(item)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="space-y-1">
                        <span className="block text-[10px] font-mono ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
                          {formatDateTime(recordTime)}
                        </span>
                        <span className={status.className}>{status.label}</span>
                      </div>
                      <span className="ui-tag ui-tag-muted font-mono ui-numeric">{frameCount} 帧</span>
                    </div>

                    <div className="ui-meta font-mono mb-1">IP: {ipLabel} · {sourceLabel}</div>
                    <div className="ui-meta mb-2">{resumeHint[statusKey]}</div>

                    <h3 className="text-sm font-semibold mb-1 line-clamp-1" style={{ color: 'var(--ui-text-primary)' }}>
                      {item.plan.title}
                    </h3>
                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--ui-text-muted)' }}>
                      {item.userInput}
                    </p>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="absolute bottom-3 right-3 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: 'var(--ui-text-muted)' }}
                      title="删除记录"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 border-t" style={{ borderColor: 'var(--ui-border)' }}>
            <div className="ui-meta text-center">项目总数：{history.length}</div>
          </div>
        </div>
      </div>
    </>
  );
};
