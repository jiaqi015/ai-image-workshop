import React from 'react';
import {
  RefreshIcon,
  XIcon,
  SettingsIcon,
} from './components/Icons';
import { HistorySidebar } from './components/HistorySidebar';
import { BrandLogo } from './components/BrandLogo';
import { ShootStrategy, AppState } from './types';
import { useStudioArchitect } from './hooks/useStudioArchitect';
import { PlanningWorkspace } from './modules/planning/PlanningWorkspace';

const STRATEGY_OPTIONS: Array<{ id: ShootStrategy; label: string; sub: string }> = [
  { id: 'hybrid', label: '自动模式', sub: '平衡速度与质量（推荐）' },
  { id: 'pro', label: '高质量模式', sub: '画质优先，耗时更长' },
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
    if (status.enabled === false) return `${label} (不可用)`;
    if (status.validated || status.ready) return label;
    if (status.configured === false) return `${label} (未配置)`;
    return `${label} (待检测)`;
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
    { id: 0, name: '输入需求', desc: '描述目标画面' },
    { id: 1, name: '生成方案', desc: '系统生成候选方案' },
    { id: 2, name: '确认主方案', desc: '选择本次风格方向' },
    { id: 3, name: '批量生成', desc: '输出可交付图像' },
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
            className={`ui-chip ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${active ? 'ui-chip-active' : ''}`}
          >
            <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold tracking-wide`}>{mode.label}</div>
            {!compact && <div className="mt-1 ui-meta">{mode.sub}</div>}
          </button>
        );
      })}
    </div>
  );

  const renderModelSelectors = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <label className="ui-field-label">文本服务商</label>
        <select
          className="ui-select"
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
        <label className="ui-field-label">文本模型</label>
        <select
          className="ui-select font-mono"
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
        <label className="ui-field-label">图像服务商</label>
        <select
          className="ui-select"
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
        <label className="ui-field-label">图像模型</label>
        <select
          className="ui-select font-mono"
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
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="ui-modal p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-semibold tracking-wide text-zinc-200">模型连接设置</h3>
          <button onClick={() => studio.setShowSettingsModal(false)} className="ui-btn-link">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={studio.handleManualKeySubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="ui-field-label">网关令牌（可选）</label>
            <div className="relative">
              <input
                type="text"
                className="ui-input h-11 px-3 font-mono"
                placeholder="仅在后端启用 AI_GATEWAY_TOKEN 时填写"
                value={studio.manualKeyInput}
                onChange={(e) => studio.setManualKeyInput(e.target.value)}
              />
            </div>
            <div className="ui-meta">当前所有请求均通过后端网关处理。</div>
          </div>

          {renderModelSelectors()}

          <div className="ui-surface-soft p-3 space-y-2">
            <div className="ui-field-label">生成偏好</div>
            <button
              type="button"
              onClick={() => studio.setMasterMode(!studio.masterMode)}
              className={`w-full ui-chip px-3 py-2 ${studio.masterMode ? 'ui-chip-active' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold tracking-wide">一致性锁定</span>
                <span className="text-[10px] font-mono uppercase">{studio.masterMode ? 'ON' : 'OFF'}</span>
              </div>
              <div className="mt-1 ui-meta">固定角色与风格，批量生成时保持一致并自动筛选</div>
            </button>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={studio.handleClearKey}
              className="ui-btn-link px-3"
            >
              清空令牌
            </button>
            <button
              type="submit"
              className="ui-btn-primary px-5"
            >
              {studio.isValidating ? '检测中...' : '保存并检测'}
            </button>
          </div>
        </form>

        {studio.validationLogs.length > 0 && (
          <div className="w-full text-left font-mono mt-4 p-3 ui-surface-soft space-y-1">
            {studio.validationLogs.map((log, i) => (
              <div key={i} className="ui-meta">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen ui-app text-zinc-100 overflow-hidden selection:bg-zinc-500/30">
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
        <header className="h-16 ui-header px-4 md:px-6 flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => studio.setIsHistoryOpen(true)}
            title="打开历史项目"
          >
            <BrandLogo compact />
            <div className="hidden md:block">
              <div className="text-xs tracking-widest text-zinc-300">AI 影像工坊</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">专业流程 · 支持断点继续</div>
            </div>
          </button>

          {!isIdleLanding && (
            <div className="hidden md:flex items-center">
              <div className="px-2.5 py-1.5 ui-surface-soft text-[10px] tracking-wide text-zinc-400">
                当前阶段：{stageMeta[stageIndex]?.name || '进行中'}
              </div>
            </div>
          )}

          {isIdleLanding && <div className="hidden md:block flex-1" />}

          <div className="flex items-center gap-2">
            <button onClick={studio.handleOpenSettings} className="flex items-center gap-1.5 ui-btn-secondary">
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">设置</span>
            </button>
            <button
              onClick={() => studio.setIsHistoryOpen(true)}
              className="ui-btn-secondary"
            >
              历史
            </button>
            {!isIdleLanding && (
              <button
                onClick={studio.handleReset}
                className="flex items-center gap-1.5 ui-btn-secondary"
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
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/4 via-transparent to-transparent" />

              <div className="relative h-full min-h-0 px-4 md:px-6 py-6 flex items-center justify-center overflow-y-auto">
                <section className="w-full max-w-2xl ui-surface shadow-[0_8px_28px_rgba(0,0,0,0.32)] p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h1 className="ui-title text-base md:text-lg">描述你的目标画面</h1>
                    <button
                      type="button"
                      onClick={studio.handleOpenSettings}
                      className="shrink-0 ui-btn-secondary h-7 px-2.5 text-[11px]"
                    >
                      连接设置
                    </button>
                  </div>

                  <div className="mt-3 relative ui-surface-soft overflow-hidden">
                    {studio.userInput && (
                      <button
                        type="button"
                        onClick={studio.handleClearInput}
                        className="absolute top-2.5 right-2.5 p-1 text-zinc-500 hover:text-zinc-200 z-20"
                        title="清空输入"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <textarea
                      autoFocus
                      className="ui-textarea min-h-[220px] md:min-h-[250px] bg-transparent"
                      placeholder=""
                      value={studio.userInput}
                      onChange={(e) => studio.setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          studio.handleStartPlanning({ conceptCount: e.ctrlKey || e.metaKey ? 12 : 4 });
                        }
                      }}
                    />
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => studio.handleStartPlanning({ conceptCount: 4 })}
                      disabled={!studio.canStartPlanning}
                      className="w-full ui-btn-primary"
                    >
                      开始生成
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => studio.handleStartPlanning({ conceptCount: 12 })}
                      disabled={!studio.canStartPlanning}
                      className="ui-btn-link disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      深度生成（12 方案）
                    </button>
                    <button
                      type="button"
                      onClick={() => studio.setIsHistoryOpen(true)}
                      className="ui-btn-link"
                    >
                      打开历史
                    </button>
                  </div>
                  <div className="mt-1 ui-meta">Enter 快速生成 · Ctrl/Cmd + Enter 深度生成</div>

                  <details className="mt-3 ui-surface-soft p-3">
                    <summary className="cursor-pointer select-none text-[11px] text-zinc-300">高级设置（模式 / 模型）</summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-[10px] text-zinc-500 tracking-widest mb-1.5">生成模式</div>
                        {renderStrategySelector(true)}
                      </div>
                      <div className="space-y-1.5 text-[11px] text-zinc-300">
                        <div className="text-[10px] text-zinc-500 tracking-widest">模型选择</div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500">文本模型</span>
                          <span className="font-mono">{providerLabel(selectedTextProvider)} / {studio.textModel}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500">图像模型</span>
                          <span className="font-mono">{providerLabel(selectedImageProvider)} / {studio.imageModel}</span>
                        </div>
                      </div>
                    </div>
                  </details>

                  {studio.readinessHint && <div className="mt-2 ui-meta">{studio.readinessHint}</div>}
                  {studio.startBlockedReason && (studio.userInput.trim().length > 0 || studio.appState !== AppState.IDLE) && (
                    <div className="mt-1.5 ui-meta">{studio.startBlockedReason}</div>
                  )}
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
