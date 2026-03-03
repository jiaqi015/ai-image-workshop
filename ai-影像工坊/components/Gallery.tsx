
import React, { useState, useEffect, useCallback } from 'react';
import { Frame, ShootPlan, FrameMetadata } from '../types';
import { DownloadIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, TerminalIcon } from './Icons';
import { constructFullPrompt } from '../services/public'; // Updated Import Source

interface GalleryProps {
  frames: Frame[];
  plan?: ShootPlan | null; // 传入 Plan 以便重建完整 Prompt
  onRetryFrame?: (frameId: number) => void;
  retryingFrameIds?: number[];
}

export const Gallery: React.FC<GalleryProps> = ({ frames, plan, onRetryFrame, retryingFrameIds = [] }) => {
  // --- 状态管理 ---
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null); // 灯箱中当前查看的图片索引
  const [isZoomed, setIsZoomed] = useState(false); // 是否处于放大查看模式
  const [downloadingId, setDownloadingId] = useState<number | null>(null); // 下载状态反馈
  const [copiedId, setCopiedId] = useState<number | null>(null); // 复制状态反馈

  // 关闭灯箱
  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
    setIsZoomed(false);
  }, []);

  // --- 导航逻辑 (上一张/下一张) ---
  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsZoomed(false);
    setSelectedIndex((prev) => 
      prev !== null && prev > 0 ? prev - 1 : prev
    );
  }, []);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsZoomed(false);
    setSelectedIndex((prev) => 
      prev !== null && prev < frames.length - 1 ? prev + 1 : prev
    );
  }, [frames.length]);

  // --- 键盘事件监听 ---
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
    if (selectedIndex !== null) {
      document.body.style.overflow = 'hidden'; // 打开灯箱时禁止背景滚动
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [selectedIndex, frames.length, closeLightbox, handlePrev, handleNext]);

  // 打开灯箱
  const openLightbox = (index: number) => {
    if (frames[index].status === 'completed' && frames[index].imageUrl) {
      setSelectedIndex(index);
    }
  };

  // --- 专业级导出逻辑 (Studio Grade Export - Robust Version) ---
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
        console.error("下载失败:", err);
        window.open(url, '_blank');
    } finally {
        setDownloadingId(null);
    }
  };

  // --- 资产化逻辑：复制 Prompt 配方 ---
  const handleCopyPrompt = (e: React.MouseEvent, frame: Frame) => {
      e.stopPropagation();
      let text = "";
      
      // 如果有 Plan，则重建完整的 Prompt (包含人物、场景、负面词等)
      if (plan) {
         const fallbackMetadata: FrameMetadata = {
             model: '未标注',
             provider: '未标注',
             strategy: '未标注',
             resolution: '未标注'
         };
         text = constructFullPrompt(plan, frame.description, frame.metadata || fallbackMetadata);
      } else {
         // 降级：只复制当前描述
         text = `[画面描述] ${frame.description}\n[模型] ${frame.metadata?.model}\n[风格] ${frame.metadata?.variant}`;
      }
      
      navigator.clipboard.writeText(text);
      setCopiedId(frame.id);
      setTimeout(() => setCopiedId(null), 1500);
  };

  const selectedFrame = selectedIndex !== null ? frames[selectedIndex] : null;

  return (
    <>
      {/* 网格视图 (Grid View) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 pb-20 md:pb-0">
        {frames.map((frame, index) => {
          return (
          <div key={frame.id} className="flex flex-col gap-4 group">
            
            {/* 图片容器 */}
            <div 
              className={`relative aspect-[3/4] bg-[var(--ui-surface)] rounded-lg overflow-hidden border border-white/5 shadow-lg transition-all duration-500 ${
                frame.status === 'completed' ? 'cursor-pointer hover:border-zinc-500/50 hover:shadow-2xl' : ''
              }`}
              onClick={() => openLightbox(index)}
            >
              
              {/* 角标: 状态/ID */}
              <div className="absolute top-3 left-3 z-20 pointer-events-none flex gap-2">
                    <div className="px-2 py-1 bg-black/40 backdrop-blur-md border border-white/10 text-[10px] text-zinc-200 rounded font-mono tracking-wider">
                        #{String(frame.id).padStart(2, '0')}
                    </div>
              </div>

              {/* 悬停放大图标 */}
              {frame.status === 'completed' && (
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-none">
                  <div className="bg-white/10 p-3 rounded-full backdrop-blur-md border border-white/20">
                     <ZoomInIcon className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}

              {/* 主要内容区 */}
              {frame.status === 'completed' && frame.imageUrl ? (
                <img 
                  src={frame.imageUrl} 
                  alt={frame.description} 
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-[var(--ui-surface)] ${frame.status === 'generating' ? 'bg-grain' : ''}`}>
                  
                  {/* GENERATING STATE ANIMATION */}
                  {frame.status === 'generating' && (
                    <>
                       <div className="absolute inset-0 bg-sky-900/5 mix-blend-overlay"></div>
                       <div className="absolute inset-0 animate-film-develop z-0 opacity-50 pointer-events-none"></div>
                       <div className="relative z-10 mb-6">
                           <div className="w-12 h-12 rounded-full border-[3px] border-zinc-800 border-t-sky-500/80 animate-spin"></div>
                           <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-sky-500 rounded-full shadow-[0_0_12px_rgba(125,211,252,0.8)] animate-pulse"></div>
                           </div>
                       </div>
                       <div className="relative z-10 flex flex-col gap-2">
                           <span className="text-[10px] text-sky-500/90 font-mono uppercase tracking-[0.25em] animate-pulse font-bold">
                             生成中
                           </span>
                           <div className="flex items-center justify-center gap-1 opacity-50">
                               <span className="w-0.5 h-0.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                               <span className="w-0.5 h-0.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                               <span className="w-0.5 h-0.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                           </div>
                       </div>
                       <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-sky-500/20 to-transparent opacity-50 animate-pulse"></div>
                    </>
                  )}

                  {frame.status === 'failed' && (
                    <>
                      <span className="text-zinc-500 text-3xl mb-3 font-light">×</span>
                      <span className="text-[10px] text-zinc-400 font-mono uppercase tracking-widest">{frame.error || "生成失败"}</span>
                      {onRetryFrame && (
                        <button
                          type="button"
                          disabled={retryingFrameIds.includes(frame.id)}
                          onClick={(e) => { e.stopPropagation(); onRetryFrame(frame.id); }}
                          className="mt-3 text-[10px] px-3 py-1 rounded-full border border-zinc-400/30 text-zinc-300 hover:text-zinc-200 hover:border-zinc-300/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {retryingFrameIds.includes(frame.id) ? "重试中..." : "重新生成"}
                        </button>
                      )}
                    </>
                  )}

                  {frame.status === 'scripting' && (
                    <div className="flex flex-col items-center gap-3 animate-pulse opacity-60">
                        <TerminalIcon className="w-5 h-5 text-sky-500/80" />
                        <span className="text-[9px] text-sky-500/70 font-mono uppercase tracking-widest">
                            正在准备提示词...
                        </span>
                        <div className="w-8 h-0.5 bg-sky-500/20 rounded overflow-hidden">
                            <div className="h-full bg-sky-500/50 w-full animate-progress origin-left"></div>
                        </div>
                    </div>
                  )}

                  {frame.status === 'pending' && (
                    <div className="opacity-20 flex flex-col items-center">
                        <div className="w-8 h-8 border border-dashed border-zinc-600 rounded-sm mb-3"></div>
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">待生成</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 元数据与操作栏 */}
            {frame.status === 'completed' && (
               <div className="flex flex-col gap-2.5 px-1">
                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                     {frame.metadata && (
                       <>
                         <span className={`text-[10px] px-2 py-0.5 rounded border font-mono uppercase tracking-wide ${
                           frame.metadata.model.includes('pro') ? 'bg-sky-900/20 border-sky-500/20 text-sky-500' : 'bg-blue-900/20 border-blue-500/20 text-blue-400'
                         }`}>
                           {frame.metadata.model.includes('pro') ? '高质量' : '快速预览'}
                         </span>
                         {frame.metadata.variant && (
                             <span className="text-[10px] px-2 py-0.5 rounded border border-sky-500/10 bg-sky-500/5 text-sky-500 font-mono uppercase tracking-wide cursor-pointer hover:bg-sky-500/20" title="复制完整提示词" onClick={(e) => handleCopyPrompt(e, frame)}>
                                {copiedId === frame.id ? "已复制完整提示词" : String(frame.metadata.variant).split('/')[0].substring(0, 10) + "..."}
                             </span>
                         )}
                         {frame.metadata.curationStatus && frame.metadata.curationStatus !== 'pending' && (
                             <span
                               className={`text-[10px] px-2 py-0.5 rounded border font-mono uppercase tracking-wide ${
                                 frame.metadata.curationStatus === 'keep'
                                   ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                   : 'bg-zinc-700/20 border-zinc-500/30 text-zinc-400'
                               }`}
                               title={frame.metadata.curationReason || '自动筛选结果'}
                             >
                               {frame.metadata.curationStatus === 'keep' ? '自动保留' : '自动剔除'}
                               {typeof frame.metadata.curationScore === 'number' ? ` ${frame.metadata.curationScore}` : ''}
                             </span>
                         )}
                       </>
                     )}
                  </div>

                  <p className="text-[11px] leading-relaxed line-clamp-3 min-h-[4.5em] transition-colors text-zinc-400 group-hover:text-zinc-200 font-light text-justify select-text">
                    {frame.description}
                  </p>

                  <div className="pt-2 flex items-center justify-between border-t border-white/5 mt-1">
                     <span className="text-[10px] text-zinc-600 font-mono tracking-wider uppercase">
                       {frame.metadata?.model.includes('pro') ? '高质量' : '预览'}
                     </span>
                     
                     <div className="flex items-center gap-1">
                        <button 
                           onClick={(e) => handleCopyPrompt(e, frame)}
                           className={`flex items-center justify-center p-1.5 rounded-full transition-colors ${copiedId === frame.id ? 'text-green-500 bg-green-500/10' : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'}`}
                           title="复制完整提示词"
                        >
                           <TerminalIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                         onClick={(e) => handleProDownload(e, frame.imageUrl!, frame.id)}
                         disabled={downloadingId === frame.id}
                         className={`flex items-center gap-1.5 transition-colors text-xs font-medium py-1.5 px-3 rounded-full ${downloadingId === frame.id ? 'text-zinc-600 bg-transparent cursor-wait' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                        >
                          {downloadingId === frame.id ? (
                              <span className="text-[10px]">下载中...</span>
                          ) : (
                              <>
                                  <DownloadIcon className="w-3.5 h-3.5" />
                                  下载 PNG
                              </>
                          )}
                        </button>
                     </div>
                  </div>
               </div>
            )}
          </div>
          );
        })}
      </div>

      {/* 灯箱模态框 (Lightbox Modal) */}
      {selectedFrame && selectedIndex !== null && (
        <div 
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300"
          onClick={closeLightbox}
        >
          {/* Top Bar */}
              <div className="flex-none h-16 flex items-center justify-between px-6 z-50 border-b border-white/5 bg-black/40">
                 <div className="text-zinc-400 font-mono text-xs tracking-widest flex items-center gap-4">
                <span>帧 {String(selectedIndex + 1).padStart(2, '0')} / {String(frames.length).padStart(2, '0')}</span>
                <span className="w-px h-3 bg-zinc-700"></span>
                <button 
                    onClick={(e) => handleCopyPrompt(e, selectedFrame)}
                    className="flex items-center gap-2 hover:text-sky-500 transition-colors"
                >
                    <TerminalIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">{copiedId === selectedFrame.id ? "已复制完整提示词" : "复制完整提示词"}</span>
                </button>
             </div>
             <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} className="p-2 hover:bg-white/10 rounded-full text-white"><XIcon className="w-5 h-5" /></button>
          </div>

          {/* Main Image */}
          <div className="flex-1 min-h-0 flex items-center justify-center relative w-full p-4 overflow-hidden">
             {selectedIndex > 0 && (
               <button onClick={handlePrev} className="absolute left-4 z-40 p-3 rounded-full bg-black/40 text-white hover:bg-white/10 border border-white/10 backdrop-blur-md">
                 <ChevronLeftIcon className="w-6 h-6" />
               </button>
             )}
             <div 
                className={`relative transition-transform duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) flex items-center justify-center h-full w-full ${isZoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'}`}
                onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }}
             >
                <img src={selectedFrame.imageUrl} className="max-h-full max-w-full object-contain shadow-2xl rounded" draggable={false} />
             </div>
             {selectedIndex < frames.length - 1 && (
               <button onClick={handleNext} className="absolute right-4 z-40 p-3 rounded-full bg-black/40 text-white hover:bg-white/10 border border-white/10 backdrop-blur-md">
                 <ChevronRightIcon className="w-6 h-6" />
               </button>
             )}
          </div>

          {/* Bottom Bar */}
          <div className="flex-none p-6 border-t border-white/10 bg-[var(--ui-surface)] z-40" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 justify-between items-end md:items-center">
               <div className="flex-1 w-full">
                 <p className="text-zinc-100 text-sm md:text-base leading-relaxed font-light mb-3 font-serif line-clamp-3 md:line-clamp-none select-text">{selectedFrame.description}</p>
                 <div className="flex gap-4 text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                    <span>模型：{selectedFrame.metadata?.model}</span>
                    <span>•</span>
                    <span>风格：{selectedFrame.metadata?.variant?.substring(0, 20)}...</span>
                 </div>
               </div>
               <button 
                  onClick={(e) => handleProDownload(e, selectedFrame.imageUrl!, selectedFrame.id)}
                  className="w-full md:w-auto px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
               >
                  <DownloadIcon className="w-4 h-4" />
                  下载原图
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
