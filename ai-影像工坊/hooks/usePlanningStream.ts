import { useEffect, useMemo, useRef, useState } from 'react';

const PREHEAT_STEPS = ['解析需求', '整理角色与场景', '生成候选方案', '补全镜头细节', '准备首批画面'] as const;

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
  const [currentThought, setCurrentThought] = useState('系统正在处理...');
  const [subThought, setSubThought] = useState('等待生成内容...');
  const [streamEchoes, setStreamEchoes] = useState<string[]>([]);

  const lastTextLength = useRef(0);

  useEffect(() => {
    if (!text) {
      setCurrentThought('系统正在处理...');
      setSubThought('等待生成内容...');
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
        title: '正在生成项目标题',
        directorInsight: '正在整理创作思路',
        productionNotes: '正在生成执行建议',
        continuity: '正在整理一致性配置',
        shootScope: '正在确认拍摄约束',
        frames: '正在拆解镜头列表',
        visualVariants: '正在生成候选方案',
      };
      const nextThought = thoughtByKey[keyMatch[1]];
      if (nextThought) {
        setCurrentThought(nextThought);
      }
    }

    const chineseContentMatch = newChunk.match(/[\u4e00-\u9fa5]{2,24}/);
    if (chineseContentMatch) {
      setSubThought(`「${chineseContentMatch[0]}...」`);
    }

    const chunks = newChunk
      .split(/[\n,，。；;:：]/)
      .map((item) => item.trim())
      .filter((item) => /[\u4e00-\u9fa5]/.test(item) && item.length >= 2)
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
