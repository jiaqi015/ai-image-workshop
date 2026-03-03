
import { useState, useEffect, useCallback } from 'react';
import { HistoryItem } from '../components/HistorySidebar';
import { dbService, MemoryManager } from '../services/public'; // Updated Import Source
import { ShootPlan, Frame } from '../types';

// ==========================================
// History Hook (Data Persistence Logic)
// 职责: 连接 IndexedDB 与 UI 状态，处理异步读写
// 升级: 增加 Update 能力，支持生成后回写
// ==========================================

export const useHistory = (addLog: (msg: string, type?: any) => void) => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const buildHistoryId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 初始化加载
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const items = await dbService.getAllItems();
                setHistory(items);
            } catch (e) {
                console.error("Failed to load history", e);
                addLog("警告: 历史档案库读取失败", "error");
            } finally {
                setIsLoading(false);
            }
        };
        loadHistory();
    }, []);

    // 新增记录
    const addToHistory = useCallback(async (plan: ShootPlan, userInput: string) => {
        // 1. 数据脱水
        const dehydratedPlan = { ...plan };
        if (dehydratedPlan.conceptFrames) {
            dehydratedPlan.conceptFrames = await Promise.all(
                dehydratedPlan.conceptFrames.map(async (frame) => {
                    if (frame.imageUrl && frame.imageUrl.startsWith('blob:')) {
                        const base64 = await MemoryManager.hydrateToBase64(frame.imageUrl);
                        return { ...frame, imageUrl: base64 };
                    }
                    return frame;
                })
            );
        }

        const newItem: HistoryItem = { 
            id: buildHistoryId(), 
            timestamp: Date.now(), 
            userInput, 
            plan: dehydratedPlan 
        };
        
        setHistory(prev => [newItem, ...prev]);

        try {
            await dbService.saveItem(newItem);
        } catch (e) {
            console.error("Save failed", e);
            addLog("错误: 拍摄计划归档失败 (存储空间不足?)", "error");
        }

        return newItem.id;
    }, [addLog]);

    // 关键升级：更新历史记录 (回写图片)
    // 当正片拍摄完成后，需要把生成的图片 Base64 回写到历史记录里，否则刷新后就没了
    const updateHistoryItem = useCallback(async (timestampId: string, updatedFrames: Frame[]) => {
        try {
            // 1. 查找现有记录
            const items = await dbService.getAllItems();
            const targetItem = items.find(i => i.id === timestampId || i.timestamp.toString() === timestampId);
            
            if (!targetItem) return;

            // 2. 脱水处理 (Blob -> Base64)
            const dehydratedFrames = await Promise.all(
                updatedFrames.map(async (frame) => {
                    if (frame.imageUrl && frame.imageUrl.startsWith('blob:')) {
                        const base64 = await MemoryManager.hydrateToBase64(frame.imageUrl);
                        return { ...frame, imageUrl: base64 };
                    }
                    return frame;
                })
            );

            // 3. 更新结构
            const updatedItem: HistoryItem = {
                ...targetItem,
                plan: {
                    ...targetItem.plan,
                    // 如果是概念阶段，更新 conceptFrames；如果是正片，这里假设我们只存了 ConceptFrames
                    // 实际上，为了支持正片存储，我们需要扩展 ShootPlan 的存储逻辑。
                    // 这里我们暂时把正片帧也存入 conceptFrames (如果 ID 匹配) 或者需要扩展 Plan 结构
                    // 为了简单起见，我们假设这是更新 conceptFrames
                    conceptFrames: dehydratedFrames 
                }
            };
            
            // 4. 写回
            await dbService.saveItem(updatedItem);
            
            // 5. 更新 UI
            setHistory(prev => prev.map(item => item.id === targetItem.id ? updatedItem : item));
            
            // console.debug("History updated with generated images");

        } catch (e) {
            console.error("Failed to update history item", e);
        }
    }, []);

    // 删除记录
    const deleteHistoryItem = useCallback(async (id: string) => {
        setHistory(prev => prev.filter(item => item.id !== id));
        try {
            await dbService.deleteItem(id);
        } catch (e) {
            console.error("Delete failed", e);
            addLog("错误: 档案删除失败", "error");
        }
    }, [addLog]);

    return {
        history,
        isLoading,
        addToHistory,
        updateHistoryItem, // Exported
        deleteHistoryItem
    };
};
