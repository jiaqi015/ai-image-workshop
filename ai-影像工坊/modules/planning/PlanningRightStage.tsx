import React from 'react';
import { AppState } from '../../types';
import { ActivityIcon, ClockIcon, ZoomInIcon } from '../../components/Icons';
import { Gallery } from '../../components/Gallery';
import { PlanningStagePreload } from '../../components/PlanningStagePreload';
import type { PlanningStreamSnapshot } from '../../hooks/usePlanningStream';
import type { FrameStats, StudioViewModel } from './types';

interface PlanningRightStageProps {
  studio: StudioViewModel;
  stream: PlanningStreamSnapshot;
  frameStats: FrameStats;
}

export const PlanningRightStage: React.FC<PlanningRightStageProps> = ({ studio, stream, frameStats }) => {
  const conceptTitle = studio.frames.length > 0 ? `${studio.frames.length} 个候选方案` : '正在生成候选方案';

  if (studio.appState === AppState.PLANNING && !studio.plan) {
    return <PlanningStagePreload textModel={studio.textModel} imageModel={studio.imageModel} stream={stream} />;
  }

  if (studio.appState === AppState.CONCEPT) {
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-20 ui-surface-soft backdrop-blur px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="ui-meta tracking-wider">阶段 2 · 选择主方案</div>
            <h2 className="text-lg md:text-xl text-zinc-100 tracking-wide mt-1">{conceptTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={studio.handleExpandUniverse}
              disabled={studio.isExpandingUniverse}
              className="ui-btn-secondary h-8 px-3 text-xs disabled:opacity-50"
            >
              {studio.isExpandingUniverse ? '追加中...' : '再生成 6 个方案'}
            </button>
            <button
              type="button"
              onClick={studio.handleConfirmShoot}
              disabled={studio.selectedProposalId === null}
              className="ui-btn-primary h-8 px-4 text-xs tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              确认方案并开始生成
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 pb-8">
          {studio.frames.map((proposalFrame, index) => {
            const isSelected = studio.selectedProposalId === proposalFrame.id;
            const isRetrying = studio.retryingFrameIds.includes(proposalFrame.id);
            return (
              <article
                key={proposalFrame.id}
                className={`ui-surface-soft overflow-hidden transition-all ${
                  isSelected ? 'border-[rgba(188,211,255,0.45)] ring-1 ring-[rgba(188,211,255,0.35)]' : 'hover:border-white/25'
                }`}
              >
              <div
                role="button"
                tabIndex={0}
                className="w-full text-left cursor-pointer"
                onClick={() => studio.setSelectedProposalId(proposalFrame.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    studio.setSelectedProposalId(proposalFrame.id);
                  }
                }}
              >
                <div className="relative aspect-[3/4] bg-[#0a0a0d]">
                    <div className="absolute top-2 left-2 z-10 text-[10px] font-mono px-2 py-1 rounded bg-black/70 border border-white/10 text-zinc-100">
                      候选 {index + 1}
                    </div>

                    {proposalFrame.status === 'completed' && proposalFrame.imageUrl ? (
                      <>
                        <img src={proposalFrame.imageUrl} alt={`候选 ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            studio.setConceptPreviewUrl(proposalFrame.imageUrl || null);
                          }}
                          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/60 border border-white/15 text-zinc-200 hover:text-white"
                        >
                          <ZoomInIcon className="w-4 h-4" />
                        </button>
                      </>
                    ) : proposalFrame.status === 'failed' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-300">
                        <span className="text-sm">生成未完成</span>
                        <button
                          type="button"
                          disabled={isRetrying}
                          onClick={(e) => {
                            e.stopPropagation();
                            studio.handleRetryFrame(proposalFrame.id);
                          }}
                          className="px-3 py-1 text-xs rounded-full border border-white/20 text-zinc-300 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRetrying ? '重试中...' : '重新生成'}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                        {proposalFrame.status === 'generating'
                          ? '生成中...'
                          : proposalFrame.status === 'scripting'
                          ? '准备提示词...'
                          : '排队中...'}
                      </div>
                    )}
                </div>
              </div>

                <div className="p-3 border-t border-white/10 bg-black/15">
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[40px]">{proposalFrame.description || '等待方案说明'}</p>
                  <div className="mt-2 ui-meta font-mono">{proposalFrame.metadata?.variantType || 'balanced'}</div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  if (studio.appState === AppState.SHOOTING) {
    return (
      <div className="space-y-4">
        <div className="ui-surface-soft px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="ui-meta tracking-wider">阶段 3 · 批量生成</div>
            <div className="text-sm text-zinc-200 mt-1">
              已完成 {frameStats.completed} / {studio.frames.length} 帧
            </div>
            {studio.masterMode && (
              <div className="ui-meta mt-1">
                自动筛选：保留 {studio.curationSummary.keep} 张 · 剔除 {studio.curationSummary.drop} 张
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-400">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5" />
              {(studio.elapsedTime / 1000).toFixed(1)}s
            </div>
            <div className="flex items-center gap-1.5">
              <ActivityIcon className="w-3.5 h-3.5" />
              {studio.activeRequests} 进行中
            </div>
          </div>
        </div>
        <Gallery
          frames={studio.frames}
          plan={studio.plan}
          onRetryFrame={studio.handleRetryFrame}
          retryingFrameIds={studio.retryingFrameIds}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
      等待进入下一阶段
    </div>
  );
};
