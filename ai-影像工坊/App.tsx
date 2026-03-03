import React from 'react';
import {
  SparklesIcon,
  RefreshIcon,
  XIcon,
  MicIcon,
  DiceIcon,
  SettingsIcon,
} from './components/Icons';
import { HistorySidebar } from './components/HistorySidebar';
import { BrandLogo } from './components/BrandLogo';
import { ShootStrategy, AppState } from './types';
import { useStudioArchitect } from './hooks/useStudioArchitect';
import { PlanningWorkspace } from './modules/planning/PlanningWorkspace';

const STRATEGY_OPTIONS: Array<{ id: ShootStrategy; label: string; sub: string }> = [
  { id: 'hybrid', label: '自动模式', sub: '智能平衡（推荐）' },
  { id: 'pro', label: '电影级', sub: '画质优先' },
];

const QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: '霓虹夜街',
    prompt: '雨夜的香港旧街道，主角站在霓虹灯牌下，50mm，胶片颗粒，冷暖反差强烈，电影感特写。',
  },
  {
    label: '纪录片访谈',
    prompt: '纪录片访谈场景，靠窗自然光，浅景深，人物三分构图，色彩克制，细节真实。',
  },
  {
    label: '品牌大片',
    prompt: '高端运动品牌主视觉，广角低机位，动态追焦，强对比光影，海报级商业质感。',
  },
  {
    label: '赛博城市',
    prompt: '赛博朋克高架桥夜景，潮湿路面反光，远景车流光轨，空气雾化，沉浸式未来感。',
  },
];

export default function App() {
  const studio = useStudioArchitect();
  const catalog = studio.availableModels;

  const providerLabel = (provider: string) => {
    switch (provider) {
      case 'openai':
        return 'OpenAI';
      case 'google':
        return 'Google';
      case 'ali':
        return '阿里';
      case 'byte':
        return '字节';
      case 'minimax':
        return 'MiniMax';
      case 'zhipu':
        return '智谱';
      default:
        return provider || '未知厂商';
    }
  };

  const textModelsByProvider: Record<string, string[]> = catalog?.textModelsByProvider || {};
  const imageModelsByProvider: Record<string, string[]> = catalog?.imageModelsByProvider || {};
  const providerByModel: Record<string, string> = catalog?.providerByModel || {};
  const providerStatus: Record<string, { enabled?: boolean; configured?: boolean; validated?: boolean; ready?: boolean }> =
    catalog?.providers || {};

  const resolveProviderFromGroups = (model: string, groups: Record<string, string[]>) => {
    for (const [provider, models] of Object.entries(groups)) {
      if (Array.isArray(models) && models.includes(model)) return provider;
    }
    return '';
  };

  const textProviderList = React.useMemo(() => {
    const ordered = Array.isArray(catalog?.providerOrder?.text) ? catalog.providerOrder.text : [];
    const keys = Object.keys(textModelsByProvider);
    const merged = [...ordered, ...keys.filter((p) => !ordered.includes(p))];
    return merged.filter((provider) => (textModelsByProvider[provider] || []).length > 0);
  }, [catalog, textModelsByProvider]);

  const imageProviderList = React.useMemo(() => {
    const ordered = Array.isArray(catalog?.providerOrder?.image) ? catalog.providerOrder.image : [];
    const keys = Object.keys(imageModelsByProvider);
    const merged = [...ordered, ...keys.filter((p) => !ordered.includes(p))];
    return merged.filter((provider) => (imageModelsByProvider[provider] || []).length > 0);
  }, [catalog, imageModelsByProvider]);

  const selectedTextProvider =
    providerByModel[studio.textModel] ||
    resolveProviderFromGroups(studio.textModel, textModelsByProvider) ||
    textProviderList[0] ||
    '';
  const selectedImageProvider =
    providerByModel[studio.imageModel] ||
    resolveProviderFromGroups(studio.imageModel, imageModelsByProvider) ||
    imageProviderList[0] ||
    '';

  const textModelOptions = selectedTextProvider
    ? textModelsByProvider[selectedTextProvider] || []
    : studio.availableModels.textModels || [];
  const imageModelOptions = selectedImageProvider
    ? imageModelsByProvider[selectedImageProvider] || []
    : studio.availableModels.imageModels || [];

  const providerOptionLabel = (provider: string) => {
    const label = providerLabel(provider);
    const status = providerStatus[provider];
    if (!status) return label;
    if (status.enabled === false) return `${label} (已禁用)`;
    if (status.validated || status.ready) return label;
    if (status.configured === false) return `${label} (未配置)`;
    return `${label} (待验证)`;
  };

  const frameStats = React.useMemo(
    () =>
      studio.frames.reduce(
        (acc, frame) => {
          acc[frame.status] += 1;
          return acc;
        },
        { scripting: 0, pending: 0, generating: 0, completed: 0, failed: 0 }
      ),
    [studio.frames]
  );

  const frameStatusSignature = `${frameStats.scripting}-${frameStats.pending}-${frameStats.generating}-${frameStats.completed}-${frameStats.failed}`;
  const isTaskBusy =
    studio.appState === AppState.PLANNING ||
    studio.appState === AppState.SHOOTING ||
    studio.activeRequests > 0 ||
    studio.isExtending ||
    studio.isExpandingUniverse ||
    studio.isGeneratingRandom;

  const activitySignalKey = [
    studio.appState,
    studio.logs.length,
    studio.activeRequests,
    studio.streamingPlanText.length,
    frameStatusSignature,
    studio.isExtending ? 1 : 0,
    studio.isExpandingUniverse ? 1 : 0,
    studio.isGeneratingRandom ? 1 : 0,
  ].join('|');

  const stageIndex =
    studio.appState === AppState.PLANNING ? 1 : studio.appState === AppState.CONCEPT ? 2 : studio.appState === AppState.SHOOTING ? 3 : 0;
  const stageMeta = [
    { id: 0, name: '需求输入', desc: '写下你要的画面' },
    { id: 1, name: '方案生成', desc: 'AI 解析并构思' },
    { id: 2, name: '视觉定调', desc: '选择一条风格线' },
    { id: 3, name: '正片拍摄', desc: '批量生成可交付图' },
  ];
  const isIdleLanding = studio.appState === AppState.IDLE && !studio.plan;

  const renderStrategySelector = (compact = false) => (
    <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
        {STRATEGY_OPTIONS.map((mode) => {
          const active = studio.strategy === mode.id;
          return (
          <button
            key={mode.id}
            type="button"
            onClick={() => studio.setStrategy(mode.id)}
            className={`rounded-lg border ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} text-left transition-colors ${
              active
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
            }`}
          >
            <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold tracking-wide`}>{mode.label}</div>
            {!compact && <div className="mt-1 text-[11px] text-zinc-500">{mode.sub}</div>}
          </button>
        );
      })}
    </div>
  );

  const renderModelSelectors = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] text-zinc-500 tracking-wide">文本厂商</label>
        <select
          className="h-9 rounded-md border border-white/10 bg-black/30 px-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
          value={selectedTextProvider}
          onChange={(e) => {
            const provider = e.target.value;
            const list = textModelsByProvider[provider] || [];
            if (list.length > 0) studio.setTextModel(list[0]);
          }}
        >
          {textProviderList.map((provider) => (
            <option key={provider} value={provider}>
              {providerOptionLabel(provider)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] text-zinc-500 tracking-wide">文本模型</label>
        <select
          className="h-9 rounded-md border border-white/10 bg-black/30 px-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50"
          value={studio.textModel}
          onChange={(e) => studio.setTextModel(e.target.value)}
        >
          {textModelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] text-zinc-500 tracking-wide">生图厂商</label>
        <select
          className="h-9 rounded-md border border-white/10 bg-black/30 px-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/50"
          value={selectedImageProvider}
          onChange={(e) => {
            const provider = e.target.value;
            const list = imageModelsByProvider[provider] || [];
            if (list.length > 0) studio.setImageModel(list[0]);
          }}
        >
          {imageProviderList.map((provider) => (
            <option key={provider} value={provider}>
              {providerOptionLabel(provider)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <label className="text-[11px] text-zinc-500 tracking-wide">生图模型</label>
        <select
          className="h-9 rounded-md border border-white/10 bg-black/30 px-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-amber-500/50"
          value={studio.imageModel}
          onChange={(e) => studio.setImageModel(e.target.value)}
        >
          {imageModelOptions.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderSettingsModal = () => (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f0f12] border border-white/10 p-6 rounded-lg w-full max-w-lg shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-bold tracking-widest text-zinc-300">连接设置</h3>
          <button onClick={() => studio.setShowSettingsModal(false)} className="text-zinc-500 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={studio.handleManualKeySubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] text-zinc-500 tracking-wide">网关访问令牌（可选）</label>
            <div className="relative">
              <input
                type="text"
                className="w-full bg-black/20 border border-white/10 p-3 rounded text-sm text-white focus:outline-none focus:border-amber-500/50 font-mono"
                placeholder="仅当后端启用 AI_GATEWAY_TOKEN 时需要填写"
                value={studio.manualKeyInput}
                onChange={(e) => studio.setManualKeyInput(e.target.value)}
              />
            </div>
            <div className="text-[10px] text-zinc-500">前端直连/代理模式已移除，所有请求统一走后端网关。</div>
          </div>

          {renderModelSelectors()}

          <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
            <div className="text-[11px] text-zinc-500 tracking-wide">高级设置</div>
            <button
              type="button"
              onClick={() => studio.setMasterMode(!studio.masterMode)}
              className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                studio.masterMode
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide">母版锁定</span>
                <span className="text-[10px] font-mono uppercase">{studio.masterMode ? 'ON' : 'OFF'}</span>
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">固定身份/风格/姿态，拍摄结束后自动筛片</div>
            </button>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={studio.handleClearKey}
              className="px-4 py-2 text-xs text-zinc-500 hover:text-red-400 tracking-wide"
            >
              清除配置
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold tracking-wide rounded"
            >
              {studio.isValidating ? '验证中...' : '刷新并连接'}
            </button>
          </div>
        </form>

        {studio.validationLogs.length > 0 && (
          <div className="w-full text-left font-mono mt-4 p-3 bg-black/40 rounded space-y-1">
            {studio.validationLogs.map((log, i) => (
              <div key={i} className="text-[10px] text-zinc-400">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen text-zinc-100 overflow-hidden selection:bg-amber-500/30">
      <HistorySidebar
        isOpen={studio.isHistoryOpen}
        history={studio.history}
        onClose={() => studio.setIsHistoryOpen(false)}
        onSelect={studio.restoreSession}
        onDelete={studio.deleteHistoryItem}
      />

      {studio.conceptPreviewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => studio.setConceptPreviewUrl(null)}
        >
          <button className="absolute top-4 right-4 p-2 text-white/60 hover:text-white">
            <XIcon className="w-8 h-8" />
          </button>
          <img
            src={studio.conceptPreviewUrl}
            className="max-h-full max-w-full object-contain shadow-2xl rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {studio.showSettingsModal && renderSettingsModal()}

      <div className="h-screen flex flex-col">
        <header className="h-16 border-b border-white/10 bg-[#0f0f12]/95 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => studio.setIsHistoryOpen(true)}
            title="打开历史项目"
          >
            <BrandLogo compact />
            <div className="hidden md:block">
              <div className="text-xs tracking-widest text-zinc-300">AI 影像工坊</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">稳定流程 · 可恢复生成</div>
            </div>
          </button>

          {!isIdleLanding && (
            <div className="hidden md:flex items-center gap-2">
              {stageMeta.map((stage) => {
                const active = stage.id === stageIndex;
                const done = stage.id < stageIndex;
                return (
                  <div
                    key={stage.id}
                    className={`px-2.5 py-1.5 rounded-md border text-[10px] tracking-wide ${
                      active
                        ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                        : done
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/10 text-zinc-500'
                    }`}
                  >
                    {stage.name}
                  </div>
                );
              })}
            </div>
          )}

          {isIdleLanding && <div className="hidden md:block flex-1" />}

          <div className="flex items-center gap-2">
            <button
              onClick={studio.handleOpenSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
            >
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">设置</span>
            </button>
            <button
              onClick={() => studio.setIsHistoryOpen(true)}
              className="px-3 py-1.5 rounded-md border border-white/10 text-xs text-zinc-300 hover:text-white hover:border-white/25"
            >
              档案
            </button>
            {!isIdleLanding && (
              <button
                onClick={studio.handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-zinc-300 hover:text-white hover:border-white/25"
              >
                <RefreshIcon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">重置</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {isIdleLanding ? (
            <div className="h-full relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-500/10 to-transparent" />
                <div className="absolute -top-16 left-1/3 w-[360px] h-[180px] bg-cyan-500/10 blur-[100px]" />
                <div className="absolute top-0 right-12 w-[320px] h-[180px] bg-indigo-500/10 blur-[100px]" />
              </div>

              <div className="relative h-full min-h-0 px-4 md:px-6 py-4 md:py-6 overflow-y-auto">
                <section className="mx-auto w-full max-w-6xl">
                  <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.9fr] gap-4">
                    <div className="rounded-xl border border-white/10 bg-[#0f1118]/95 shadow-[0_10px_40px_rgba(0,0,0,0.45)] p-4 md:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] tracking-[0.14em] text-amber-300 uppercase">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                            AI Input
                          </div>
                          <h1 className="mt-2 text-lg md:text-xl text-zinc-100 tracking-tight">先输入，再进入 Agent 流程</h1>
                        </div>
                        <button
                          type="button"
                          onClick={studio.handleOpenSettings}
                          className="shrink-0 px-2.5 py-1 rounded-md border border-white/15 text-[11px] text-zinc-300 hover:text-white hover:border-white/30"
                        >
                          连接设置
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {QUICK_PROMPTS.map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => studio.setUserInput(item.prompt)}
                            className="px-2.5 py-1 rounded-full border border-white/10 bg-black/20 text-[11px] text-zinc-300 hover:text-white hover:border-white/25 transition-colors"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 relative rounded-lg border border-white/12 bg-black/35 overflow-hidden">
                        <div className="px-3 py-1.5 border-b border-white/10 bg-black/30 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] uppercase text-zinc-400">
                            <SparklesIcon className="w-3 h-3 text-amber-300" />
                            Composer
                          </div>
                          <div className="text-[10px] text-zinc-500">Enter 快速执行 / Ctrl+Enter 深度执行</div>
                        </div>
                        {studio.userInput && (
                          <button
                            type="button"
                            onClick={studio.handleClearInput}
                            className="absolute top-9 right-2.5 p-1 text-zinc-500 hover:text-zinc-200 z-20"
                            title="清空输入"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <textarea
                          autoFocus
                          className="w-full min-h-[170px] md:min-h-[190px] bg-transparent px-4 pt-3 pb-11 text-zinc-100 placeholder-zinc-600 resize-none focus:outline-none leading-relaxed text-sm"
                          placeholder="描述目标画面、情绪、镜头和风格。例如：冷雨夜的高架桥下，人物背光而立，35mm 手持，低饱和，胶片颗粒。"
                          value={studio.userInput}
                          onChange={(e) => studio.setUserInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              studio.handleStartPlanning({ conceptCount: e.ctrlKey || e.metaKey ? 12 : 4 });
                            }
                          }}
                        />
                        <div className="absolute left-3 bottom-2.5 flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={studio.handleRandomPrompt}
                            disabled={studio.isGeneratingRandom}
                            className="p-1.5 rounded-md border border-white/10 text-zinc-400 hover:text-zinc-100 hover:border-white/25 disabled:opacity-40"
                            title="随机灵感"
                          >
                            <DiceIcon className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={studio.handleVoiceInput}
                            className={`p-1.5 rounded-md border border-white/10 ${
                              studio.isListening ? 'text-amber-300 border-amber-500/40' : 'text-zinc-400 hover:text-zinc-100 hover:border-white/25'
                            }`}
                            title="语音输入"
                          >
                            <MicIcon className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] text-zinc-500 ml-1.5">Shift+Enter 换行</span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => studio.handleStartPlanning({ conceptCount: 4 })}
                          disabled={!studio.canStartPlanning}
                          className="h-9 px-4 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          开始 Agent（4 方案）
                        </button>
                        <button
                          onClick={() => studio.handleStartPlanning({ conceptCount: 12 })}
                          disabled={!studio.canStartPlanning}
                          className="h-9 px-4 rounded-md border border-white/15 text-zinc-200 hover:text-white hover:border-white/30 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          深度 Agent（12 方案）
                        </button>
                      </div>

                      {studio.readinessHint && <div className="mt-2 text-[11px] text-amber-300">{studio.readinessHint}</div>}
                      {studio.startBlockedReason && (studio.userInput.trim().length > 0 || studio.appState !== AppState.IDLE) && (
                        <div className="mt-1.5 text-[11px] text-zinc-500">{studio.startBlockedReason}</div>
                      )}
                    </div>

                    <aside className="space-y-3">
                      <section className="rounded-xl border border-white/10 bg-[#11131a]/90 p-3">
                        <div className="text-[10px] tracking-widest text-zinc-500 mb-2">AGENT PIPELINE</div>
                        <div className="space-y-2">
                          {stageMeta.map((stage) => (
                            <div key={stage.id} className="flex items-start gap-2">
                              <div className="mt-0.5 w-4 h-4 rounded-full border border-amber-500/35 text-amber-300 text-[10px] flex items-center justify-center">
                                {stage.id + 1}
                              </div>
                              <div>
                                <div className="text-xs text-zinc-200">{stage.name}</div>
                                <div className="text-[10px] text-zinc-500">{stage.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <details className="rounded-xl border border-white/10 bg-[#11131a]/90 p-3">
                        <summary className="cursor-pointer select-none text-[11px] text-zinc-300">高级设置（策略 / 模型）</summary>
                        <div className="mt-3 space-y-3">
                          <div>
                            <div className="text-[10px] text-zinc-500 tracking-widest mb-1.5">策略</div>
                            {renderStrategySelector(true)}
                          </div>
                          <div className="space-y-1.5 text-[11px] text-zinc-300">
                            <div className="text-[10px] text-zinc-500 tracking-widest">模型</div>
                            <div className="flex justify-between gap-3">
                              <span className="text-zinc-500">文本</span>
                              <span className="font-mono">{providerLabel(selectedTextProvider)} / {studio.textModel}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-zinc-500">生图</span>
                              <span className="font-mono">{providerLabel(selectedImageProvider)} / {studio.imageModel}</span>
                            </div>
                          </div>
                        </div>
                      </details>

                      <section className="rounded-xl border border-white/10 bg-[#11131a]/90 p-3">
                        <button
                          type="button"
                          onClick={() => studio.setIsHistoryOpen(true)}
                          className="w-full h-8 px-3 rounded-md border border-white/15 text-zinc-300 hover:text-white hover:border-white/30 text-xs"
                        >
                          从历史档案恢复项目
                        </button>
                        <div className="mt-2 text-[10px] text-zinc-500">流程自动存档，可随时从任一阶段继续。</div>
                      </section>
                    </aside>
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <PlanningWorkspace
              studio={studio}
              stageMeta={stageMeta}
              stageIndex={stageIndex}
              frameStats={frameStats}
              isTaskBusy={isTaskBusy}
              activitySignalKey={activitySignalKey}
              renderStrategySelector={renderStrategySelector}
              renderModelSelectors={renderModelSelectors}
            />
          )}
        </div>
      </div>
    </div>
  );
}
