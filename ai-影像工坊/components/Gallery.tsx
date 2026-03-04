import React, { useState, useEffect, useCallback } from 'react';
import { Frame, ShootPlan, FrameMetadata } from '../types';
import { DownloadIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, TerminalIcon } from './Icons';
import { constructFullPrompt } from '../application/studioFacade';

interface GalleryProps {
  frames: Frame[];
  plan?: ShootPlan | null;
  onRetryFrame?: (frameId: number, mode?: 'same' | 'fallback') => void;
  retryingFrameIds?: number[];
}

export const Gallery: React.FC<GalleryProps> = ({ frames, plan, onRetryFrame, retryingFrameIds = [] }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
    setIsZoomed(false);
  }, []);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsZoomed(false);
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNext = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setIsZoomed(false);
      setSelectedIndex((prev) => (prev !== null && prev < frames.length - 1 ? prev + 1 : prev));
    },
    [frames.length]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          if (selectedIndex > 0) handlePrev();
          break;
        case 'ArrowRight':
          if (selectedIndex < frames.length - 1) handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = selectedIndex !== null ? 'hidden' : 'unset';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedIndex, frames.length, closeLightbox, handlePrev, handleNext]);

  const openLightbox = (index: number) => {
    if (frames[index].status === 'completed' && frames[index].imageUrl) {
      setSelectedIndex(index);
    }
  };

  const handleProDownload = async (e: React.MouseEvent, url: string, id: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (downloadingId === id) return;
    setDownloadingId(id);

    const filename = `ai-studio-frame-${String(id).padStart(3, '0')}.png`;

    try {
      if (url.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      }
    } catch (err) {
      console.error('下载失败:', err);
      window.open(url, '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCopyPrompt = (e: React.MouseEvent, frame: Frame) => {
    e.stopPropagation();

    let text = '';
    if (plan) {
      const fallbackMetadata: FrameMetadata = {
        model: '未标注',
        provider: '未标注',
        strategy: '未标注',
        resolution: '未标注',
      };
      text = constructFullPrompt(plan, frame.description, frame.metadata || fallbackMetadata);
    } else {
      text = `[画面描述] ${frame.description}\n[模型] ${frame.metadata?.model}\n[风格] ${frame.metadata?.variant}`;
    }

    navigator.clipboard.writeText(text);
    setCopiedId(frame.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const selectedFrame = selectedIndex !== null ? frames[selectedIndex] : null;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 pb-20 md:pb-0 ui-reveal">
        {frames.map((frame, index) => (
          <div key={frame.id} className="flex flex-col gap-3 group">
            <div
              className={`ui-card-lift relative aspect-[3/4] rounded-[14px] overflow-hidden border transition-all ${
                frame.status === 'completed' ? 'cursor-pointer hover:shadow-lg' : ''
              }`}
              style={{ borderColor: 'var(--ui-border)', background: 'rgba(255, 255, 255, 0.03)' }}
              onClick={() => openLightbox(index)}
            >
              <div className="absolute top-3 left-3 z-20 pointer-events-none flex gap-2">
                <div className="px-2 py-1 ui-surface border text-[10px] rounded font-mono ui-numeric">#{String(frame.id).padStart(2, '0')}</div>
              </div>

              {frame.status === 'completed' && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
                  <div className="ui-surface p-3 rounded-full border" style={{ borderColor: 'var(--ui-border)' }}>
                    <ZoomInIcon className="w-5 h-5" />
                  </div>
                </div>
              )}

              {frame.status === 'completed' && frame.imageUrl ? (
                <img
                  src={frame.imageUrl}
                  alt={frame.description}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-5 text-center">
                  {frame.status === 'generating' && (
                    <>
                      <div
                        className="w-10 h-10 rounded-full border-2 animate-spin mb-3"
                        style={{ borderColor: 'rgba(255, 255, 255, 0.16)', borderTopColor: 'var(--ui-accent)' }}
                      />
                      <span className="text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>正在生成</span>
                    </>
                  )}

                  {frame.status === 'failed' && (
                    <>
                      <span className="text-2xl mb-2" style={{ color: 'var(--ui-text-muted)' }}>×</span>
                      <span className="text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>
                        {frame.error || '生成失败'}
                      </span>
                      {onRetryFrame && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={retryingFrameIds.includes(frame.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryFrame(frame.id, 'same');
                            }}
                            className="ui-btn-secondary ui-btn-compact px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {retryingFrameIds.includes(frame.id) ? '重试中...' : '同参数重试'}
                          </button>
                          <button
                            type="button"
                            disabled={retryingFrameIds.includes(frame.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRetryFrame(frame.id, 'fallback');
                            }}
                            className="ui-btn-secondary ui-btn-compact px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            换参数重试
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {frame.status === 'scripting' && (
                    <div className="flex flex-col items-center gap-2">
                      <span style={{ color: 'var(--ui-text-muted)' }}>
                        <TerminalIcon className="w-4 h-4" />
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>正在准备提示词...</span>
                    </div>
                  )}

                  {frame.status === 'pending' && (
                    <span className="text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>待生成</span>
                  )}
                </div>
              )}
            </div>

            {frame.status === 'completed' && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {frame.metadata && (
                    <>
                      <span className="ui-tag">{frame.metadata.model.includes('pro') ? '高质量' : '快速预览'}</span>
                      {frame.metadata.variant && (
                        <span
                          className="ui-tag cursor-pointer"
                          title="复制完整提示词"
                          onClick={(e) => handleCopyPrompt(e, frame)}
                        >
                          {copiedId === frame.id ? '已复制完整提示词' : `${String(frame.metadata.variant).split('/')[0].substring(0, 10)}...`}
                        </span>
                      )}
                      {frame.metadata.curationStatus && frame.metadata.curationStatus !== 'pending' && (
                        <span className={`ui-tag ui-numeric ${frame.metadata.curationStatus === 'keep' ? 'ui-tag-success' : 'ui-tag-muted'}`}>
                          {frame.metadata.curationStatus === 'keep' ? '自动保留' : '自动剔除'}
                          {typeof frame.metadata.curationScore === 'number' ? ` ${frame.metadata.curationScore}` : ''}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <p className="text-[12px] leading-relaxed line-clamp-3 min-h-[4.5em]" style={{ color: 'var(--ui-text-secondary)' }}>
                  {frame.description}
                </p>

                <div className="pt-2 flex items-center justify-between border-t" style={{ borderColor: 'var(--ui-border)' }}>
                  <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--ui-text-muted)' }}>
                    {frame.metadata?.model.includes('pro') ? '高质量' : '预览'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopyPrompt(e, frame)}
                      className="flex items-center justify-center p-1.5 rounded-full transition-colors ui-btn-link"
                      title="复制完整提示词"
                    >
                      <TerminalIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleProDownload(e, frame.imageUrl!, frame.id)}
                      disabled={downloadingId === frame.id}
                      className="ui-btn-secondary ui-btn-compact px-3"
                    >
                      {downloadingId === frame.id ? (
                        '下载中...'
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <DownloadIcon className="w-3.5 h-3.5" />
                          下载图片
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedFrame && selectedIndex !== null && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex flex-col" onClick={closeLightbox}>
          <div className="flex-none ui-header-h ui-header-pad flex items-center justify-between z-50 border-b border-white/20 bg-black/35">
            <div className="text-white/90 font-mono text-xs tracking-wide flex items-center gap-4">
              <span>
                帧 {String(selectedIndex + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}
              </span>
              <button onClick={(e) => handleCopyPrompt(e, selectedFrame)} className="flex items-center gap-2 hover:text-white">
                <TerminalIcon className="w-3 h-3" />
                <span className="hidden sm:inline">{copiedId === selectedFrame.id ? '已复制完整提示词' : '复制完整提示词'}</span>
              </button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="p-2 text-white/90 hover:text-white">
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex items-start justify-center relative w-full p-2 md:p-3 overflow-hidden">
            {selectedIndex > 0 && (
              <button onClick={handlePrev} className="absolute left-4 z-40 p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60">
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
            )}
            <div
              className={`relative transition-transform duration-300 flex items-start justify-center h-full w-full ${
                isZoomed ? 'scale-125 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(!isZoomed);
              }}
            >
              <img src={selectedFrame.imageUrl} className="max-h-[calc(100vh-9.25rem)] max-w-full object-contain rounded self-start" draggable={false} />
            </div>
            {selectedIndex < frames.length - 1 && (
              <button onClick={handleNext} className="absolute right-4 z-40 p-2.5 rounded-full bg-black/40 text-white hover:bg-black/60">
                <ChevronRightIcon className="w-6 h-6" />
              </button>
            )}
          </div>

          <div
            className="flex-none p-4 z-40"
            style={{ borderTop: '1px solid var(--ui-border-strong)', background: 'var(--ui-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ui-lightbox-body mx-auto flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
              <div className="flex-1 w-full">
                <p className="text-sm md:text-base leading-relaxed mb-2 select-text" style={{ color: 'var(--ui-text-primary)' }}>
                  {selectedFrame.description}
                </p>
                <div className="flex gap-4 text-[10px] font-mono uppercase" style={{ color: 'var(--ui-text-muted)' }}>
                  <span>模型：{selectedFrame.metadata?.model}</span>
                  <span>风格：{selectedFrame.metadata?.variant?.substring(0, 20)}...</span>
                </div>
              </div>
              <button
                onClick={(e) => handleProDownload(e, selectedFrame.imageUrl!, selectedFrame.id)}
                className="ui-btn-primary w-full md:w-auto px-6"
              >
                <span className="inline-flex items-center gap-2">
                  <DownloadIcon className="w-4 h-4" />
                  下载原图
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
