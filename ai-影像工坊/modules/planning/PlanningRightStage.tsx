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
  const shootingPendingCount = frameStats.scripting + frameStats.pending + frameStats.generating + studio.activeRequests;
  const shootingBatchDone = studio.appState === AppState.SHOOTING && shootingPendingCount === 0;

  if (studio.appState === AppState.PLANNING && !studio.plan) {
    return <PlanningStagePreload textModel={studio.textModel} imageModel={studio.imageModel} stream={stream} />;
  }

  if (studio.appState === AppState.CONCEPT) {
    return (
      <div className="space-y-3 ui-reveal">
        <div
          className="sticky top-0 z-20 ui-surface-soft backdrop-blur-sm px-3 py-2.5 flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between"
          style={{ borderColor: 'var(--ui-border-strong)', background: 'rgba(28, 29, 33, 0.9)' }}
        >
          <div>
            <div className="ui-meta">阶段 2 / 选择主方案</div>
            <h2 className="text-base md:text-lg mt-1 ui-numeric" style={{ color: 'var(--ui-text-primary)' }}>{conceptTitle}</h2>
            <div className="mt-1 ui-meta">先锁定 1 个主方案，再进入批量出图。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={studio.handleConfirmShoot}
              disabled={studio.selectedProposalId === null}
              className="ui-btn-primary px-4 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              确认方案并开始生成
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 pb-6">
          {studio.frames.map((proposalFrame, index) => {
            const isSelected = studio.selectedProposalId === proposalFrame.id;
            const isRetrying = studio.retryingFrameIds.includes(proposalFrame.id);
            const isRewriting = studio.rewritingFrameIds.includes(proposalFrame.id);
            const isExpandingFromThis = studio.expandingFromProposalId === proposalFrame.id && studio.isExpandingUniverse;
            return (
              <article
                key={proposalFrame.id}
                className={`group ui-surface-soft ui-card-lift overflow-hidden transition-all ${
                  isSelected ? 'ring-1' : ''
                }`}
                style={{ borderColor: isSelected ? 'rgba(7, 193, 96, 0.45)' : undefined, boxShadow: isSelected ? '0 0 0 1px rgba(7,193,96,0.2)' : undefined }}
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
                  <div className="relative aspect-[3/4]" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
                    <div className="absolute top-2 left-2 z-10 text-[10px] font-mono px-2 py-1 rounded border ui-surface">
                      候选 {index + 1}
                    </div>

                    {proposalFrame.status === 'completed' && proposalFrame.imageUrl ? (
                      <>
                        <img src={proposalFrame.imageUrl} alt={`候选 ${index + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            studio.setConceptPreviewUrl(proposalFrame.imageUrl || null);
                          }}
                          className="absolute top-2 right-2 z-10 p-2 rounded-full border ui-surface"
                        >
                          <ZoomInIcon className="w-4 h-4" />
                        </button>
                      </>
                    ) : proposalFrame.status === 'failed' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-3 text-center">
                        <span className="text-sm" style={{ color: 'var(--ui-text-secondary)' }}>生成未完成</span>
                        <div className="text-[11px] leading-relaxed" style={{ color: 'var(--ui-text-muted)' }}>
                          {proposalFrame.error || '原因未记录'}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isRetrying}
                            onClick={(e) => {
                              e.stopPropagation();
                              studio.handleRetryFrame(proposalFrame.id, 'same');
                            }}
                            className="ui-btn-secondary ui-btn-compact px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRetrying ? '重试中...' : '同参数重试'}
                          </button>
                          <button
                            type="button"
                            disabled={isRetrying}
                            onClick={(e) => {
                              e.stopPropagation();
                              studio.handleRetryFrame(proposalFrame.id, 'fallback');
                            }}
                            className="ui-btn-secondary ui-btn-compact px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            换参数重试
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--ui-text-muted)' }}>
                        {proposalFrame.status === 'generating'
                          ? '生成中...'
                          : proposalFrame.status === 'scripting'
                          ? '准备提示词...'
                          : '排队中...'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-2.5 border-t" style={{ borderColor: 'var(--ui-border)' }}>
                  <p className="text-xs leading-relaxed min-h-[40px]" style={{ color: 'var(--ui-text-secondary)' }}>
                    {proposalFrame.description || '等待方案说明'}
                  </p>
                  <div className="mt-2 ui-meta font-mono ui-numeric">{proposalFrame.metadata?.variantType || 'balanced'}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => studio.setSelectedProposalId(proposalFrame.id)}
                      className={`ui-btn-secondary ui-btn-compact px-2.5 ${isSelected ? 'ui-chip-active' : ''}`}
                    >
                      锁定方向
                    </button>
                    <button
                      type="button"
                      onClick={() => studio.handleRewriteProposal(proposalFrame.id)}
                      disabled={isRewriting || proposalFrame.status === 'generating' || proposalFrame.status === 'scripting'}
                      className="ui-btn-secondary ui-btn-compact px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isRewriting ? '重写中...' : '重写提示词'}
                    </button>
                    <button
                      type="button"
                      onClick={() => studio.handleGenerateRelatedProposals(proposalFrame.id, 4)}
                      disabled={isExpandingFromThis || studio.isExpandingUniverse}
                      className="ui-btn-secondary ui-btn-compact px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isExpandingFromThis ? '生成中...' : '再生 4 张'}
                    </button>
                  </div>
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
      <div className="space-y-3 ui-reveal">
        <div className="ui-surface-soft px-3 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <div className="ui-meta">阶段 3 / 批量生成</div>
            <div className="text-sm mt-1 ui-numeric" style={{ color: 'var(--ui-text-primary)' }}>
              已完成 {frameStats.completed} / {studio.frames.length} 帧
            </div>
            {studio.masterMode && (
              <div className="ui-meta mt-1">
                自动筛选：保留 {studio.curationSummary.keep} 张，剔除 {studio.curationSummary.drop} 张
              </div>
            )}
            <div className="mt-1 ui-meta">
              下一步：{shootingBatchDone ? '导出成片或继续扩展镜头。' : '等待当前批次完成，系统会持续出图。'}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono ui-numeric" style={{ color: 'var(--ui-text-muted)' }}>
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5" />
              {(studio.elapsedTime / 1000).toFixed(1)}s
            </div>
            <div className="flex items-center gap-1.5">
              <ActivityIcon className="w-3.5 h-3.5" />
              {studio.activeRequests} 进行中
            </div>
            {shootingBatchDone && (
              <button
                type="button"
                onClick={() => studio.handleGenerateMore(4)}
                className="ui-btn-secondary ui-btn-compact px-3"
              >
                再扩展 4 帧
              </button>
            )}
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
    <div className="h-full flex items-center justify-center text-sm" style={{ color: 'var(--ui-text-muted)' }}>
      等待进入下一阶段
    </div>
  );
};
