import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, ShootPlan, Frame, ShootStrategy, DirectorModel, LogEntry, FrameMetadata, TextModel, ImageModel, DirectorPacket, DirectorShotPacket } from '../types';
import type { AvailableModelsCatalog } from '../services/api/client';
import { 
    generateShootPlan, 
    generateMicroCasting, 
    generateRandomPrompt, 
    generateProRandomPrompt, 
    expandParallelUniverses, 
    generateMoreFrames,
    validateApiKey, 
    toggleProxyMode, 
    getCustomApiKey, 
    getConnectionStatus, 
    setCustomApiKey,
    setModelPreferences,
    getModelPreferences,
    getAvailableModels,
    refreshAvailableModels,
    voiceService
} from '../services/public'; 

import { useDarkroom } from './useDarkroom';
import { useHistory } from './useHistory';

const DEMO_PROXY_KEY = "";
const hasDemoProxyKey = DEMO_PROXY_KEY.startsWith("sk-");

export const useStudioArchitect = () => {
    
    // ==========================================
    // 状态定义 (State Definitions)
    // ==========================================
    const [appState, setAppState] = useState<AppState>(AppState.IDLE); 
    const [userInput, setUserInput] = useState(() => localStorage.getItem('autosave_input') || ''); 
    const [plan, setPlan] = useState<ShootPlan | null>(null); 
    const [frames, setFrames] = useState<Frame[]>([]); 
    const [selectedConceptUrl, setSelectedConceptUrl] = useState<string | undefined>(undefined); 
    const [keyConfigured, setKeyConfigured] = useState(true); 
    const [connectionMode, setConnectionMode] = useState(getConnectionStatus()); 
    const [strategy, setStrategy] = useState<ShootStrategy>('flash'); 
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

    const startTimeRef = useRef<number>(0); 
    const planningAbortController = useRef<AbortController | null>(null);
    const mainContentRef = useRef<HTMLDivElement>(null); 

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
                await validateApiKey(DEMO_PROXY_KEY);
                setKeyConfigured(true);
                setConnectionMode(getConnectionStatus());
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
        setConnectionMode(getConnectionStatus());
    }, [textModel, imageModel]);

    // 连接状态同步
    useEffect(() => { setConnectionMode(getConnectionStatus()); }, [keyConfigured, showSettingsModal, textModel, imageModel]);

    const handleReset = useCallback(() => {
        if (planningAbortController.current) {
            planningAbortController.current.abort();
            planningAbortController.current = null;
        }
        abortDarkroom();
        isShootingRef.current = false; 
        setAppState(AppState.IDLE);
        setStreamingPlanText(''); setUserInput(''); setPlan(null); setFrames([]); setLogs([]); setSelectedConceptUrl(undefined); setElapsedTime(0); setSelectedProposalId(null);
        setCurrentHistoryId(null);
        addLog("系统已硬复位，所有资源已释放。", "info");
    }, [abortDarkroom, addLog]);

    const restoreSession = useCallback((item: any) => {
        handleReset();
        setIsHistoryOpen(false);
        isShootingRef.current = false;
        setCurrentHistoryId(item.id); 
        setAppState(AppState.CONCEPT); 
        setUserInput(item.userInput);
        setPlan(item.plan);
        const restoredFrames = item.plan.conceptFrames || item.plan.frames.map((desc: string, i: number) => ({ id: i + 1, description: desc, status: 'pending' }));
        setFrames(restoredFrames);
        setLogs([]); setElapsedTime(0);
        addLog(`暗房会话已恢复｜档案编号：${item.id}`, 'info');
    }, [handleReset, addLog]);

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
            setUserInput(generateRandomPrompt()); 
        } finally {
            setIsGeneratingRandom(false);
        }
    }, [isGeneratingRandom]);

    const handleStartPlanning = useCallback(async () => {
        if (!userInput.trim() || appState !== AppState.IDLE) return;
        if (planningAbortController.current) planningAbortController.current.abort();
        planningAbortController.current = new AbortController();
        const signal = planningAbortController.current.signal;
        isShootingRef.current = true;
        setAppState(AppState.PLANNING);
        setStreamingPlanText('');
        setFrames([]); setLogs([]); setSelectedConceptUrl(undefined); setElapsedTime(0); setSelectedProposalId(null);
        setCurrentHistoryId(null); 
        try {
            if (!keyConfigured) {
                addLog("检测到网关状态异常，已启用降级策略继续生成。", "network");
            }
            addLog(`接收到导演指令（文本模型：${directorModel}），正在构建平行宇宙...`, 'info');
            const generatedPlan = await generateShootPlan(userInput, (text) => { 
                if(isShootingRef.current) setStreamingPlanText(text); 
            }, directorModel, 'dramatic', signal);
            if (!isShootingRef.current || signal.aborted) return;
            let variants = generatedPlan.visualVariants || [];
            if (variants.length < 12) { variants = [...variants, ...Array(12 - variants.length).fill("标准视觉方案 - 选角: 默认")]; }
            const proposalFrames: Frame[] = variants.slice(0, 12).map((variantDesc, index) => {
                let vType: 'strict' | 'balanced' | 'creative' = 'balanced';
                if (index < 4) vType = 'strict'; else if (index < 8) vType = 'balanced'; else vType = 'creative';
                const microCasting = generatedPlan.continuity?.character?.details?.join("、") || generateMicroCasting();
                return {
                    id: -1 - index, description: variantDesc, status: 'pending',
                    metadata: { model: imageModel, provider: 'Hybrid', strategy: 'Concept', resolution: 'Std', variant: variantDesc, variantType: vType, type: 'reference', castingTraits: microCasting }
                };
            });
            generatedPlan.conceptFrames = proposalFrames;
            setPlan(generatedPlan);
            setFrames(proposalFrames); 
            setAppState(AppState.CONCEPT);
            const historyId = await addToHistory(generatedPlan, userInput);
            setCurrentHistoryId(historyId || null); 
            addLog(`平行宇宙构建完成。请导演检视 12 种可能方案。`, 'success');
            await executeFrameBatch(proposalFrames, generatedPlan, 'flash', connectionMode.mode === 'proxy', setFrames, setPlan);
        } catch (e: any) {
            if (e.message !== "Aborted") {
                addLog(`剧本解析受阻: ${e.message}`, 'error');
                setAppState(AppState.IDLE);
            } else {
                addLog("任务已中断", 'info');
            }
        }
    }, [userInput, keyConfigured, appState, directorModel, connectionMode.mode, addLog, addToHistory, executeFrameBatch, imageModel]);

    const handleExpandUniverse = async () => {
        if (!plan) return;
        setIsExpandingUniverse(true); isShootingRef.current = true;
        addLog("正在探测新的平行时空...", 'info');
        try {
            const newVariants = await expandParallelUniverses(plan, 6, textModel);
            const startIdx = frames.length;
            const newFrames: Frame[] = newVariants.map((desc, i) => ({
                id: -1 - (startIdx + i), description: desc, status: 'pending',
                metadata: { model: imageModel, provider: 'Hybrid', strategy: 'Concept', resolution: 'Std', variant: desc, variantType: 'creative', type: 'reference' }
            }));
            setFrames(prev => [...prev, ...newFrames]);
            setPlan(prev => prev ? { ...prev, conceptFrames: [...(prev.conceptFrames || []), ...newFrames] } : null);
            await executeFrameBatch(newFrames, plan, 'flash', connectionMode.mode === 'proxy', setFrames, setPlan);
            addLog("新时空探测完毕。", 'success');
        } catch (e: any) { addLog(`时空探测失败: ${e.message}`, 'error'); } finally { setIsExpandingUniverse(false); }
    };

    const buildDirectorShotPacket = (
        packet: DirectorPacket | undefined,
        description: string,
        index: number,
        seed?: Partial<DirectorShotPacket>
    ): DirectorShotPacket => ({
        shotId: `S${String(index + 1).padStart(2, '0')}`,
        beatIndex: index + 1,
        description,
        camera: seed?.camera || 'medium',
        mood: seed?.mood || 'neutral',
        promptPack: {
            base: description,
            style: seed?.promptPack?.style || packet?.styleProfile?.visualSignature || 'Cinematic',
            variantHint: seed?.promptPack?.variantHint || packet?.styleProfile?.visualSignature || 'Cinematic',
        },
        negativePack: Array.isArray(seed?.negativePack) ? [...seed.negativePack] : [],
    });

    const syncPlanWithDirectorPacket = (basePlan: ShootPlan, descriptions: string[]): ShootPlan => {
        const normalized = descriptions.map((item) => String(item || '').trim()).filter(Boolean);
        if (!normalized.length) return basePlan;

        if (!basePlan.directorPacket) {
            return { ...basePlan, frames: normalized };
        }

        const existingShots = Array.isArray(basePlan.directorPacket.shots) ? basePlan.directorPacket.shots : [];
        const nextShots = normalized.map((desc, idx) => {
            const previous = existingShots[idx];
            return buildDirectorShotPacket(basePlan.directorPacket, desc, idx, previous);
        });

        return {
            ...basePlan,
            frames: normalized,
            directorPacket: {
                ...basePlan.directorPacket,
                shots: nextShots,
            },
        };
    };

    const handleConfirmShoot = async () => {
        if (!plan || selectedProposalId === null) return;
        const selectedFrame = frames.find(f => f.id === selectedProposalId);
        if (!selectedFrame || !selectedFrame.imageUrl) return;
        isShootingRef.current = true;
        setAppState(AppState.SHOOTING);
        if (mainContentRef.current) mainContentRef.current.scrollTop = 0;
        startTimeRef.current = Date.now();
        setSelectedConceptUrl(selectedFrame.imageUrl);
        const lockedVariant = selectedFrame.metadata?.variant;
        const lockedCasting = selectedFrame.metadata?.castingTraits;
        addLog(`视觉基调已锁定: [${lockedVariant?.substring(0, 15)}...]。全流水线启动...`, 'info');
        const TARGET_COUNT = 20;
        const packetDescriptions = (plan.directorPacket?.shots || []).map((shot) => shot.description).filter(Boolean);
        const existingDescriptions = packetDescriptions.length > 0 ? packetDescriptions : (plan.frames || []);
        const framesToShoot: Frame[] = [];
        existingDescriptions.forEach((desc, i) => {
             framesToShoot.push({
                id: i + 1,
                description: desc,
                status: 'pending',
                metadata: { ...selectedFrame.metadata, model: imageModel, resolution: strategy === 'pro' ? '4K' : 'Std', type: 'shot' as const, variant: lockedVariant, castingTraits: lockedCasting }
             });
        });
        const needed = TARGET_COUNT - framesToShoot.length;
        for (let i = 0; i < needed; i++) {
             framesToShoot.push({
                id: framesToShoot.length + 1,
                description: "正在等待导演分镜指令...", 
                status: 'scripting', 
                metadata: { ...selectedFrame.metadata, model: imageModel, resolution: strategy === 'pro' ? '4K' : 'Std', type: 'shot' as const, variant: lockedVariant, castingTraits: lockedCasting }
             });
        }
        setFrames(framesToShoot);
        const initialBatch = framesToShoot.filter(f => f.status === 'pending');
        if (initialBatch.length > 0) {
             shootStreamBatch(initialBatch, plan, strategy, connectionMode.mode === 'proxy', setFrames, setPlan);
        }
        if (needed > 0) {
            const startIdx = existingDescriptions.length;
            const CHUNK_SIZE = 5;
            const onChunkReady = async (newScripts: string[], chunkIndex: number) => {
                const chunkStartGlobalIdx = startIdx + (chunkIndex * CHUNK_SIZE);
                const chunkFrames: Frame[] = newScripts.map((desc, i) => {
                     const realId = chunkStartGlobalIdx + i + 1; 
                     return {
                        id: realId,
                        description: desc,
                        status: 'pending', 
                        metadata: { ...selectedFrame.metadata, model: imageModel, resolution: strategy === 'pro' ? '4K' : 'Std', type: 'shot' as const, variant: lockedVariant, castingTraits: lockedCasting }
                     };
                });
                setFrames(prev => {
                    const next = [...prev];
                    chunkFrames.forEach(cf => {
                        const idx = next.findIndex(f => f.id === cf.id);
                        if (idx !== -1) next[idx] = cf;
                    });
                    return next;
                });
                await shootStreamBatch(chunkFrames, plan, strategy, connectionMode.mode === 'proxy', setFrames, setPlan);
            };
             try {
                addLog(`[流水线] 启动并行编剧（目标 20 帧）...`, 'network');
                const allDescriptions = await generateMoreFrames(
                    plan, 
                    needed, 
                    textModel, 
                    (msg) => addLog(msg, 'network'), 
                    lockedVariant,
                    onChunkReady 
                );
                const fullList = [...existingDescriptions, ...allDescriptions];
                const syncedPlan = syncPlanWithDirectorPacket(plan, fullList);
                setPlan({ ...syncedPlan, conceptFrames: frames, selectedConceptId: selectedFrame.id });
                addLog(`[流水线] 所有剧本分发完毕。`, 'success');
             } catch (e) {
                addLog(`剧本扩充遇到阻碍。`, 'error');
             }
        } else {
             const syncedPlan = syncPlanWithDirectorPacket(plan, existingDescriptions);
             setPlan({ ...syncedPlan, conceptFrames: frames, selectedConceptId: selectedFrame.id });
        }
    };

    const handleGenerateMore = async (count: number) => { 
        if (!plan) return;
        setIsExtending(true); isShootingRef.current = true;
        const activeVariantMetadata: FrameMetadata = frames[0]?.metadata || { model: imageModel, provider: 'Hybrid', strategy: 'Concept', resolution: 'Std' };
        const activeStyle = activeVariantMetadata.variant;
        addLog(`[编剧部] 正在构思 ${count} 个新分镜...`, 'network');
        const startId = frames.length + 1;
        const CHUNK_SIZE = 5;
        const onChunkReady = async (newScripts: string[], chunkIndex: number) => {
            const chunkFrames: Frame[] = newScripts.map((desc, i) => ({
                id: startId + (chunkIndex * CHUNK_SIZE) + i,
                description: desc,
                status: 'pending',
                metadata: { ...activeVariantMetadata, type: 'shot' as const }
            }));
            setFrames(prev => [...prev, ...chunkFrames]);
            await shootStreamBatch(chunkFrames, plan, strategy, connectionMode.mode === 'proxy', setFrames, setPlan);
        };
        try {
          const generatedDescriptions = await generateMoreFrames(
              plan, 
              count, 
              textModel, 
              (msg) => addLog(msg, 'network'), 
              activeStyle,
              onChunkReady
          );
          const existingDescriptions = (plan.directorPacket?.shots || []).map((shot) => shot.description).filter(Boolean);
          const baseDescriptions = existingDescriptions.length ? existingDescriptions : (plan.frames || []);
          const fullList = [...baseDescriptions, ...generatedDescriptions];
          const syncedPlan = syncPlanWithDirectorPacket(plan, fullList);
          setPlan(syncedPlan);
          addLog(`[编剧部] 续拍任务分发完毕。`, 'success');
        } catch(e) { console.error(e); } finally { setIsExtending(false); }
    };

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
            setConnectionMode(getConnectionStatus());
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
        elapsedTime,
        activeRequests,
        keyConfigured,
        connectionMode,
        strategy, setStrategy,
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
        hasDemoKey: hasDemoProxyKey,
        mainContentRef,
        handleStartPlanning,
        handleReset,
        handleVoiceInput,
        handleRandomPrompt,
        handleClearInput, 
        handleAutoFillKey: () => {
            if (hasDemoProxyKey) setManualKeyInput(DEMO_PROXY_KEY);
            else addValidationLog("后端网关模式下通常无需前端密钥（可留空）。");
        },
        handleClearKey: () => { setCustomApiKey(null); setManualKeyInput(''); setConnectionMode(getConnectionStatus()); setValidationLogs([]); },
        handleToggleConnectionMode: () => {
            toggleProxyMode();
            const prefs = getModelPreferences();
            setTextModel(prefs.textModel as TextModel);
            setImageModel(prefs.imageModel as ImageModel);
            setConnectionMode(getConnectionStatus());
        },
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
        handleGenerateMore
    };
};
