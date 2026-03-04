import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { AppState, ShootPlan, Frame, ShootStrategy, DirectorModel, LogEntry, TextModel, ImageModel } from '../types';
import type { AvailableModelsCatalog, RandomPromptRequest } from '../services/api/client';
import { 
    generateRandomPrompt, 
    generateProRandomPrompt, 
    validateApiKey, 
    getCustomApiKey, 
    setCustomApiKey,
    getModelPreferences,
    getAvailableModels,
    voiceService
} from '../application/studioFacade'; 

import { useRenderOrchestrator } from './useRenderOrchestrator';
import { useHistory } from './useHistory';
import { useWorkflowMachine } from './useWorkflowMachine';
import { usePlanningWorkflow } from './workflows/usePlanningWorkflow';
import { useShootingWorkflow } from './workflows/useShootingWorkflow';
import { useAutoCuration } from './useAutoCuration';
import { useHistorySync } from './useHistorySync';
import { useConceptSelection } from './useConceptSelection';
import { useStudioInfra } from './useStudioInfra';
import { useUxMetrics } from './useUxMetrics';
import { localizeRuntimeText } from '../application/uiText';

type PromptTensionLevel = NonNullable<RandomPromptRequest['tensionLevel']>;
type PromptCastPreference = NonNullable<RandomPromptRequest['castPreference']>;

const normalizePromptTensionLevel = (value: string): PromptTensionLevel => {
    if (value === 'low' || value === 'high') return value;
    return 'medium';
};

const normalizePromptCastPreference = (value: string): PromptCastPreference => {
    if (value === 'asian_woman_23_plus') return value;
    return 'asian_girl_23_plus';
};

export const useStudioOrchestrator = () => {
    
    // ==========================================
    // 状态定义 (State Definitions)
    // ==========================================
    const { appState, setAppState, transition: transitionWorkflow, reset: resetWorkflow } = useWorkflowMachine();
    const [userInput, setUserInput] = useState(() => localStorage.getItem('autosave_input') || ''); 
    const [plan, setPlan] = useState<ShootPlan | null>(null); 
    const [frames, setFrames] = useState<Frame[]>([]); 
    const [selectedConceptUrl, setSelectedConceptUrl] = useState<string | undefined>(undefined); 
    const [keyConfigured, setKeyConfigured] = useState(true); 
    const [strategy, setStrategy] = useState<ShootStrategy>('hybrid'); 
    const [textModel, setTextModel] = useState<TextModel>(() => getModelPreferences().textModel as TextModel);
    const [imageModel, setImageModel] = useState<ImageModel>(() => getModelPreferences().imageModel as ImageModel);
    const directorModel = textModel as DirectorModel;
    const setDirectorModel = (model: DirectorModel) => setTextModel(model as TextModel);
    const [availableModels, setAvailableModels] = useState<AvailableModelsCatalog>(() => getAvailableModels());
    const [streamingPlanText, setStreamingPlanText] = useState(''); 
    const [logs, setLogs] = useState<LogEntry[]>([]); 
    const [elapsedTime, setElapsedTime] = useState(0); 
    const [isValidating, setIsValidating] = useState(false); 
    const [validationLogs, setValidationLogs] = useState<string[]>([]); 
    const [isHistoryOpen, setIsHistoryOpen] = useState(false); 
    const [showSettingsModal, setShowSettingsModal] = useState(false); 
    const [manualKeyInput, setManualKeyInput] = useState(''); 
    const [isExtending, setIsExtending] = useState(false); 
    const [isExpandingUniverse, setIsExpandingUniverse] = useState(false); 
    const [conceptPreviewUrl, setConceptPreviewUrl] = useState<string | null>(null); 
    const [selectedProposalId, setSelectedProposalId] = useState<number | null>(null); 
    const [isListening, setIsListening] = useState(false);
    const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
    const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
    const [masterMode, setMasterMode] = useState<boolean>(() => localStorage.getItem('master_mode') !== '0');
    const [randomPromptTensionLevel, setRandomPromptTensionLevel] = useState<PromptTensionLevel>(() =>
        normalizePromptTensionLevel(localStorage.getItem('random_prompt_tension_level') || 'medium')
    );
    const [randomPromptCastPreference, setRandomPromptCastPreference] = useState<PromptCastPreference>(() =>
        normalizePromptCastPreference(localStorage.getItem('random_prompt_cast_preference') || 'asian_girl_23_plus')
    );
    const [retryingFrameIds, setRetryingFrameIds] = useState<number[]>([]);
    const [rewritingFrameIds, setRewritingFrameIds] = useState<number[]>([]);
    const [expandingFromProposalId, setExpandingFromProposalId] = useState<number | null>(null);

    const startTimeRef = useRef<number>(0); 
    const planningAbortController = useRef<AbortController | null>(null);
    const mainContentRef = useRef<HTMLDivElement>(null); 
    const retryingFrameIdsRef = useRef<Set<number>>(new Set());
    const curationSignatureRef = useRef<string>('');

    useEffect(() => {
        localStorage.setItem('random_prompt_tension_level', randomPromptTensionLevel);
    }, [randomPromptTensionLevel]);

    useEffect(() => {
        localStorage.setItem('random_prompt_cast_preference', randomPromptCastPreference);
    }, [randomPromptCastPreference]);

    // 通用日志记录
    const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'network' = 'info', latency?: number) => {
        const localizedMessage = localizeRuntimeText(message);
        setLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            message: localizedMessage,
            type,
            latency
        }]);
    }, []);

    const addValidationLog = useCallback((msg: string) => {
        setValidationLogs(prev => [...prev, localizeRuntimeText(msg)]);
    }, []);

    const { activeRequests, isShootingRef, executeFrameBatch, shootStreamBatch, abortAll: abortDarkroom } = useRenderOrchestrator(addLog);
    const { history, addToHistory, updateHistoryItem, deleteHistoryItem } = useHistory(addLog);

    const { derivedHistoryStatus } = useHistorySync({
        currentHistoryId,
        appState,
        activeRequests,
        frames,
        updateHistoryItem,
    });
    useStudioInfra({
        appState,
        activeRequests,
        startTimeRef,
        setElapsedTime,
        userInput,
        masterMode,
        textModel,
        imageModel,
        setAvailableModels,
        setKeyConfigured,
        addLog,
    });
    const {
        markTaskStarted,
        markRetryAttempt,
        resetTracking: resetUxTracking,
        uxMetricsSummary,
    } = useUxMetrics({
        historyLength: history.length,
        frames,
        currentHistoryId,
        derivedHistoryStatus,
    });

    const handleReset = useCallback(() => {
        if (planningAbortController.current) {
            planningAbortController.current.abort();
            planningAbortController.current = null;
        }
        abortDarkroom();
        isShootingRef.current = false; 
        retryingFrameIdsRef.current.clear();
        curationSignatureRef.current = '';
        setRetryingFrameIds([]);
        setRewritingFrameIds([]);
        setExpandingFromProposalId(null);
        resetUxTracking();
        resetWorkflow();
        setStreamingPlanText(''); setUserInput(''); setPlan(null); setFrames([]); setLogs([]); setSelectedConceptUrl(undefined); setElapsedTime(0); setSelectedProposalId(null);
        setCurrentHistoryId(null);
        addLog("已清空当前创作。", "info");
    }, [abortDarkroom, addLog, resetWorkflow, resetUxTracking]);

    const restoreSession = useCallback((item: any) => {
        handleReset();
        setIsHistoryOpen(false);
        isShootingRef.current = false;
        setCurrentHistoryId(item.id); 
        setUserInput(item.userInput);
        const restoredPlan = item?.plan && typeof item.plan === 'object' ? item.plan : null;
        setPlan(restoredPlan);
        const conceptFrames = Array.isArray(restoredPlan?.conceptFrames) ? restoredPlan.conceptFrames : [];
        const renderFrames = Array.isArray(restoredPlan?.renderFrames) ? restoredPlan.renderFrames : [];
        const fallbackFrames = Array.isArray(restoredPlan?.frames)
            ? restoredPlan.frames.map((desc: string, i: number) => ({ id: i + 1, description: desc, status: 'pending' }))
            : [];
        const hasRenderFrames = renderFrames.length > 0;
        const restoredFrames = hasRenderFrames ? renderFrames : (conceptFrames.length > 0 ? conceptFrames : fallbackFrames);
        if (hasRenderFrames) {
            setAppState(AppState.SHOOTING);
        } else {
            transitionWorkflow({ type: 'RESTORE_TO_CONCEPT' });
        }
        setFrames(restoredFrames);
        setLogs([]); setElapsedTime(0);
        addLog(`已恢复历史创作 | 编号：${item.id}`, 'info');
    }, [handleReset, addLog, transitionWorkflow, setAppState]);

    const handleVoiceInput = useCallback(() => {
        if (isListening) { voiceService.stop(); setIsListening(false); } 
        else { voiceService.start((text, isFinal) => { if (isFinal) setUserInput(p => p + (p ? " " : "") + text); }, setIsListening); }
    }, [isListening]);

    const handleRandomPrompt = useCallback(async () => {
        if (isGeneratingRandom) return;
        setIsGeneratingRandom(true);
        setUserInput("正在生成灵感...");
        try {
            const prompt = await generateProRandomPrompt({
                tensionLevel: randomPromptTensionLevel,
                castPreference: randomPromptCastPreference,
            }); 
            setUserInput(prompt);
        } catch (e) {
            const fallback = await generateRandomPrompt({
                tensionLevel: randomPromptTensionLevel,
                castPreference: randomPromptCastPreference,
            });
            setUserInput(fallback); 
        } finally {
            setIsGeneratingRandom(false);
        }
    }, [isGeneratingRandom, randomPromptTensionLevel, randomPromptCastPreference]);

    const canStartPlanning = appState === AppState.IDLE && userInput.trim().length > 0;
    const startBlockedReason = useMemo(() => {
        if (appState !== AppState.IDLE) return "当前仍在处理中，请等待完成或点击重来";
        if (!userInput.trim()) return "请先写下你想要的画面";
        return "";
    }, [appState, userInput]);
    const readinessHint = keyConfigured ? "" : "模型连接异常，请检查后端配置";
    const { curationSummary } = useAutoCuration({
        masterMode,
        appState,
        activeRequests,
        frames,
        setFrames,
        curationSignatureRef,
        addLog
    });
    useConceptSelection({
        appState,
        frames,
        selectedProposalId,
        setSelectedProposalId
    });

    const { handleStartPlanning, handleExpandUniverse, handleRewriteProposal, handleGenerateRelatedProposals } = usePlanningWorkflow({
        appState,
        userInput,
        keyConfigured,
        directorModel,
        textModel,
        imageModel,
        masterMode,
        plan,
        frames,
        isShootingRef,
        planningAbortController,
        setStreamingPlanText,
        setFrames,
        setLogs,
        setSelectedConceptUrl,
        setElapsedTime,
        setSelectedProposalId,
        setCurrentHistoryId,
        setPlan,
        setIsExpandingUniverse,
        transitionWorkflow,
        addLog,
        addToHistory,
        updateHistoryItem,
        executeFrameBatch,
        shootStreamBatch,
        setRewritingFrameIds,
        setExpandingFromProposalId,
        onTaskStarted: markTaskStarted,
    });

    const { handleConfirmShoot, handleGenerateMore, handleRetryFrame } = useShootingWorkflow({
        appState,
        plan,
        frames,
        selectedProposalId,
        strategy,
        masterMode,
        textModel,
        imageModel,
        isShootingRef,
        startTimeRef,
        mainContentRef,
        retryingFrameIdsRef,
        curationSignatureRef,
        setSelectedConceptUrl,
        setFrames,
        setPlan,
        setIsExtending,
        setRetryingFrameIds,
        transitionWorkflow,
        addLog,
        onRetryAttempt: (frameId, mode) => {
            markRetryAttempt(frameId);
            if (mode === 'fallback') {
                addLog(`第 ${frameId} 帧已切换为稳健重试。`, 'info');
            }
        },
        shootStreamBatch,
    });

    const handleManualKeySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsValidating(true);
        setValidationLogs([]);
        try {
            if (manualKeyInput.trim()) {
                setCustomApiKey(manualKeyInput.trim());
            }
            await validateApiKey(manualKeyInput.trim(), addValidationLog);
            setKeyConfigured(true);
            setTimeout(() => setShowSettingsModal(false), 300);
        } catch (error: any) {
            setKeyConfigured(false);
            addValidationLog(`❌ ${error.message}`);
        } finally {
            setIsValidating(false);
        }
    };
    
    const handleClearInput = () => {
        setUserInput('');
    };

    return {
        appState, setAppState,
        userInput, setUserInput,
        plan, setPlan,
        frames, setFrames,
        logs,
        canStartPlanning,
        startBlockedReason,
        readinessHint,
        elapsedTime,
        activeRequests,
        keyConfigured,
        strategy, setStrategy,
        masterMode, setMasterMode,
        randomPromptTensionLevel, setRandomPromptTensionLevel,
        randomPromptCastPreference, setRandomPromptCastPreference,
        directorModel, setDirectorModel,
        textModel, setTextModel,
        imageModel, setImageModel,
        availableModels,
        streamingPlanText,
        isValidating, validationLogs,
        isHistoryOpen, setIsHistoryOpen,
        showSettingsModal, setShowSettingsModal,
        manualKeyInput, setManualKeyInput,
        isExtending,
        isExpandingUniverse,
        conceptPreviewUrl, setConceptPreviewUrl,
        selectedConceptUrl, setSelectedConceptUrl,
        selectedProposalId, setSelectedProposalId,
        isListening,
        history,
        isGeneratingRandom,
        curationSummary,
        retryingFrameIds,
        rewritingFrameIds,
        expandingFromProposalId,
        uxMetricsSummary,
        mainContentRef,
        handleStartPlanning,
        handleReset,
        handleVoiceInput,
        handleRandomPrompt,
        handleClearInput, 
        handleClearKey: () => { setCustomApiKey(null); setManualKeyInput(''); setValidationLogs([]); },
        handleOpenSettings: () => { setManualKeyInput(getCustomApiKey() || ''); setShowSettingsModal(true); },
        handleManualKeySubmit,
        restoreSession,
        deleteHistoryItem,
        handleSelectSidebarConcept: (id: number) => {
            const c = plan?.conceptFrames?.find(f => f.id === id);
            if (c && c.imageUrl) { setPlan(p => p ? {...p, selectedConceptId: id} : null); setSelectedConceptUrl(c.imageUrl); }
        },
        handleExpandUniverse,
        handleRewriteProposal,
        handleGenerateRelatedProposals,
        handleConfirmShoot,
        handleGenerateMore,
        handleRetryFrame
    };
};
