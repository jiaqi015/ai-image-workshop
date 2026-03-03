import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { AppState, ShootPlan, Frame, ShootStrategy, DirectorModel, LogEntry, TextModel, ImageModel } from '../types';
import type { AvailableModelsCatalog } from '../services/api/client';
import { 
    generateRandomPrompt, 
    generateProRandomPrompt, 
    curateFrames,
    summarizeCuration,
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
                addLog("系统初始化完成：已连接后端智能网关。", "success");
            } catch (e: any) {
                setKeyConfigured(false);
                addLog(`后端网关不可用: ${e.message}`, "error");
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
    
    // 自动更新历史记录中的图片 (显影后回写)
    useEffect(() => {
        if (currentHistoryId && frames.length > 0 && activeRequests === 0 && appState === AppState.CONCEPT) {
            const completedCount = frames.filter(f => f.status === 'completed').length;
            if (completedCount > 0) {
                updateHistoryItem(currentHistoryId, frames);
            }
        }
    }, [frames, activeRequests, currentHistoryId, updateHistoryItem, appState]);
    
    // 模型偏好同步到 Infrastructure
    useEffect(() => {
        setModelPreferences({ textModel, imageModel });
    }, [textModel, imageModel]);

    // 母版模式自动筛片（批次结束后触发一次）
    useEffect(() => {
        if (!masterMode) return;
        if (appState !== AppState.SHOOTING || activeRequests > 0) return;

        const completedFrames = frames.filter((frame) => frame.status === 'completed' && Boolean(frame.imageUrl));
        if (completedFrames.length === 0) return;

        const signature = completedFrames
            .map((frame) => `${frame.id}:${frame.metadata?.curationStatus || 'pending'}:${frame.metadata?.curationScore || 0}`)
            .join('|');
        if (curationSignatureRef.current === signature) return;

        const hasPending = completedFrames.some((frame) => {
            const status = frame.metadata?.curationStatus;
            return !status || status === 'pending';
        });
        if (!hasPending) {
            curationSignatureRef.current = signature;
            return;
        }

        const curated = curateFrames(frames, { keepRatio: 0.2, minKeep: 4, maxKeep: 20 });
        const summary = summarizeCuration(curated);
        curationSignatureRef.current = curated
            .filter((frame) => frame.status === 'completed' && Boolean(frame.imageUrl))
            .map((frame) => `${frame.id}:${frame.metadata?.curationStatus || 'pending'}:${frame.metadata?.curationScore || 0}`)
            .join('|');

        setFrames(curated);
        addLog(`[母版筛片] 入选 ${summary.keep} 张，淘汰 ${summary.drop} 张。`, 'success');
    }, [masterMode, appState, activeRequests, frames, addLog]);

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
        resetWorkflow();
        setStreamingPlanText(''); setUserInput(''); setPlan(null); setFrames([]); setLogs([]); setSelectedConceptUrl(undefined); setElapsedTime(0); setSelectedProposalId(null);
        setCurrentHistoryId(null);
        addLog("系统已硬复位，所有资源已释放。", "info");
    }, [abortDarkroom, addLog, resetWorkflow]);

    const restoreSession = useCallback((item: any) => {
        handleReset();
        setIsHistoryOpen(false);
        isShootingRef.current = false;
        setCurrentHistoryId(item.id); 
        transitionWorkflow({ type: 'RESTORE_TO_CONCEPT' });
        setUserInput(item.userInput);
        setPlan(item.plan);
        const restoredFrames = item.plan.conceptFrames || item.plan.frames.map((desc: string, i: number) => ({ id: i + 1, description: desc, status: 'pending' }));
        setFrames(restoredFrames);
        setLogs([]); setElapsedTime(0);
        addLog(`暗房会话已恢复｜档案编号：${item.id}`, 'info');
    }, [handleReset, addLog, transitionWorkflow]);

    const handleVoiceInput = useCallback(() => {
        if (isListening) { voiceService.stop(); setIsListening(false); } 
        else { voiceService.start((text, isFinal) => { if (isFinal) setUserInput(p => p + (p ? " " : "") + text); }, setIsListening); }
    }, [isListening]);

    const handleRandomPrompt = useCallback(async () => {
        if (isGeneratingRandom) return;
        setIsGeneratingRandom(true);
        setUserInput("正在连接大师脑波...");
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
        if (appState !== AppState.IDLE) return "已有任务在执行，请先重置或等待结束";
        if (!userInput.trim()) return "请先输入镜头描述";
        return "";
    }, [appState, userInput]);
    const readinessHint = keyConfigured ? "" : "网关状态异常，请检查后端模型 Key 配置";
    const curationSummary = useMemo(() => summarizeCuration(frames), [frames]);

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
