import { useEffect, useMemo, useRef, useState } from 'react';

const PREHEAT_STEPS = ['解析创作意图', '锁定角色合同', '编译分镜语法', '预热镜头语言', '准备首批画面'] as const;

export interface PlanningStreamSnapshot {
  currentThought: string;
  displaySubThought: string;
  streamLines: string[];
  streamProgress: number;
  stageProgress: number;
  activeStepIndex: number;
  isPulsing: boolean;
  charCount: number;
  preheatSteps: readonly string[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const usePlanningStream = (text: string): PlanningStreamSnapshot => {
  const [currentThought, setCurrentThought] = useState('导演处理中...');
  const [subThought, setSubThought] = useState('等待流式内容...');
  const [streamEchoes, setStreamEchoes] = useState<string[]>([]);

  const lastTextLength = useRef(0);

  useEffect(() => {
    if (!text) {
      setCurrentThought('导演处理中...');
      setSubThought('等待流式内容...');
      setStreamEchoes([]);
      lastTextLength.current = 0;
      return;
    }

    const currentLength = text.length;
    const delta = currentLength - lastTextLength.current;
    lastTextLength.current = currentLength;

    const newChunk = text.slice(Math.max(0, currentLength - 280));

    if (delta <= 0) return;

    const keyMatch = newChunk.match(/"(title|directorInsight|productionNotes|continuity|shootScope|frames|visualVariants)"/);
    if (keyMatch) {
      const thoughtByKey: Record<string, string> = {
        title: '正在生成片名与主旨',
        directorInsight: '正在整理导演阐述',
        productionNotes: '正在生成执行说明',
        continuity: '正在锁定角色连续性',
        shootScope: '正在确定拍摄范围',
        frames: '正在拆解分镜列表',
        visualVariants: '正在生成视觉变体',
      };
      const nextThought = thoughtByKey[keyMatch[1]];
      if (nextThought) {
        setCurrentThought(nextThought);
      }
    }

    const contentMatch = newChunk.match(/[\u4e00-\u9fa5A-Za-z0-9]{4,24}/);
    if (contentMatch) {
      setSubThought(`"${contentMatch[0]}..."`);
    }

    const chunks = newChunk
      .split(/[\n,，。；;:：]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 4)
      .slice(-2);
    if (chunks.length > 0) {
      setStreamEchoes((prev) => [...prev, ...chunks].slice(-8));
    }
  }, [text]);

  const normalizedLines = useMemo(() => {
    if (streamEchoes.length > 0) return streamEchoes.slice(-6);
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (!normalized) return [];
    const chunks: string[] = [];
    for (let i = 0; i < normalized.length; i += 28) {
      chunks.push(normalized.slice(i, i + 28));
    }
    return chunks.slice(-6);
  }, [streamEchoes, text]);

  const displaySubThought = subThought;
  const streamProgress = clamp(Math.floor(text.length / 10), 12, 94);
  const stageProgress = clamp(Math.floor(text.length / 12), 8, 92);
  const activeStepIndex = Math.min(PREHEAT_STEPS.length - 1, Math.floor((stageProgress / 100) * PREHEAT_STEPS.length));

  return {
    currentThought,
    displaySubThought,
    streamLines: normalizedLines,
    streamProgress,
    stageProgress,
    activeStepIndex,
    isPulsing: false,
    charCount: Math.max(text.length, 1),
    preheatSteps: PREHEAT_STEPS,
  };
};
