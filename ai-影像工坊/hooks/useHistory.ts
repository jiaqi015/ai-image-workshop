import { useState, useEffect, useCallback } from 'react';
import { HistoryItem } from '../components/HistorySidebar';
import { dbService, MemoryManager } from '../application/studioFacade';
import { ShootPlan, Frame } from '../types';

type HistoryPatch = Partial<HistoryItem> & { plan?: ShootPlan };

const sortByTimeDesc = (items: HistoryItem[]) =>
  [...items].sort((a, b) => Number(b.updatedAt || b.timestamp || 0) - Number(a.updatedAt || a.timestamp || 0));

export const useHistory = (addLog: (msg: string, type?: any) => void) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const buildHistoryId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const dehydrateFrames = useCallback(async (frames: Frame[]) => {
    return Promise.all(
      frames.map(async (frame) => {
        if (frame.imageUrl && frame.imageUrl.startsWith('blob:')) {
          try {
            const base64 = await MemoryManager.hydrateToBase64(frame.imageUrl);
            return { ...frame, imageUrl: base64 };
          } catch {
            return frame;
          }
        }
        return frame;
      })
    );
  }, []);

  const dehydratePlan = useCallback(
    async (plan: ShootPlan) => {
      const dehydratedPlan = { ...plan };
      if (Array.isArray(dehydratedPlan.conceptFrames)) {
        dehydratedPlan.conceptFrames = await dehydrateFrames(dehydratedPlan.conceptFrames);
      }
      if (Array.isArray(dehydratedPlan.renderFrames)) {
        dehydratedPlan.renderFrames = await dehydrateFrames(dehydratedPlan.renderFrames);
      }
      return dehydratedPlan;
    },
    [dehydrateFrames]
  );

  const mergeFramesById = useCallback((baseFrames: Frame[] | undefined, incomingFrames: Frame[]) => {
    const merged = new Map<number, Frame>();
    (baseFrames || []).forEach((frame) => merged.set(frame.id, frame));
    incomingFrames.forEach((frame) => {
      const previous = merged.get(frame.id);
      merged.set(frame.id, previous ? { ...previous, ...frame } : frame);
    });
    return [...merged.values()].sort((a, b) => a.id - b.id);
  }, []);

  const mergeHistoryItem = useCallback((items: HistoryItem[], item: HistoryItem) => {
    const index = items.findIndex((entry) => entry.id === item.id);
    if (index === -1) return sortByTimeDesc([item, ...items]);
    const next = [...items];
    next[index] = item;
    return sortByTimeDesc(next);
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const items = await dbService.getAllItems();
        setHistory(sortByTimeDesc(items));
      } catch (e) {
        console.error('Failed to load history', e);
        addLog('创作历史读取失败', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, [addLog]);

  const addToHistory = useCallback(
    async (plan: ShootPlan, userInput: string, patch?: HistoryPatch) => {
      const now = Date.now();
      const baseTimestamp = Number(patch?.timestamp || now);
      const dehydratedPlan = await dehydratePlan(plan);
      const newItem: HistoryItem = {
        id: patch?.id || buildHistoryId(),
        timestamp: baseTimestamp,
        updatedAt: now,
        createdAtIso: patch?.createdAtIso || new Date(baseTimestamp).toISOString(),
        updatedAtIso: new Date(now).toISOString(),
        clientIp: patch?.clientIp || 'local',
        source: patch?.source || 'indexeddb',
        taskStatus: patch?.taskStatus || 'concept',
        userInput: patch?.userInput ?? userInput,
        plan: dehydratedPlan,
      };

      setHistory((prev) => mergeHistoryItem(prev, newItem));

      try {
        await dbService.saveItem(newItem);
      } catch (e) {
        console.error('Save failed', e);
        addLog('创作历史保存失败（可能存储空间不足）', 'error');
      }

      return newItem.id;
    },
    [addLog, dehydratePlan, mergeHistoryItem]
  );

  const updateHistoryItem = useCallback(
    async (timestampId: string, updatedFrames?: Frame[] | null, patch?: HistoryPatch) => {
      try {
        const items = await dbService.getAllItems();
        const targetItem = items.find((i) => i.id === timestampId || i.timestamp.toString() === timestampId);
        if (!targetItem) return;

        let nextPlan = patch?.plan ? await dehydratePlan(patch.plan) : { ...targetItem.plan };
        if (Array.isArray(updatedFrames)) {
          const dehydratedFrames = await dehydrateFrames(updatedFrames);
          const conceptUpdates: Frame[] = [];
          const renderUpdates: Frame[] = [];
          dehydratedFrames.forEach((frame) => {
            const frameType = String(frame?.metadata?.type || '').toLowerCase();
            if (frame.id < 0 || frameType === 'reference') {
              conceptUpdates.push(frame);
            } else {
              renderUpdates.push(frame);
            }
          });

          if (conceptUpdates.length > 0) {
            nextPlan = {
              ...nextPlan,
              conceptFrames: mergeFramesById(nextPlan.conceptFrames, conceptUpdates),
            };
          }
          if (renderUpdates.length > 0) {
            nextPlan = {
              ...nextPlan,
              renderFrames: mergeFramesById(nextPlan.renderFrames, renderUpdates),
            };
          }
        }

        const now = Date.now();
        const updatedItem: HistoryItem = {
          ...targetItem,
          ...patch,
          updatedAt: now,
          updatedAtIso: new Date(now).toISOString(),
          userInput: patch?.userInput ?? targetItem.userInput,
          plan: nextPlan,
        };

        await dbService.saveItem(updatedItem);
        setHistory((prev) => mergeHistoryItem(prev, updatedItem));
      } catch (e) {
        console.error('Failed to update history item', e);
      }
    },
    [dehydrateFrames, dehydratePlan, mergeFramesById, mergeHistoryItem]
  );

  const deleteHistoryItem = useCallback(
    async (id: string) => {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      try {
        await dbService.deleteItem(id);
      } catch (e) {
        console.error('Delete failed', e);
        addLog('创作历史删除失败', 'error');
      }
    },
    [addLog]
  );

  return {
    history,
    isLoading,
    addToHistory,
    updateHistoryItem,
    deleteHistoryItem,
  };
};
