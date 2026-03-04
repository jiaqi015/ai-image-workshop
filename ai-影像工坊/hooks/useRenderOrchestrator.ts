
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Frame, ShootPlan, ShootStrategy, FrameMetadata } from '../types';
import { generateFrameImage, MemoryManager, ExecutionPolicy, getModelPreferences } from '../application/studioFacade'; // Updated Import
import { selectFrameModelType } from '../services/routing/policy';
import { localizeRuntimeText } from '../application/uiText';

// ==========================================
// Darkroom Hook (Core Execution Logic)
// 职责: 管理批量拍摄、并发控制、重试机制、状态更新
// 升级: 增加 shootStreamBatch 支持流式并发
// ==========================================

export const useRenderOrchestrator = (
    addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'network', latency?: number) => void
) => {
    const [activeRequests, setActiveRequests] = useState(0);
    const isShootingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const activeBatchLimitsRef = useRef<number[]>([]);
    const semaphoreRef = useRef<{
        active: number;
        waiters: Array<{ resolve: () => void; reject: (error: Error) => void }>;
    }>({ active: 0, waiters: [] });

    const getGlobalConcurrencyLimit = useCallback(() => {
        const limits = activeBatchLimitsRef.current;
        if (!limits.length) return 1;
        const computed = Math.min(...limits);
        return Number.isFinite(computed) && computed > 0 ? computed : 1;
    }, []);

    const drainSemaphore = useCallback(() => {
        const sem = semaphoreRef.current;
        while (sem.waiters.length > 0 && sem.active < getGlobalConcurrencyLimit()) {
            const waiter = sem.waiters.shift();
            if (!waiter) continue;
            sem.active += 1;
            waiter.resolve();
        }
    }, [getGlobalConcurrencyLimit]);

    const acquireSlot = useCallback((signal?: AbortSignal): Promise<void> => {
        if (signal?.aborted) return Promise.reject(new Error("Aborted"));

        const sem = semaphoreRef.current;
        if (sem.active < getGlobalConcurrencyLimit()) {
            sem.active += 1;
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            let detached = false;
            const detachAbort = () => {
                if (detached || !signal) return;
                signal.removeEventListener("abort", onAbort);
                detached = true;
            };
            const onAbort = () => {
                const index = sem.waiters.findIndex((entry) => entry.reject === wrappedReject);
                if (index >= 0) sem.waiters.splice(index, 1);
                wrappedReject(new Error("Aborted"));
            };
            const wrappedResolve = () => {
                detachAbort();
                resolve();
            };
            const wrappedReject = (error: Error) => {
                detachAbort();
                reject(error);
            };

            if (signal) signal.addEventListener("abort", onAbort, { once: true });
            sem.waiters.push({ resolve: wrappedResolve, reject: wrappedReject });
        });
    }, [getGlobalConcurrencyLimit]);

    const releaseSlot = useCallback(() => {
        const sem = semaphoreRef.current;
        sem.active = Math.max(0, sem.active - 1);
        drainSemaphore();
    }, [drainSemaphore]);

    const clearWaitingSlots = useCallback(() => {
        const sem = semaphoreRef.current;
        const pending = sem.waiters.splice(0, sem.waiters.length);
        for (const waiter of pending) {
            waiter.reject(new Error("Aborted"));
        }
    }, []);

    // 清理逻辑：组件卸载时释放所有 Blob 并取消请求
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            MemoryManager.releaseAll();
        };
    }, []);

    // 核心: 单帧处理与重试
    const processFrameWithRetry = useCallback(async (
        plan: ShootPlan, 
        frame: Frame, 
        initialModel: 'pro' | 'flash', 
        initialMetadata: FrameMetadata,
        setFrames: React.Dispatch<React.SetStateAction<Frame[]>>,
        setPlan: React.Dispatch<React.SetStateAction<ShootPlan | null>>,
        signal?: AbortSignal
    ) => {
        const currentMetadata = { ...initialMetadata };
        const classifyErrorReason = (raw: string) => {
            const text = String(raw || '').toLowerCase();
            if (text.includes('429') || text.includes('quota') || text.includes('rate')) {
                return '配额或限流';
            }
            if (text.includes('timeout') || text.includes('timed out') || text.includes('network')) {
                return '网络超时';
            }
            if (text.includes('auth') || text.includes('unauthorized') || text.includes('forbidden') || text.includes('401') || text.includes('403')) {
                return '鉴权失败';
            }
            if (text.includes('content') || text.includes('policy') || text.includes('safety')) {
                return '内容策略拦截';
            }
            return '生成异常';
        };
        
        setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'generating', metadata: currentMetadata } : f));
        
        try {
            // 透传 signal 到 camera engine, 确保网络请求能被取消
            const genPromise = generateFrameImage(plan, frame.description, initialModel, currentMetadata, signal);
            const minTimePromise = new Promise(resolve => setTimeout(resolve, 1000));
            
            const [base64Image] = await Promise.all([genPromise, minTimePromise]);
            
            if (signal?.aborted) return; 

            const optimizedUrl = MemoryManager.allocate(base64Image);

            if (isShootingRef.current && !signal?.aborted) {
                setFrames(prev => prev.map(f => {
                    if (f.id !== frame.id) return f;
                    if (f.imageUrl && f.imageUrl !== optimizedUrl) {
                        MemoryManager.release(f.imageUrl);
                    }
                    return { ...f, status: 'completed', imageUrl: optimizedUrl, metadata: currentMetadata };
                }));
                
                setPlan(prev => {
                    if (!prev || !prev.conceptFrames) return prev;
                    const updatedConcepts = prev.conceptFrames.map(cf => 
                        cf.id === frame.id ? { ...cf, status: 'completed', imageUrl: optimizedUrl, metadata: currentMetadata } : cf
                    ) as Frame[]; 
                    return { ...prev, conceptFrames: updatedConcepts };
                });
            } else {
                MemoryManager.release(optimizedUrl);
            }
        } catch (e: any) {
            if (signal?.aborted || e.message === "Aborted") return;
            console.error(`Frame #${frame.id} Final Failure:`, e);
            if (isShootingRef.current) {
                const rawErrorMsg = e?.message || '未知生成错误';
                const reason = classifyErrorReason(rawErrorMsg);
                const brief = localizeRuntimeText(String(rawErrorMsg).replace(/\s+/g, ' ').slice(0, 64));
                
                addLog(`第 ${frame.id} 帧生成失败 | ${reason}: ${brief}`, 'error');
                setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'failed', error: `${reason}：${brief}` } : f));
            }
        }
    }, [addLog]);

    // 1. 阻塞式批量执行 (Legacy / Hard Refresh)
    const executeFrameBatch = useCallback(async (
        framesToProcess: Frame[], 
        currentPlan: ShootPlan, 
        currentStrategy: ShootStrategy,
        setFrames: React.Dispatch<React.SetStateAction<Frame[]>>,
        setPlan: React.Dispatch<React.SetStateAction<ShootPlan | null>>
    ) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort(); // 杀掉旧的
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        const policy = ExecutionPolicy.resolve(currentStrategy);

        const queue = [...framesToProcess];
        const totalFrames = framesToProcess.length;
        let dequeuedCount = 0;
        
        const processNext = async () => {
            if (signal.aborted || !isShootingRef.current) return; 
            if (queue.length === 0) return;
            const frame = queue.shift();
            if (!frame) return;

            const frameIndex = dequeuedCount;
            dequeuedCount += 1;

            const targetModel: 'pro' | 'flash' = selectFrameModelType({
                strategy: currentStrategy,
                description: frame.description,
                frameIndex,
                totalFrames
            });

            const metadata: FrameMetadata = {
                model: getModelPreferences().imageModel,
                provider: 'Gateway',
                strategy: targetModel === 'pro' ? 'Pro' : 'Flash',
                resolution: targetModel === 'pro' ? '4K' : 'Std',
                variant: frame.metadata?.variant,
                variantType: frame.metadata?.variantType, 
                type: frame.metadata?.type,
                castingTraits: frame.metadata?.castingTraits 
            };

            setActiveRequests(prev => prev + 1);
            try {
                await processFrameWithRetry(currentPlan, frame, targetModel, metadata, setFrames, setPlan, signal);
            } catch(e) {}
            setActiveRequests(prev => Math.max(0, prev - 1));
            
            if (isShootingRef.current && !signal.aborted && queue.length > 0) {
                 await processNext();
            }
        };

        const workers = [];
        const initialBatchSize = Math.min(policy.concurrency, framesToProcess.length);
        addLog(`批量生成已启动 | 并发: ${policy.concurrency}`, 'info');
        
        for (let i = 0; i < initialBatchSize; i++) {
             workers.push((async () => {
                 await new Promise(r => setTimeout(r, i * policy.staggerDelay)); 
                 if (!signal.aborted) await processNext();
             })());
        }
        await Promise.all(workers);
    }, [addLog, processFrameWithRetry]);

    // 2. 流式非阻塞执行 (New Pipeline Support)
    const shootStreamBatch = useCallback(async (
        frames: Frame[],
        plan: ShootPlan,
        strategy: ShootStrategy,
        setFrames: React.Dispatch<React.SetStateAction<Frame[]>>,
        setPlan: React.Dispatch<React.SetStateAction<ShootPlan | null>>
    ) => {
         // 确保有一个活跃的控制器，但不重置它（允许叠加）
         if (!abortControllerRef.current) abortControllerRef.current = new AbortController();
         const signal = abortControllerRef.current.signal;
         const policy = ExecutionPolicy.resolve(strategy);
         activeBatchLimitsRef.current.push(Math.max(1, policy.concurrency));
         drainSemaphore();
         
         addLog(`已加入生成队列: ${frames.length} 帧 | 并发: ${policy.concurrency}`, 'network');

         const tasks = frames.map((frame, index) => (async () => {
            if (signal.aborted || !isShootingRef.current) return;
            if (index > 0 && policy.staggerDelay > 0) {
                await new Promise(r => setTimeout(r, policy.staggerDelay));
                if (signal.aborted || !isShootingRef.current) return;
            }

            let slotAcquired = false;
            try {
                await acquireSlot(signal);
                slotAcquired = true;
                if (signal.aborted || !isShootingRef.current) return;

                const targetModel: 'pro' | 'flash' = selectFrameModelType({
                    strategy,
                    description: frame.description,
                    frameIndex: index,
                    totalFrames: frames.length
                });

                const metadata: FrameMetadata = {
                    model: getModelPreferences().imageModel,
                    provider: 'Gateway',
                    strategy: strategy,
                    resolution: targetModel === 'pro' ? '4K' : 'Std',
                    variant: frame.metadata?.variant,
                    variantType: frame.metadata?.variantType,
                    type: frame.metadata?.type || 'shot',
                    castingTraits: frame.metadata?.castingTraits
                };

                setActiveRequests(p => p + 1);
                try {
                    await processFrameWithRetry(plan, frame, targetModel, metadata, setFrames, setPlan, signal);
                } finally {
                    setActiveRequests(p => Math.max(0, p - 1));
                }
            } finally {
                if (slotAcquired) releaseSlot();
            }
         })());

         try {
            await Promise.allSettled(tasks);
         } finally {
            const limits = activeBatchLimitsRef.current;
            const idx = limits.lastIndexOf(Math.max(1, policy.concurrency));
            if (idx >= 0) limits.splice(idx, 1);
            drainSemaphore();
         }
    }, [acquireSlot, addLog, drainSemaphore, processFrameWithRetry, releaseSlot]);

    // 暴露中止方法
    const abortAll = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setActiveRequests(0); 
        }
        activeBatchLimitsRef.current = [];
        semaphoreRef.current.active = 0;
        clearWaitingSlots();
        MemoryManager.releaseAll();
    }, [clearWaitingSlots]);

    return {
        activeRequests,
        setActiveRequests,
        isShootingRef,
        processFrameWithRetry,
        executeFrameBatch,
        shootStreamBatch, // Exported for pipeline
        abortAll 
    };
};
