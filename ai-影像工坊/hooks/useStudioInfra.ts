import React, { useEffect } from 'react';
import { AppState, ImageModel, TextModel } from '../types';
import {
  getAvailableModels,
  refreshAvailableModels,
  setModelPreferences,
  validateApiKey,
} from '../application/studioFacade';
import type { AvailableModelsCatalog } from '../services/api/client';

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

interface StudioInfraParams {
  appState: AppState;
  activeRequests: number;
  startTimeRef: React.MutableRefObject<number>;
  setElapsedTime: Setter<number>;
  userInput: string;
  masterMode: boolean;
  textModel: TextModel;
  imageModel: ImageModel;
  setAvailableModels: Setter<AvailableModelsCatalog>;
  setKeyConfigured: Setter<boolean>;
  addLog: (message: string, type?: 'info' | 'success' | 'error' | 'network', latency?: number) => void;
}

export const useStudioInfra = ({
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
}: StudioInfraParams) => {
  useEffect(() => {
    const initSystem = async () => {
      try {
        await refreshAvailableModels();
        setAvailableModels(getAvailableModels());
        await validateApiKey('');
        setKeyConfigured(true);
        addLog('系统初始化完成：模型网关连接成功。', 'success');
      } catch (e: any) {
        setKeyConfigured(false);
        addLog(`模型网关不可用: ${e.message}`, 'error');
      }
    };

    void initSystem();
  }, [addLog, setAvailableModels, setKeyConfigured]);

  useEffect(() => {
    localStorage.setItem('autosave_input', userInput);
  }, [userInput]);

  useEffect(() => {
    localStorage.setItem('master_mode', masterMode ? '1' : '0');
  }, [masterMode]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (appState === AppState.SHOOTING && activeRequests > 0) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 50);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [appState, activeRequests, setElapsedTime, startTimeRef]);

  useEffect(() => {
    setModelPreferences({ textModel, imageModel });
  }, [textModel, imageModel]);
};
