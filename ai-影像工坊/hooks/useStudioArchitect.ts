import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppState, ShootPlan, Frame, ShootStrategy, DirectorModel, LogEntry, TextModel, ImageModel } from '../types';
import type { AvailableModelsCatalog } from '../services/api/client';
import type { HistoryTaskStatus } from '../components/HistorySidebar';
import { 
    generateRandomPrompt, 
    generateProRandomPrompt, 
    validateApiKey, 
    getCustomApiKey, 
    setCustomApiKey,
    setModelPreferences,
    getModelPreferences,
    getAvailableModels,
    refreshAvailableModels,
    voiceService
} from '../services/public'; 

import { useDarkroom } from './useDarkroom';
import { useHistory } from './useHistory';
import { useWorkflowMachine } from './useWorkflowMachine';
import { usePlanningWorkflow } from './workflows/usePlanningWorkflow';
import { useShootingWorkflow } from './workflows/useShootingWorkflow';
import { useAutoCuration } from './useAutoCuration';

export const useStudioArchitect = () => {
    
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
    const [retryingFrameIds, setRetryingFrameIds] = useState<number[]>([]);

    const startTimeRef = useRef<number>(0); 
    const planningAbortController = useRef<AbortController | null>(null);
    const mainContentRef = useRef<HTMLDivElement>(null); 
    const retryingFrameIdsRef = useRef<Set<number>>(new Set());
    const curationSignatureRef = useRef<string>('');
    const lastHistoryStatusRef = useRef<HistoryTaskStatus | null>(null);
    const lastHistoryFrameSignatureRef = useRef<string>('');

    // 通用日志记录
    const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'network' = 'info', latency?: number) => {
        setLogs(prev => [...prev, {
            id: Math.random().toString(36).substring(7),
            timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            message,
            type,
            latency
        }]);
    }, []);

    const addValidationLog = useCallback((msg: string) => {
        setValidationLogs(prev => [...prev, msg]);
    }, []);

    const { activeRequests, isShootingRef, executeFrameBatch, shootStreamBatch, abortAll: abortDarkroom } = useDarkroom(addLog);
    const { history, addToHistory, updateHistoryItem, deleteHistoryItem } = useHistory(addLog);

    // --- 初始化副作用 ---
    useEffect(() => {
        const initSystem = async () => {
            try {
                await refreshAvailableModels();
                setAvailableModels(getAvailableModels());
                await validateApiKey("");
                setKeyConfigured(true);
                addLog("系统初始化完成：模型网关连接成功。", "success");
            } catch (e: any) {
                setKeyConfigured(false);
                addLog(`模型网关不可用: ${e.message}`, "error");
            }
        };
        initSystem();
    }, [addLog]);

    // 输入持久化
    useEffect(() => { localStorage.setItem('autosave_input', userInput); }, [userInput]);
    useEffect(() => { localStorage.setItem('master_mode', masterMode ? '1' : '0'); }, [masterMode]);
    
    // 拍摄计时器
    useEffect(() => {
        let interval: any = null;
        if (appState === AppState.SHOOTING && activeRequests > 0) {
            interval = setInterval(() => { setElapsedTime(Date.now() - startTimeRef.current); }, 50);
        } 
        return () => { if (interval) clearInterval(interval); };
    }, [appState, activeRequests]);
    
    // 自动回写历史中的帧进度（概念/拍摄阶段）
    useEffect(() => {
        if (!currentHistoryId) return;
        if (frames.length === 0) return;
        if (activeRequests > 0) return;
        if (appState !== AppState.CONCEPT && appState !== AppState.SHOOTING) return;

        const hasRenderableFrames = frames.some((f) => f.status === 'completed' || f.status === 'failed');
        if (!hasRenderableFrames) return;

        const signature = `${appState}|${frames
            .map((f) => `${f.id}:${f.status}:${Boolean(f.imageUrl)}:${String(f.error || '')}`)
            .join('|')}`;
        if (lastHistoryFrameSignatureRef.current === signature) return;
        lastHistoryFrameSignatureRef.current = signature;

        updateHistoryItem(currentHistoryId, frames).catch(() => undefined);
    }, [frames, activeRequests, currentHistoryId, updateHistoryItem, appState]);

    const derivedHistoryStatus = useMemo<HistoryTaskStatus>(() => {
        if (appState === AppState.PLANNING) return 'planning';
        if (appState === AppState.CONCEPT) return 'concept';
        if (appState === AppState.SHOOTING) {
            const hasInFlight = activeRequests > 0 || frames.some((frame) => frame.status === 'pending' || frame.status === 'generating' || frame.status === 'scripting');
            if (hasInFlight) return 'shooting';
            const hasCompleted = frames.some((frame) => frame.status === 'completed');
            return hasCompleted ? 'completed' : 'failed';
        }
        return 'completed';
    }, [appState, activeRequests, frames]);

    useEffect(() => {
        if (!currentHistoryId) return;
        if (lastHistoryStatusRef.current === derivedHistoryStatus) return;
        lastHistoryStatusRef.current = derivedHistoryStatus;
        updateHistoryItem(currentHistoryId, null, { taskStatus: derivedHistoryStatus }).catch(() => undefined);
    }, [currentHistoryId, derivedHistoryStatus, updateHistoryItem]);

    useEffect(() => {
        if (currentHistoryId) return;
        lastHistoryStatusRef.current = null;
        lastHistoryFrameSignatureRef.current = '';
    }, [currentHistoryId]);

    useEffect(() => {
        if (appState !== AppState.CONCEPT) return;
        if (selectedProposalId !== null && frames.some((frame) => frame.id === selectedProposalId)) return;
        const completedFrames = frames.filter((frame) => frame.status === 'completed' && Boolean(frame.imageUrl));
        if (completedFrames.length === 0) return;

        const scoreForFrame = (frame: Frame) => {
            if (typeof frame.metadata?.curationScore === 'number') return frame.metadata.curationScore;
            if (frame.metadata?.variantType === 'balanced') return 0.8;
            if (frame.metadata?.variantType === 'strict') return 0.7;
            if (frame.metadata?.variantType === 'creative') return 0.65;
            return 0.6;
        };

        const bestFrame = completedFrames.reduce((acc, frame) => (scoreForFrame(frame) > scoreForFrame(acc) ? frame : acc), completedFrames[0]);
        setSelectedProposalId(bestFrame.id);
    }, [appState, frames, selectedProposalId]);
    
    // 模型偏好同步到 Infrastructure
    useEffect(() => {
        setModelPreferences({ textModel, imageModel });
    }, [textModel, imageModel]);

    const handleReset = useCallback(() => {
        if (planningAbortController.current) {
            planningAbortController.current.abort();
            planningAbortController.current = null;
        }
        abortDarkroom();
        isShootingRef.current = false; 
        retryingFrameIdsRef.current.clear();
        curationSignatureRef.current = '';
        lastHistoryStatusRef.current = null;
        lastHistoryFrameSignatureRef.current = '';
        setRetryingFrameIds([]);
        resetWorkflow();
        setStreamingPlanText(''); setUserInput(''); setPlan(null); setFrames([]); setLogs([]); setSelectedConceptUrl(undefined); setElapsedTime(0); setSelectedProposalId(null);
        setCurrentHistoryId(null);
        addLog("已重置当前任务。", "info");
    }, [abortDarkroom, addLog, resetWorkflow]);

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
        addLog(`已恢复历史项目 | ID: ${item.id}`, 'info');
    }, [handleReset, addLog, transitionWorkflow, setAppState]);

    const handleVoiceInput = useCallback(() => {
        if (isListening) { voiceService.stop(); setIsListening(false); } 
        else { voiceService.start((text, isFinal) => { if (isFinal) setUserInput(p => p + (p ? " " : "") + text); }, setIsListening); }
    }, [isListening]);

    const handleRandomPrompt = useCallback(async () => {
        if (isGeneratingRandom) return;
        setIsGeneratingRandom(true);
        setUserInput("正在生成灵感描述...");
        try {
            const prompt = await generateProRandomPrompt(); 
            setUserInput(prompt);
        } catch (e) {
            const fallback = await generateRandomPrompt();
            setUserInput(fallback); 
        } finally {
            setIsGeneratingRandom(false);
        }
    }, [isGeneratingRandom]);

    const canStartPlanning = appState === AppState.IDLE && userInput.trim().length > 0;
    const startBlockedReason = useMemo(() => {
        if (appState !== AppState.IDLE) return "当前有任务正在运行，请先重置或等待完成";
        if (!userInput.trim()) return "请先输入你的画面需求";
        return "";
    }, [appState, userInput]);
    const readinessHint = keyConfigured ? "" : "网关状态异常，请检查后端模型配置";
    const { curationSummary } = useAutoCuration({
        masterMode,
        appState,
        activeRequests,
        frames,
        setFrames,
        curationSignatureRef,
        addLog
    });

    const { handleStartPlanning, handleExpandUniverse } = usePlanningWorkflow({
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
        handleConfirmShoot,
        handleGenerateMore,
        handleRetryFrame
    };
};
