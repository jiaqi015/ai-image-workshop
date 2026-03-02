
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Frame, ShootPlan, ShootStrategy, FrameMetadata } from '../types';
import { generateFrameImage, MemoryManager, ExecutionPolicy } from '../services/public'; // Updated Import

// ==========================================
// Darkroom Hook (Core Execution Logic)
// 职责: 管理批量拍摄、并发控制、重试机制、状态更新
// 升级: 增加 shootStreamBatch 支持流式并发
// ==========================================

export const useDarkroom = (
    addLog: (msg: string, type?: 'info' | 'success' | 'error' | 'network', latency?: number) => void
) => {
    const [activeRequests, setActiveRequests] = useState(0);
    const isShootingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);

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
        
        setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'generating', metadata: currentMetadata } : f));
        
        try {
            // 透传 signal 到 camera engine, 确保网络请求能被取消
            const genPromise = generateFrameImage(plan, frame.description, initialModel, currentMetadata, signal);
            const minTimePromise = new Promise(resolve => setTimeout(resolve, 1000));
            
            const [base64Image] = await Promise.all([genPromise, minTimePromise]);
            
            if (signal?.aborted) return; 

            const optimizedUrl = MemoryManager.allocate(base64Image);

            if (isShootingRef.current && !signal?.aborted) {
                setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'completed', imageUrl: optimizedUrl, metadata: currentMetadata } : f));
                
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
                const errorMsg = e?.message || '未知渲染错误';
                const isQuota = errorMsg.includes('429') || errorMsg.includes('quota');
                
                addLog(`底片 #${frame.id} 冲印废片 | ${isQuota ? 'API限流(请稍后)' : '错误'}: ${errorMsg}`, 'error');
                setFrames(prev => prev.map(f => f.id === frame.id ? { ...f, status: 'failed', error: isQuota ? 'API限流' : '失败' } : f));
            }
        }
    }, [addLog]);

    // 1. 阻塞式批量执行 (Legacy / Hard Refresh)
    const executeFrameBatch = useCallback(async (
        framesToProcess: Frame[], 
        currentPlan: ShootPlan, 
        currentStrategy: ShootStrategy,
        isProxy: boolean,
        setFrames: React.Dispatch<React.SetStateAction<Frame[]>>,
        setPlan: React.Dispatch<React.SetStateAction<ShootPlan | null>>
    ) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort(); // 杀掉旧的
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        const policy = ExecutionPolicy.resolve(currentStrategy, 'gpt-5.1', isProxy);

        const queue = [...framesToProcess];
        const totalFrames = framesToProcess.length;
        
        const processNext = async () => {
            if (signal.aborted || !isShootingRef.current) return; 
            if (queue.length === 0) return;
            const frame = queue.shift();
            if (!frame) return;

            let targetModel: 'pro' | 'flash' = 'pro';
            if (currentStrategy === 'flash') targetModel = 'flash';
            else if (currentStrategy === 'hybrid') targetModel = ExecutionPolicy.routeHybridFrame(frame.description, frame.id, totalFrames);
            else targetModel = 'pro';

            const metadata: FrameMetadata = {
                model: targetModel === 'pro' ? 'gemini-3-pro' : 'gemini-2.5-flash',
                provider: isProxy ? 'Proxy' : 'Direct',
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
        addLog(`启动暗房引擎 (Batch) | 并发: ${policy.concurrency}`, 'info');
        
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
        isProxy: boolean,
        setFrames: React.Dispatch<React.SetStateAction<Frame[]>>,
        setPlan: React.Dispatch<React.SetStateAction<ShootPlan | null>>
    ) => {
         // 确保有一个活跃的控制器，但不重置它（允许叠加）
         if (!abortControllerRef.current) abortControllerRef.current = new AbortController();
         const signal = abortControllerRef.current.signal;
         
         addLog(`流式任务注入: ${frames.length} 帧进入队列`, 'network');

         frames.forEach(async (frame, i) => {
             // 简单的错峰，防止瞬间并发过高触发429
             await new Promise(r => setTimeout(r, i * 800)); 
             if (signal.aborted) return;

             let targetModel: 'pro' | 'flash' = strategy === 'pro' ? 'pro' : 'flash';
             // Hybrid simple logic for stream
             if (strategy === 'hybrid') targetModel = 'flash'; 

             const metadata: FrameMetadata = {
                model: targetModel === 'pro' ? 'gemini-3-pro' : 'gemini-2.5-flash',
                provider: isProxy ? 'Proxy' : 'Direct',
                strategy: strategy,
                resolution: targetModel === 'pro' ? '4K' : 'Std',
                variant: frame.metadata?.variant,
                variantType: frame.metadata?.variantType, 
                type: 'shot',
                castingTraits: frame.metadata?.castingTraits 
            };

             setActiveRequests(p => p + 1);
             try {
                 await processFrameWithRetry(plan, frame, targetModel, metadata, setFrames, setPlan, signal);
             } finally {
                 setActiveRequests(p => Math.max(0, p - 1));
             }
         });
    }, [addLog, processFrameWithRetry]);

    // 暴露中止方法
    const abortAll = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setActiveRequests(0); 
        }
    }, []);

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
