import React from 'react';
import {
  RefreshIcon,
  XIcon,
  SettingsIcon,
} from './components/Icons';
import { HistorySidebar } from './components/HistorySidebar';
import { BrandLogo } from './components/BrandLogo';
import { ShootStrategy, AppState } from './types';
import { useStudioOrchestrator } from './hooks/useStudioOrchestrator';
import { PlanningWorkspace } from './modules/planning/PlanningWorkspace';

const STRATEGY_OPTIONS: Array<{ id: ShootStrategy; label: string; sub: string }> = [
  { id: 'hybrid', label: '自动模式', sub: '速度与画质平衡（推荐）' },
  { id: 'pro', label: '高质量模式', sub: '画质优先，耗时更久' },
];

const RANDOM_TENSION_OPTIONS = [
  { id: 'low', label: '低张力' },
  { id: 'medium', label: '中张力' },
  { id: 'high', label: '高张力' },
] as const;

const RANDOM_CAST_OPTIONS = [
  { id: 'asian_girl_23_plus', label: '亚洲年轻女性 23-28' },
  { id: 'asian_woman_23_plus', label: '亚洲成熟女性 23-35' },
] as const;

export default function App() {
  const studio = useStudioOrchestrator();
  const [startConceptCount, setStartConceptCount] = React.useState<4 | 12>(4);
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
    { id: 0, name: '描述目标', desc: '写下你想要的画面' },
    { id: 1, name: '生成候选', desc: 'AI 给你多组方向' },
    { id: 2, name: '选定方向', desc: '确认最像你想要的一组' },
    { id: 3, name: '批量出图', desc: '连续生成可交付画面' },
  ];
  const isIdleLanding = studio.appState === AppState.IDLE && !studio.plan;
  const inputCharCount = studio.userInput.trim().length;

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
            <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold`}>{mode.label}</div>
            {!compact && <div className="mt-1 ui-meta">{mode.sub}</div>}
          </button>
        );
      })}
    </div>
  );

  const renderModelSelectors = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <label className="ui-field-label">文本服务</label>
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
        <label className="ui-field-label">图像服务</label>
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
    <div className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="ui-modal ui-modal-shell p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ui-text-primary)' }}>连接与引擎</h3>
          <button onClick={() => studio.setShowSettingsModal(false)} className="ui-btn-link">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={studio.handleManualKeySubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="ui-field-label">访问令牌（可选）</label>
            <input
              type="text"
              className="ui-input px-3 font-mono"
              placeholder="仅在服务端开启令牌校验时填写（AI_GATEWAY_REQUIRE_TOKEN=1）"
              value={studio.manualKeyInput}
              onChange={(e) => studio.setManualKeyInput(e.target.value)}
            />
            <div className="ui-meta">所有请求都会先经过你的服务端。</div>
          </div>

          {renderModelSelectors()}

          <div className="ui-surface-soft p-3 space-y-2">
            <div className="ui-field-label">风格稳定</div>
            <button
              type="button"
              onClick={() => studio.setMasterMode(!studio.masterMode)}
              className={`w-full ui-chip px-3 py-2 ${studio.masterMode ? 'ui-chip-active' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold">风格锁定</span>
                <span className="text-[10px] font-mono">{studio.masterMode ? '开启' : '关闭'}</span>
              </div>
              <div className="mt-1 ui-meta">固定角色与风格，批量结果更统一。</div>
            </button>
          </div>

          <div className="ui-surface-soft p-3 space-y-2">
            <div className="ui-field-label">使用表现（滚动统计）</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--ui-text-secondary)' }}>
              <div className="ui-surface p-2.5 rounded-md">
                <div className="ui-meta">首图时间</div>
                <div className="mt-1 font-mono">{studio.uxMetricsSummary.avgFirstImageMs > 0 ? `${studio.uxMetricsSummary.avgFirstImageMs}ms` : '--'}</div>
              </div>
              <div className="ui-surface p-2.5 rounded-md">
                <div className="ui-meta">完成率</div>
                <div className="mt-1 font-mono">{Math.round(studio.uxMetricsSummary.completionRate * 100)}%</div>
              </div>
              <div className="ui-surface p-2.5 rounded-md">
                <div className="ui-meta">重试成功率</div>
                <div className="mt-1 font-mono">{Math.round(studio.uxMetricsSummary.recoveryRate * 100)}%</div>
              </div>
              <div className="ui-surface p-2.5 rounded-md">
                <div className="ui-meta">二次回访率</div>
                <div className="mt-1 font-mono">{Math.round(studio.uxMetricsSummary.returningRate * 100)}%</div>
              </div>
            </div>
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
    <div className="min-h-screen ui-app overflow-hidden">
      <HistorySidebar
        isOpen={studio.isHistoryOpen}
        history={studio.history}
        onClose={() => studio.setIsHistoryOpen(false)}
        onSelect={studio.restoreSession}
        onDelete={studio.deleteHistoryItem}
      />

      {studio.conceptPreviewUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 flex items-start justify-center p-2 md:p-3 pt-2 md:pt-3 overflow-y-auto"
          onClick={() => studio.setConceptPreviewUrl(null)}
        >
          <button className="absolute top-3 right-3 p-2 text-white/70 hover:text-white">
            <XIcon className="w-8 h-8" />
          </button>
          <img
            src={studio.conceptPreviewUrl}
            className="max-h-[calc(100vh-0.8rem)] max-w-full object-contain ui-preview-shadow rounded self-start"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {studio.showSettingsModal && renderSettingsModal()}

      <div className="h-screen flex flex-col">
        <header className="ui-header ui-header-h ui-header-pad flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => studio.setIsHistoryOpen(true)}
            title="打开创作历史"
          >
            <BrandLogo compact />
          </button>

          {!isIdleLanding && (
            <div className="hidden md:flex items-center">
              <div className="px-2.5 py-1.5 ui-surface-soft text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>
                当前步骤：{stageMeta[stageIndex]?.name || '进行中'}
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
              历史记录
            </button>
            {!isIdleLanding && (
              <button
                onClick={studio.handleReset}
                className="flex items-center gap-1.5 ui-btn-secondary"
              >
                <RefreshIcon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">重来</span>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0">
          {isIdleLanding ? (
            <div className="h-full ui-shell-pad flex items-center justify-center overflow-y-auto">
              <section className="w-full ui-hero ui-surface ui-reveal p-4 md:p-5">
                <div className="mx-auto max-w-none">
                  <div className="relative ui-surface-soft overflow-hidden">
                    {studio.userInput && (
                      <button
                        type="button"
                        onClick={studio.handleClearInput}
                        className="absolute top-2.5 right-2.5 p-1 z-20"
                        style={{ color: 'var(--ui-text-muted)' }}
                        title="清空输入"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <textarea
                      autoFocus
                      className="ui-textarea ui-input-hero bg-transparent"
                      placeholder=""
                      value={studio.userInput}
                      onChange={(e) => studio.setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          studio.handleStartPlanning({ conceptCount: e.ctrlKey || e.metaKey ? 12 : startConceptCount });
                        }
                      }}
                    />
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => studio.handleStartPlanning({ conceptCount: startConceptCount })}
                      disabled={!studio.canStartPlanning}
                      className="flex-1 ui-btn-primary"
                    >
                      开始创作
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:w-[260px]">
                      <button
                        type="button"
                        onClick={() => setStartConceptCount(4)}
                        className={`ui-chip text-center ${startConceptCount === 4 ? 'ui-chip-active' : ''}`}
                      >
                        快速 4 组
                      </button>
                      <button
                        type="button"
                        onClick={() => setStartConceptCount(12)}
                        className={`ui-chip text-center ${startConceptCount === 12 ? 'ui-chip-active' : ''}`}
                      >
                        深入 12 组
                      </button>
                    </div>
                  </div>

                  <section className="mt-3 ui-surface-soft p-2.5 space-y-2.5">
                    <div className="ui-field-label">创作偏好</div>
                    <div>
                      <div className="ui-field-label mb-1">生成模式</div>
                      {renderStrategySelector(true)}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="ui-field-label mb-1">人物倾向</div>
                        <select
                          className="ui-select ui-select-compact"
                          value={studio.randomPromptCastPreference}
                          onChange={(e) => studio.setRandomPromptCastPreference(e.target.value as 'asian_girl_23_plus' | 'asian_woman_23_plus')}
                        >
                          {RANDOM_CAST_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div className="ui-field-label mb-1">画面张力</div>
                        <select
                          className="ui-select ui-select-compact"
                          value={studio.randomPromptTensionLevel}
                          onChange={(e) => studio.setRandomPromptTensionLevel(e.target.value as 'low' | 'medium' | 'high')}
                        >
                          {RANDOM_TENSION_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="ui-surface p-2 rounded-md flex items-center justify-between gap-2">
                      <div className="ui-field-label">来点灵感</div>
                      <button
                        type="button"
                        onClick={studio.handleRandomPrompt}
                        disabled={studio.isGeneratingRandom || studio.appState !== AppState.IDLE}
                        className="ui-btn-secondary ui-btn-compact px-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {studio.isGeneratingRandom ? '构思中...' : '换一个'}
                      </button>
                    </div>
                    <div className="space-y-1 text-[11px]" style={{ color: 'var(--ui-text-secondary)' }}>
                      <div className="ui-field-label">当前模型</div>
                      <div className="flex justify-between gap-3">
                        <span style={{ color: 'var(--ui-text-muted)' }}>文本模型</span>
                        <span className="font-mono">{providerLabel(selectedTextProvider)} / {studio.textModel}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span style={{ color: 'var(--ui-text-muted)' }}>图像模型</span>
                        <span className="font-mono">{providerLabel(selectedImageProvider)} / {studio.imageModel}</span>
                      </div>
                    </div>
                  </section>

                  <div className="mt-2 flex items-center justify-between gap-3 ui-meta ui-numeric">
                    <span>Enter 开始，Shift + Enter 换行。</span>
                    <span>{inputCharCount} 字</span>
                  </div>
                  {studio.readinessHint && <div className="mt-1 ui-meta">{studio.readinessHint}</div>}
                  {studio.startBlockedReason && (studio.userInput.trim().length > 0 || studio.appState !== AppState.IDLE) && (
                    <div className="mt-1 ui-meta">{studio.startBlockedReason}</div>
                  )}
                </div>
              </section>
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
