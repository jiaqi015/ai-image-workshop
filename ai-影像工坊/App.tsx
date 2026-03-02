import React from 'react';
import { CameraIcon, SparklesIcon, FilmIcon, RefreshIcon, SettingsIcon, ClockIcon, ActivityIcon, XIcon, MicIcon, DiceIcon, ZoomInIcon } from './components/Icons';
import { ContractCard } from './components/ContractCard';
import { Gallery } from './components/Gallery';
import { HistorySidebar } from './components/HistorySidebar';
import { ConsoleLog } from './components/ConsoleLog';
import { DirectorThinking } from './components/DirectorThinking'; 
import { ShootStrategy, AppState, DirectorModel } from './types';
import { useStudioArchitect } from './hooks/useStudioArchitect';

/**
 * ============================================================================
 * 组件: App (Root View)
 * 职责: 
 * 1. 纯视图层 (Pure View) - 不包含业务逻辑，逻辑全权委托给 useStudioArchitect。
 * 2. 布局管理 - 负责 Header, Sidebar, Main Content 的网格布局。
 * 3. 模态框渲染 - 负责全局弹窗 (Settings, Preview) 的挂载。
 * ============================================================================
 */
export default function App() {
  // 核心架构师 Hook：接管所有状态、副作用和业务流程
  const studio = useStudioArchitect();

  // 导演模型切换逻辑
  const cycleDirectorModel = () => {
      const models: DirectorModel[] = ['gemini', 'gpt-5.1', 'gpt-5.2'];
      const currentIndex = models.indexOf(studio.directorModel);
      const nextIndex = (currentIndex + 1) % models.length;
      studio.setDirectorModel(models[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-[#0f0f12] text-zinc-100 flex overflow-hidden font-sans selection:bg-amber-500/30">
      
      {/* --- 侧边栏: 历史记录 (History Archive) --- */}
      <HistorySidebar 
        isOpen={studio.isHistoryOpen} 
        history={studio.history} 
        onClose={() => studio.setIsHistoryOpen(false)} 
        onSelect={studio.restoreSession} 
        onDelete={studio.deleteHistoryItem} 
      />
      
      {/* --- 模态框: 图片大图预览 (Image Lightbox) --- */}
      {studio.conceptPreviewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200" onClick={() => studio.setConceptPreviewUrl(null)}>
            <button className="absolute top-4 right-4 p-2 text-white/50 hover:text-white transition-colors">
                <XIcon className="w-8 h-8" />
            </button>
            <img src={studio.conceptPreviewUrl} className="max-h-full max-w-full object-contain shadow-2xl rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      
      {/* --- 模态框: API 设置与连接 (Settings Modal) --- */}
      {studio.showSettingsModal && (
         <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-[#0f0f12] border border-white/10 p-8 rounded-lg w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95">
                 <div className="flex justify-between items-center mb-6">
                     <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-300">通道配置 API Settings</h3>
                     <button onClick={() => studio.setShowSettingsModal(false)} className="text-zinc-500 hover:text-white"><XIcon className="w-5 h-5"/></button>
                 </div>
                 <form onSubmit={studio.handleManualKeySubmit} className="flex flex-col gap-4">
                     <div className="flex flex-col gap-2">
                         <label className="text-[10px] text-zinc-500 uppercase font-mono">Gemini API Key / Proxy Key</label>
                         <div className="relative">
                            <input type="text" className="w-full bg-black/20 border border-white/10 p-3 rounded text-sm text-white focus:outline-none focus:border-amber-500/50 font-mono" placeholder="sk-..." value={studio.manualKeyInput} onChange={(e) => studio.setManualKeyInput(e.target.value)} />
                            <button type="button" onClick={studio.handleAutoFillKey} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 hover:text-amber-400 px-2 py-1 bg-amber-500/10 rounded">填入测试卡</button>
                         </div>
                     </div>
                     <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-white/5">
                         <button type="button" onClick={studio.handleClearKey} className="px-4 py-2 text-xs text-zinc-500 hover:text-red-400 uppercase tracking-wide">清除配置 (Clear)</button>
                         <button type="submit" className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wide rounded">{studio.isValidating ? '验证中...' : '保存 & 连接'}</button>
                     </div>
                 </form>
                 {studio.validationLogs.length > 0 && (<div className="w-full text-left font-mono mt-4 p-3 bg-black/40 rounded">{studio.validationLogs.map((log, i) => (<div key={i} className="text-[10px] text-zinc-400 mb-1">{log}</div>))}</div>)}
             </div>
        </div>
      )}

      {/* --- 主布局容器 (Main Layout) --- */}
      <div className="flex-1 flex flex-col h-screen">
        
        {/* === Header === */}
        <header className="h-20 border-b border-white/5 bg-[#0f0f12]/95 backdrop-blur-sm flex items-center justify-between px-8 z-30 flex-shrink-0 transition-all">
           {/* Left: Logo & Status */}
           <div className="flex items-center gap-12">
             <div className="flex items-center gap-4 text-zinc-100 opacity-90 hover:opacity-100 transition-opacity cursor-default" onClick={() => studio.setIsHistoryOpen(true)}>
                <div className="bg-zinc-800/50 p-2 rounded-lg border border-white/5 hover:bg-zinc-700/50 transition-colors cursor-pointer"><CameraIcon className="w-5 h-5" /></div>
                <span className="font-serif tracking-[0.15em] text-lg cursor-pointer">影像工坊</span>
             </div>
             
             {/* Workflow Progress Indicator */}
             <div className="hidden xl:flex items-center gap-8 text-xs tracking-[0.2em] text-zinc-500 font-medium">
                <div className={`transition-all duration-500 flex flex-col ${studio.appState === AppState.PLANNING ? 'text-amber-500 scale-105' : 'opacity-50'}`}><span>前期筹备</span><span className="text-[8px] opacity-60 font-serif mt-0.5">PRE-PRODUCTION</span></div>
                <div className="w-8 h-px bg-zinc-800"></div>
                <div className={`transition-all duration-500 flex flex-col ${studio.appState === AppState.CONCEPT ? 'text-amber-500 scale-105' : 'opacity-50'}`}><span>视觉定调</span><span className="text-[8px] opacity-60 font-serif mt-0.5">ART DIRECTION</span></div>
                <div className="w-8 h-px bg-zinc-800"></div>
                <div className={`transition-all duration-500 flex flex-col ${studio.appState === AppState.SHOOTING ? 'text-white scale-105' : 'opacity-50'}`}><span>正片拍摄</span><span className="text-[8px] opacity-60 font-serif mt-0.5">PRINCIPAL PHOTOGRAPHY</span></div>
             </div>

             {/* Connection Status */}
             <div className="hidden lg:flex flex-col ml-8 pl-8 border-l border-zinc-800/50 justify-center h-10">
                <span className="text-[10px] uppercase text-zinc-500 tracking-widest mb-1">通道状态 Status</span>
                <button onClick={studio.handleToggleConnectionMode} className={`text-xs font-mono tracking-wide hover:text-white transition-colors text-left flex items-center gap-2 ${studio.connectionMode.mode === 'proxy' ? 'text-amber-500' : 'text-blue-400'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentColor] ${studio.connectionMode.mode === 'proxy' ? 'bg-amber-500' : 'bg-blue-400'}`}></div>
                    {studio.connectionMode.label}
                </button>
             </div>

             {/* Stats (Render Time / Active Requests) */}
             {studio.appState === AppState.SHOOTING && (
                <div className="hidden md:flex items-center gap-6 ml-8 animate-in fade-in slide-in-from-left-4 text-zinc-400">
                    <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5"><ClockIcon className="w-3.5 h-3.5" /><span className="text-xs font-mono">{(studio.elapsedTime / 1000).toFixed(1)}s</span></div>
                    <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-white/5"><ActivityIcon className="w-3.5 h-3.5" /><span className="text-xs font-mono">{studio.activeRequests} 渲染中</span></div>
                </div>
             )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-4">
             {studio.appState !== AppState.IDLE && (
                 <button onClick={studio.handleReset} className="group flex items-center gap-2 px-4 py-2 rounded-full hover:bg-zinc-800/80 transition-all text-zinc-400 hover:text-white border border-transparent hover:border-white/5">
                    <RefreshIcon className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" /><span className="text-xs tracking-wide font-medium hidden sm:inline">重置</span>
                 </button>
             )}
             <div className="h-6 w-px bg-zinc-800 mx-2"></div>
             <button onClick={studio.handleOpenSettings} className={`p-2.5 rounded-full hover:bg-zinc-800 transition-all ${studio.showSettingsModal ? 'text-amber-500 bg-zinc-800' : 'text-zinc-400'}`} title="Settings">
                <SettingsIcon className="w-5 h-5" />
             </button>
          </div>
        </header>
        
        {/* === Viewport === */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* --- Scene 1: Landing Page (Input) --- */}
          {studio.appState === AppState.IDLE && !studio.plan && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
               <div className="w-full max-w-3xl flex flex-col items-center">
                 <h1 className="text-4xl md:text-5xl font-light text-center mb-10 tracking-[0.1em] text-white font-serif leading-tight">让大师摄影<span className="text-amber-500/90 italic ml-3 font-serif">变得简单</span></h1>
                 
                 {/* Input Box */}
                 <div className="w-full relative group mb-12">
                   <div className="absolute -inset-1 bg-gradient-to-b from-zinc-800 to-transparent opacity-0 group-hover:opacity-20 transition duration-1000 rounded-xl blur-3xl"></div>
                   <div className="relative bg-[#0c0c0e] rounded-xl border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all group-hover:border-zinc-700/50">
                      {/* Clear Button (New) */}
                      {studio.userInput && (
                          <button onClick={studio.handleClearInput} className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-zinc-300 transition-colors z-30" title="清空输入">
                              <XIcon className="w-4 h-4" />
                          </button>
                      )}
                      
                      <textarea className="w-full bg-transparent p-8 text-lg text-zinc-200 placeholder-zinc-600 focus:outline-none resize-none font-light custom-scrollbar leading-relaxed min-h-[180px]" rows={6} placeholder="描述您的镜头语言...&#10;&#10;例如：王家卫式美学，90年代香港电影质感。&#10;一名穿着墨绿色丝绒旗袍的女性，站在霓虹招牌下的阴影里。&#10;眼神疏离，黑发红唇，手中拿着一支未点燃的香烟。&#10;强烈的色彩张力，浅景深，胶片颗粒感，情绪暧昧..." value={studio.userInput} onChange={(e) => studio.setUserInput(e.target.value)} onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault(); studio.handleStartPlanning();}}} />
                      
                      <button 
                        onClick={studio.handleRandomPrompt} 
                        disabled={studio.isGeneratingRandom}
                        className={`absolute left-8 bottom-24 p-2 rounded-full transition-all duration-300 z-20 bg-black/20 hover:bg-black/40 ${studio.isGeneratingRandom ? 'text-amber-500 cursor-not-allowed' : 'text-zinc-500 hover:text-amber-500 hover:rotate-180'}`} 
                        title="大师灵感 (AI Powered)"
                      >
                         {studio.isGeneratingRandom ? (
                             <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                         ) : (
                             <DiceIcon className="w-5 h-5" />
                         )}
                      </button>
                      <button onClick={studio.handleVoiceInput} className={`absolute right-8 bottom-24 p-2 rounded-full transition-all duration-300 z-20 ${studio.isListening ? 'bg-amber-600 text-white animate-pulse' : 'text-zinc-500 hover:text-amber-500 bg-black/20 hover:bg-black/40'}`} title="语音输入"><MicIcon className="w-5 h-5" /></button>
                      
                      {/* Control Bar */}
                      <div className="px-8 py-5 border-t border-white/5 flex flex-col md:flex-row gap-6 justify-between items-center bg-black/20 backdrop-blur-sm">
                         <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                              {[{ id: 'pro', label: '电影级', sub: 'Cinema 4K', desc: 'Auto Fallback', active: studio.strategy === 'pro' }, { id: 'hybrid', label: '混合模式', sub: 'Dynamic', desc: 'Pro + Flash', active: studio.strategy === 'hybrid' }, { id: 'flash', label: '极速模式', sub: 'Flash', desc: 'High Speed', active: studio.strategy === 'flash' }].map((mode) => (
                                <button key={mode.id} onClick={() => studio.setStrategy(mode.id as ShootStrategy)} className={`flex-1 md:flex-none px-5 py-3 rounded-lg transition-all duration-300 flex flex-col items-start min-w-[130px] border relative overflow-hidden group/btn ${mode.active ? 'bg-zinc-800/80 border-zinc-600 text-zinc-100 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5 text-zinc-500 hover:text-zinc-300'}`}>
                                    <span className="text-xs font-bold tracking-widest uppercase mb-1 z-10">{mode.label}</span>
                                    <div className="flex items-center justify-between w-full z-10"><span className={`text-[10px] font-mono ${mode.active ? 'text-zinc-300' : 'text-zinc-600'}`}>{mode.sub}</span></div>
                                    {mode.active && <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 w-full animate-in slide-in-from-left duration-500"></div>}
                                </button>
                              ))}
                         </div>
                         <div className="hidden md:flex flex-col items-end gap-1.5 text-[10px] text-zinc-500 font-mono tracking-wider">
                             <div className="flex items-center gap-2"><div className={`w-1.5 h-1.5 rounded-full ${studio.keyConfigured ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div><span>影棚就绪 STUDIO READY</span></div>
                             <button 
                                onClick={cycleDirectorModel} 
                                className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer group"
                                title="点击切换导演模型 / Click to Switch Model"
                             >
                                <span className="text-[9px] uppercase group-hover:text-zinc-300">Director:</span>
                                <span className={`text-[9px] font-bold ${studio.directorModel.startsWith('gpt') ? 'text-amber-500' : 'text-blue-400'}`}>
                                    {studio.directorModel === 'gemini' ? 'GEMINI 2.5' : studio.directorModel.toUpperCase()}
                                </span>
                             </button>
                         </div>
                      </div>
                   </div>
                 </div>
                 <button onClick={studio.handleStartPlanning} disabled={studio.appState !== AppState.IDLE || !studio.userInput.trim()} className="group relative px-32 py-5 bg-zinc-100 text-black hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_50px_rgba(255,255,255,0.2)] rounded-full overflow-hidden">
                    <div className="flex items-center gap-3 relative z-10"><span className="text-sm font-bold tracking-[0.25em] uppercase">生成拍摄计划</span></div>
                 </button>
               </div>
            </div>
          )}
          
          {/* --- Scene 2 & 3: Workspace (Planning / Concept / Shooting) --- */}
          {(studio.appState !== AppState.IDLE || studio.plan) && (
             <div className="flex h-full">
                {/* Left Panel: Contract & Logs */}
                <div className="w-96 2xl:w-[28rem] border-r border-white/5 bg-[#0c0c0e] hidden md:flex flex-col flex-shrink-0 z-20 transition-all duration-300 shadow-2xl">
                   <div className="flex-1 p-8 overflow-hidden">
                      {studio.appState === AppState.PLANNING && !studio.plan ? ( <DirectorThinking text={studio.streamingPlanText} /> ) : ( studio.plan && <ContractCard contract={studio.plan.contract} title={studio.plan.title} directorInsight={studio.plan.directorInsight} productionNotes={studio.plan.productionNotes} shootGuide={studio.plan.shootGuide} shootScope={studio.plan.shootScope} continuity={studio.plan.continuity} conceptFrames={studio.plan.conceptFrames} selectedConceptId={studio.plan.selectedConceptId} visualReferenceImageUrl={studio.selectedConceptUrl} onSelectConcept={studio.handleSelectSidebarConcept} onGenerateMore={() => studio.handleGenerateMore(20)} isExtending={studio.isExtending} onPreviewConcept={(url) => studio.setConceptPreviewUrl(url)} /> )}
                   </div>
                   <div className="h-64 flex-shrink-0 border-t border-white/5"><ConsoleLog logs={studio.logs} /></div>
                </div>

                {/* Right Panel: Main Stage */}
                <div ref={studio.mainContentRef} className="flex-1 bg-[#09090b] overflow-y-auto custom-scrollbar relative p-8 md:p-12 flex flex-col">
                   
                   {/* Stage A: Visual Concept Selection */}
                   {studio.appState === AppState.CONCEPT && (
                      <>
                          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700 py-10 pb-24">
                              <div className="max-w-7xl w-full flex flex-col gap-12">
                                  {/* Section Title */}
                                  <div className="text-center mb-8 relative">
                                      <div className="inline-block px-3 py-1 border border-white/10 rounded-full text-[10px] text-zinc-500 font-mono tracking-widest uppercase mb-4">第一阶段：视觉定调</div>
                                      <div className="flex items-center justify-center gap-4">
                                          <h2 className="text-3xl font-serif text-zinc-100 mb-4 tracking-widest">十二种可能的现实</h2>
                                          <button onClick={studio.handleExpandUniverse} disabled={studio.isExpandingUniverse} className="mb-3 px-3 py-1.5 border border-dashed border-zinc-700 hover:border-amber-500 text-zinc-500 hover:text-amber-500 rounded text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all disabled:opacity-50" title="Expand Parallel Universes">
                                              {studio.isExpandingUniverse ? <div className="w-3 h-3 border border-current border-t-transparent animate-spin rounded-full"></div> : <SparklesIcon className="w-3 h-3" />}
                                              {studio.isExpandingUniverse ? '探测中...' : '探测更多时空 (+6)'}
                                          </button>
                                      </div>
                                      <p className="text-zinc-400 font-light text-sm tracking-wide max-w-2xl mx-auto leading-relaxed">我们在平行时空中捕捉到了不同的光影切片。请凭借<span className="text-amber-500 font-bold mx-1">导演的直觉</span>，裁定本场戏的视觉基调。</p>
                                  </div>

                                  {/* Concept Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 px-4">
                                    {studio.frames.map((proposalFrame, index) => {
                                        const isSelected = studio.selectedProposalId === proposalFrame.id;
                                        const variantType = proposalFrame.metadata?.variantType;
                                        return (
                                        <div key={proposalFrame.id} className={`flex flex-col gap-5 group relative transition-all duration-300 ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}>
                                            <div className={`relative aspect-[3/4] bg-[#0c0c0e] rounded-lg overflow-hidden border shadow-2xl transition-all duration-500 cursor-pointer ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.2)]' : proposalFrame.status === 'generating' ? 'border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : 'border-white/5 hover:border-zinc-500/50 hover:shadow-zinc-900/50 opacity-80 hover:opacity-100'}`} onClick={() => studio.setSelectedProposalId(proposalFrame.id)}>
                                                {/* Header Labels */}
                                                <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10 pointer-events-none">
                                                     <span className={`text-[10px] font-mono tracking-widest px-2 py-1 backdrop-blur-md rounded border transition-colors ${isSelected ? 'bg-amber-500 text-black border-amber-500 font-bold' : 'bg-black/60 text-white/90 border-white/10'}`}>方案 {String.fromCharCode(65 + (index % 26))} {isSelected && "✓"}</span>
                                                     {variantType && (<span className={`text-[9px] tracking-widest px-2 py-1 backdrop-blur-md rounded border font-serif ${variantType === 'strict' ? 'bg-blue-900/40 text-blue-200 border-blue-500/30' : variantType === 'creative' ? 'bg-purple-900/40 text-purple-200 border-purple-500/30' : 'bg-zinc-800/40 text-zinc-300 border-zinc-500/30'}`}>{variantType === 'strict' ? '忠实复刻' : variantType === 'creative' ? '艺术变奏' : '风格渲染'}</span>)}
                                                </div>
                                                
                                                {/* Zoom Button */}
                                                {proposalFrame.status === 'completed' && proposalFrame.imageUrl && ( <button onClick={(e) => { e.stopPropagation(); studio.setConceptPreviewUrl(proposalFrame.imageUrl!); }} className="absolute top-14 right-4 p-2 bg-black/40 hover:bg-white/10 rounded-full text-white/50 hover:text-white border border-white/10 backdrop-blur-md transition-all z-20 opacity-0 group-hover:opacity-100" title="放大检视"><ZoomInIcon className="w-4 h-4" /></button> )}
                                                
                                                {/* Main Image State */}
                                                {proposalFrame.status === 'completed' && proposalFrame.imageUrl ? ( 
                                                    <>
                                                        <img src={proposalFrame.imageUrl} className={`w-full h-full object-cover transition-all duration-700 ${isSelected ? 'grayscale-0' : 'grayscale-[20%] group-hover:grayscale-0'}`} alt={`Proposal ${index}`} />
                                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                                                    </> 
                                                ) : ( 
                                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#08080a] relative overflow-hidden bg-grain">
                                                        {proposalFrame.status === 'generating' && (<div className="absolute inset-0 animate-film-develop"></div>)}
                                                        {proposalFrame.status === 'failed' ? (
                                                            <div className="text-zinc-500 flex flex-col items-center gap-3 relative z-10"><span className="text-2xl">✕</span><span className="text-xs uppercase tracking-widest">生成中断</span></div>
                                                        ) : proposalFrame.status === 'generating' ? (
                                                            <div className="flex flex-col items-center gap-6 relative z-10 w-full px-8">
                                                                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-amber-500 animate-progress"></div></div>
                                                                <span className="text-[10px] text-zinc-500 font-mono tracking-widest animate-pulse">正在渲染方案...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div></div>
                                                        )}
                                                    </div> 
                                                )}
                                                
                                                {/* Footer Text */}
                                                <div className="absolute bottom-0 left-0 right-0 p-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                                    <p className="text-[10px] text-zinc-300 bg-black/60 backdrop-blur-md p-2 rounded border border-white/10 line-clamp-3">{proposalFrame.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                  </div>
                              </div>
                          </div>
                          {/* Floating Action Button */}
                          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out transform translate-y-0">
                               <button onClick={studio.handleConfirmShoot} disabled={studio.selectedProposalId === null} className={`group relative px-10 py-4 rounded-full font-bold tracking-[0.2em] uppercase text-xs shadow-2xl flex items-center gap-3 transition-all duration-300 ${studio.selectedProposalId !== null ? 'bg-amber-600 hover:bg-amber-500 text-white hover:scale-105 hover:shadow-[0_0_40px_rgba(245,158,11,0.4)]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5'}`}>
                                 {studio.selectedProposalId !== null ? ( <><span className="relative z-10">锁定方案 & 开机</span><div className="relative z-10 bg-white/20 p-1 rounded-full"><CameraIcon className="w-4 h-4" /></div><div className="absolute inset-0 rounded-full border border-white/20 scale-110 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500"></div></> ) : ( <span>请先选择一种视觉风格</span> )}
                               </button>
                          </div>
                      </>
                   )}
                   
                   {/* Stage B: Principal Photography (Gallery) */}
                   {studio.appState === AppState.SHOOTING && ( <Gallery frames={studio.frames} plan={studio.plan} /> )}
                </div>
             </div>
          )}
        </div>
      </div>
    </div>
    );
  }
