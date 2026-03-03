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
  const conceptTitle = studio.frames.length > 0 ? `${studio.frames.length}个方案` : '方案生成中';

  if (studio.appState === AppState.PLANNING && !studio.plan) {
    return <PlanningStagePreload textModel={studio.textModel} imageModel={studio.imageModel} stream={stream} />;
  }

  if (studio.appState === AppState.CONCEPT) {
    return (
      <div className="space-y-4">
        <div className="sticky top-0 z-20 rounded-lg border border-white/10 bg-[#0d0d10]/95 backdrop-blur px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] text-zinc-500 tracking-wider">阶段二 · 视觉定调</div>
            <h2 className="text-xl text-zinc-100 tracking-wide mt-1">{conceptTitle}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={studio.handleExpandUniverse}
              disabled={studio.isExpandingUniverse}
              className="px-3 py-2 rounded-md border border-white/15 text-xs text-zinc-300 hover:text-white hover:border-white/30 disabled:opacity-50"
            >
              {studio.isExpandingUniverse ? '追加中...' : '追加 6 个方案'}
            </button>
            <button
              type="button"
              onClick={studio.handleConfirmShoot}
              disabled={studio.selectedProposalId === null}
              className="px-4 py-2 rounded-md bg-amber-600 text-white text-xs font-semibold tracking-wide hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              锁定方案并开机
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
                className={`rounded-xl border overflow-hidden transition-all ${
                  isSelected ? 'border-amber-500/70 ring-1 ring-amber-500/40' : 'border-white/10 hover:border-white/25'
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
                      方案 {index + 1}
                    </div>

                    {proposalFrame.status === 'completed' && proposalFrame.imageUrl ? (
                      <>
                        <img src={proposalFrame.imageUrl} alt={`方案 ${index + 1}`} className="w-full h-full object-cover" />
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
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-red-300">
                        <span className="text-sm">生成失败</span>
                        <button
                          type="button"
                          disabled={isRetrying}
                          onClick={(e) => {
                            e.stopPropagation();
                            studio.handleRetryFrame(proposalFrame.id);
                          }}
                          className="px-3 py-1 text-xs rounded-full border border-red-400/40 hover:border-red-300/70 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRetrying ? '重试中...' : '重试'}
                        </button>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                        {proposalFrame.status === 'generating'
                          ? '渲染中...'
                          : proposalFrame.status === 'scripting'
                          ? '写分镜中...'
                          : '等待中...'}
                      </div>
                    )}
                </div>
              </div>

                <div className="p-3 border-t border-white/10 bg-[#0d0d10]">
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[40px]">{proposalFrame.description || '等待方案描述'}</p>
                  <div className="mt-2 text-[10px] text-zinc-500 font-mono">{proposalFrame.metadata?.variantType || 'balanced'}</div>
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
        <div className="rounded-lg border border-white/10 bg-[#0d0d10] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-zinc-500 tracking-wider">阶段三 · 正片拍摄</div>
            <div className="text-sm text-zinc-200 mt-1">
              已完成 {frameStats.completed} / {studio.frames.length} 帧
            </div>
            {studio.masterMode && (
              <div className="text-[11px] text-zinc-500 mt-1">
                自动筛片：入选 {studio.curationSummary.keep} 张 · 淘汰 {studio.curationSummary.drop} 张
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
              {studio.activeRequests} 处理中
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
      等待进入工作阶段
    </div>
  );
};
