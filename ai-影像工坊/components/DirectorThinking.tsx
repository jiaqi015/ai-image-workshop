
import React, { useEffect, useState, useRef } from 'react';
import { SparklesIcon, FilmIcon } from './Icons';
import { CREATIVE_MONOLOGUE } from '../assets';

interface DirectorThinkingProps {
  text: string;
}

const FAKE_PROCESS_LOGS = [
  "正在计算光比数据...",
  "加载柯达胶片颗粒...",
  "推演构图几何张力...",
  "检索大师视觉记忆...",
  "校准50mm镜头参数...",
  "分析微表情光谱...",
  "生成体积光雾...",
  "构建景深层次...",
  "测量色温偏移...",
  "模拟物理曝光..."
];

export const DirectorThinking: React.FC<DirectorThinkingProps> = ({ text }) => {
  const [currentThought, setCurrentThought] = useState("导演已就位，准备构思...");
  const [subThought, setSubThought] = useState(""); 
  const [isPulsing, setIsPulsing] = useState(false); // 新增：流脉冲状态
  const [fakeLog, setFakeLog] = useState(FAKE_PROCESS_LOGS[0]); // 伪装日志

  const lastTextLength = useRef(0);
  const thoughtTimeoutRef = useRef<any>(null);
  const pulseTimeoutRef = useRef<any>(null);

  // 随机获取一条独白
  const pickThought = (key: string): string | undefined => {
      const options = CREATIVE_MONOLOGUE[key as keyof typeof CREATIVE_MONOLOGUE];
      if (!options || options.length === 0) return undefined;
      return options[Math.floor(Math.random() * options.length)];
  };

  // 伪日志轮播
  useEffect(() => {
    const timer = setInterval(() => {
      setFakeLog(FAKE_PROCESS_LOGS[Math.floor(Math.random() * FAKE_PROCESS_LOGS.length)]);
    }, 800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!text) return;
    
    // 增量检测
    const currentLength = text.length;
    const delta = currentLength - lastTextLength.current;
    
    if (delta > 0) {
        lastTextLength.current = currentLength;
        
        // 触发脉冲动画: 只要有数据进来，图标就应该亮一下
        setIsPulsing(true);
        if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = setTimeout(() => setIsPulsing(false), 200);

        const newChunk = text.slice(Math.max(0, currentLength - 200)); // 只看最近的

        // 1. 关键词检测 -> 触发主独白
        // 增强正则：匹配更多可能的 key 格式
        const keyMatch = newChunk.match(/"(title|directorInsight|productionNotes|continuity|shootScope|frames|visualVariants)"/);
        if (keyMatch) {
            const key = keyMatch[1];
            const newMonologue = pickThought(key);
            if (newMonologue) {
                if (thoughtTimeoutRef.current) clearTimeout(thoughtTimeoutRef.current);
                thoughtTimeoutRef.current = setTimeout(() => {
                    setCurrentThought(newMonologue);
                    setSubThought(""); // 清空副独白，此时显示伪日志
                }, 300);
            }
        }

        // 2. 内容检测 -> 触发副独白
        // 尝试捕获中文字符串
        const contentMatch = newChunk.match(/[\u4e00-\u9fa5]{4,15}/);
        if (contentMatch) {
             setSubThought(`"${contentMatch[0]}..."`);
        }
    }

  }, [text]);

  const displaySub = subThought || fakeLog;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 relative overflow-hidden bg-[#0c0c0e]">
        
        {/* 背景 */}
        <div className="absolute inset-0 bg-grain opacity-20 pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-transparent pointer-events-none"></div>

        <div className="z-10 w-full max-w-md flex flex-col items-center gap-8 text-center">
            
            {/* 视觉锚点：会随数据流呼吸 */}
            <div className="relative transition-all duration-200" style={{ transform: isPulsing ? 'scale(1.1)' : 'scale(1)' }}>
                <div className={`absolute inset-0 bg-amber-500 blur-[40px] opacity-20 transition-opacity duration-200 ${isPulsing ? 'opacity-40' : 'opacity-20'}`}></div>
                <div className={`relative bg-zinc-900/80 p-4 rounded-full border shadow-2xl backdrop-blur-sm transition-colors duration-200 ${isPulsing ? 'border-amber-500/50' : 'border-white/5'}`}>
                    <SparklesIcon className={`w-6 h-6 transition-colors duration-200 ${isPulsing ? 'text-amber-400' : 'text-amber-500/50'}`} />
                </div>
            </div>

            {/* 核心区域：导演独白 */}
            <div className="flex flex-col gap-4 min-h-[120px] justify-center items-center">
                <h3 
                  className="text-xl md:text-2xl font-serif text-zinc-200 tracking-wide leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-700"
                  key={currentThought}
                >
                    {currentThought}
                </h3>
                
                <div className="h-6 flex items-center justify-center gap-3">
                    <span className={`w-1 h-1 bg-amber-600 rounded-full shadow-[0_0_8px_currentColor] ${subThought ? 'animate-pulse' : 'animate-ping'}`}></span>
                    <p className={`text-xs font-serif tracking-widest italic animate-in fade-in zoom-in-95 duration-500 ${subThought ? 'text-zinc-400/80' : 'text-zinc-600'}`}>
                        {displaySub}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4 opacity-30">
                <div className="h-px w-12 bg-zinc-500"></div>
                <FilmIcon className="w-3 h-3 text-zinc-500" />
                <div className="h-px w-12 bg-zinc-500"></div>
            </div>

        </div>
    </div>
  );
};
