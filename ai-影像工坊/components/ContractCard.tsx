
import React from 'react';
import { ShootContract, ShootGuide, Frame, ShootPlan, CharacterProfile, WardrobeProfile, SetProfile, ProductionNotes } from '../types';
import { SparklesIcon, ZoomInIcon, FilmIcon, TerminalIcon } from './Icons';

// 组件属性定义
interface ContractCardProps {
  contract: ShootContract;       // 拍摄合约数据
  title: string;                 // 影片标题
  directorInsight?: string;      // 导演阐述
  productionNotes?: ProductionNotes; // 具体的执行笔记
  shootGuide?: ShootGuide;       // 表演指导
  shootScope?: ShootPlan['shootScope']; // 制作范围
  continuity?: ShootPlan['continuity']; // 连戏配置 (核心数据)
  conceptFrames?: Frame[];       // 概念预览图列表
  selectedConceptId?: number;    // 当前选中的概念ID
  visualReferenceImageUrl?: string; // 选中的参考图URL
  onSelectConcept?: (id: number) => void; // 选择概念的回调
  onGenerateMore?: () => void;   // 续拍回调
  isExtending?: boolean;         // 是否正在续拍中
  onPreviewConcept?: (url: string) => void; // 预览大图回调
}

// --- 核心组件：多选项渲染器 (Option Parser) ---
// 职责: 识别 "Option A ... || Option B ..." 格式，并将其渲染为独立的视觉块
const OptionRenderer = ({ text, isUser }: { text: string, isUser: boolean }) => {
    // 1. 检查是否存在分隔符 "||"
    if (!text.includes("||")) {
        return <div className={`text-xs font-light leading-relaxed text-justify ${isUser ? 'text-red-100/90' : 'text-zinc-300'}`}>{text}</div>;
    }

    // 2. 拆分选项
    const options = text.split("||").map(s => s.trim()).filter(Boolean);

    return (
        <div className="flex flex-col gap-2 mt-1">
            {options.map((opt, idx) => {
                // 尝试提取 Option A: 前缀
                const match = opt.match(/^(Option|方案)\s*([A-Z0-9]+)[:\s\uff1a](.*)/i);
                let label = `方案 ${String.fromCharCode(65 + idx)}`;
                let content = opt;
                
                if (match) {
                    label = match[1] === 'Option' ? `OPTION ${match[2]}` : `方案 ${match[2]}`;
                    content = match[3].trim();
                }

                return (
                    <div key={idx} className={`relative p-2 rounded border transition-all ${isUser ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-800/50 border-white/5 hover:bg-zinc-700/50'}`}>
                        <div className="absolute top-0 left-0 px-1.5 py-0.5 bg-black/20 text-[9px] font-mono rounded-br text-zinc-500 uppercase tracking-wider">
                            {label}
                        </div>
                        <div className={`text-xs font-light leading-relaxed mt-4 ${isUser ? 'text-red-100' : 'text-zinc-300'}`}>
                            {content}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// 连戏配置区块组件 (Continuity Section Helper)
// 渲染 角色/服装/场景 的详细配置，并区分来源(用户锁定/导演发挥)
const ContinuitySection = ({ title, items, origin }: { title: string, items: {label: string, value: string}[], origin?: 'user' | 'director' }) => {
    const isUser = origin === 'user'; // 是否为用户锁定
    return (
        <div className={`p-4 rounded-md border mb-4 relative overflow-hidden transition-all hover:bg-zinc-800/40 ${isUser ? 'bg-red-900/10 border-red-500/10' : 'bg-zinc-900/40 border-white/5'}`}>
            {/* 用户锁定的红色指示条 */}
            {isUser && <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50"></div>}
            
            <div className="flex items-center justify-between mb-3">
                 <h3 className="text-[11px] font-bold text-zinc-500 tracking-widest flex items-center gap-2">
                    {title}
                 </h3>
                 {/* 来源标签 */}
                 <span className={`text-[10px] px-2 py-0.5 rounded border font-normal ${isUser ? 'text-red-400 bg-red-900/20 border-red-500/20' : 'text-zinc-500 bg-zinc-800 border-white/10'}`}>
                    {isUser ? '甲方锁死' : '导演裁定'}
                 </span>
            </div>
            <div className="space-y-4">
                {items.map((item, idx) => (
                    <div key={idx}>
                        <div className="text-[10px] text-zinc-600 mb-1.5 font-medium tracking-wide border-l-2 border-zinc-700/50 pl-2">{item.label}</div>
                        {/* 使用 OptionRenderer 替代直接输出文本 */}
                        <OptionRenderer text={item.value} isUser={isUser} />
                    </div>
                ))}
            </div>
        </div>
    )
}

export const ContractCard: React.FC<ContractCardProps> = ({ 
  contract, 
  title, 
  directorInsight,
  productionNotes, 
  shootGuide, 
  shootScope,
  continuity,
  conceptFrames, 
  selectedConceptId,
  visualReferenceImageUrl,
  onSelectConcept,
  onGenerateMore,
  isExtending,
  onPreviewConcept
}) => {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar flex flex-col pr-2">
      {/* 标题区域 (Sticky Header) */}
      <div className="sticky top-0 bg-[#0c0c0e]/95 backdrop-blur-xl z-10 pb-6 border-b border-white/5 mb-8 pt-2">
         <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-zinc-600 tracking-[0.2em]">每日通告单</span>
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
         </div>
         <h2 className="text-2xl md:text-3xl font-serif text-zinc-100 tracking-wide leading-tight">
           {title}
         </h2>
      </div>

      <div className="space-y-8 pb-12 flex-1">
        
        {/* 导演阐述 (Vision) - 极简文艺风格 */}
        {directorInsight && (
          <div className="py-8 px-4 text-center">
            <SparklesIcon className="w-5 h-5 text-amber-600 mx-auto mb-4 opacity-80" />
            <p className="text-xl md:text-2xl font-serif text-amber-500/90 leading-relaxed tracking-wide italic">
              “ {directorInsight} ”
            </p>
            <div className="w-12 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mx-auto mt-6"></div>
          </div>
        )}
        
        {/* 技术执行笔记 (Production Notes) */}
        {productionNotes && (
            <div className="grid grid-cols-1 gap-3">
                 <div className="bg-zinc-900/30 border border-white/5 p-3 rounded flex items-start gap-3">
                     <div className="p-1.5 bg-amber-500/10 rounded text-amber-500 shrink-0"><TerminalIcon className="w-3 h-3" /></div>
                     <div>
                         <div className="text-[10px] text-zinc-500 tracking-widest mb-1">布光策略</div>
                         <div className="text-xs text-zinc-300 font-light text-justify">{productionNotes.lighting}</div>
                     </div>
                 </div>
                 <div className="bg-zinc-900/30 border border-white/5 p-3 rounded flex items-start gap-3">
                     <div className="p-1.5 bg-blue-500/10 rounded text-blue-500 shrink-0"><FilmIcon className="w-3 h-3" /></div>
                     <div>
                         <div className="text-[10px] text-zinc-500 tracking-widest mb-1">影调色彩</div>
                         <div className="text-xs text-zinc-300 font-light text-justify">{productionNotes.palette}</div>
                     </div>
                 </div>
                 <div className="bg-zinc-900/30 border border-white/5 p-3 rounded flex items-start gap-3">
                     <div className="p-1.5 bg-purple-500/10 rounded text-purple-500 shrink-0"><ZoomInIcon className="w-3 h-3" /></div>
                     <div>
                         <div className="text-[10px] text-zinc-500 tracking-widest mb-1">镜头构图</div>
                         <div className="text-xs text-zinc-300 font-light text-justify">{productionNotes.composition}</div>
                     </div>
                 </div>
            </div>
        )}

        {/* 制作范围/约束分析 */}
        {shootScope && (
           <div className="mb-6 mt-4">
               <h3 className="text-[11px] font-bold text-zinc-600 tracking-widest mb-3 border-b border-white/5 pb-2">
                 制片要素拆解
               </h3>
               <div className="flex gap-2 flex-wrap">
                  {shootScope.nonNegotiables?.map((item, i) => (
                      <span key={i} className="px-2 py-1 bg-red-900/10 border border-red-500/20 text-[10px] text-red-300 rounded">
                          🔒 {item}
                      </span>
                  ))}
                  {shootScope.flexibleElements?.map((item, i) => (
                      <span key={i} className="px-2 py-1 bg-green-900/10 border border-green-500/20 text-[10px] text-green-300 rounded">
                          ✨ {item}
                      </span>
                  ))}
               </div>
           </div>
        )}

        {/* 连戏配置表 (Continuity Sheets) */}
        {continuity ? (
            <div>
                <h3 className="text-[11px] font-bold text-zinc-600 tracking-widest mb-4 border-b border-white/5 pb-2">
                  连戏一致性管理
                </h3>
                
                {/* 选角 (新增 身材设定) */}
                <ContinuitySection 
                    title="选角设定" 
                    origin={continuity.character.origin}
                    items={[
                        { label: "身份设定", value: continuity.character.description },
                        { label: "身材设定", value: continuity.character.body || "标准" },
                        { label: "面部特征", value: continuity.character.details?.join(", ") || "无特殊" }
                    ]} 
                />

                {/* 造型 */}
                <ContinuitySection 
                    title="造型设定" 
                    origin={continuity.wardrobe.origin}
                    items={[
                        { label: "造型方案", value: continuity.wardrobe.description },
                        { label: "材质面料", value: continuity.wardrobe.material },
                        { label: "单品清单", value: continuity.wardrobe.accessories?.join(", ") || "简约配置" }
                    ]} 
                />

                {/* 置景 */}
                <ContinuitySection 
                    title="置景设定" 
                    origin={continuity.set.origin}
                    items={[
                        { label: "场景环境", value: continuity.set.environment },
                        { label: "氛围基调", value: continuity.set.atmosphere }
                    ]} 
                />
            </div>
        ) : (
            <div className="opacity-50 text-xs text-zinc-500">
                正在生成连戏配置...
            </div>
        )}

        {/* 表演指导 */}
        {shootGuide && (
            <div>
              <h3 className="text-[11px] font-bold text-zinc-600 tracking-widest mb-4 border-b border-white/5 pb-2">
                表演指导
              </h3>
              <div className="space-y-4">
                 <div>
                    <div className="text-[10px] text-zinc-500 mb-2 tracking-widest">关键体态</div>
                    <div className="flex flex-wrap gap-2">
                        {shootGuide.keyPoses?.map((pose, i) => (
                            <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-zinc-300 font-light">
                                {pose}
                            </span>
                        ))}
                    </div>
                 </div>
              </div>
            </div>
        )}

      </div>

      {/* 视觉基因库 / 概念预览网格 */}
      {(conceptFrames && conceptFrames.length > 0) ? (
          <div className="mt-8 mb-6 animate-in fade-in duration-1000">
             <div className="flex items-center gap-4 mb-4">
                <h3 className="text-[11px] font-bold text-zinc-500 tracking-widest whitespace-nowrap">
                  视觉基因库
                </h3>
                <div className="h-px flex-1 bg-white/10"></div>
             </div>
             
             {/* 预览图网格 */}
             <div className="grid grid-cols-3 gap-2">
                {conceptFrames.map((frame, idx) => {
                    const isSelected = frame.id === selectedConceptId;
                    const variantType = frame.metadata?.variantType || (idx < 8 ? 'strict' : idx < 16 ? 'balanced' : 'creative');
                    
                    // 根据变体类型着色边框
                    let borderColor = 'border-white/10';
                    if (variantType === 'strict') borderColor = 'border-blue-900/30'; 
                    if (variantType === 'balanced') borderColor = 'border-zinc-500/30'; 
                    if (variantType === 'creative') borderColor = 'border-purple-900/30'; 

                    return (
                        <div 
                           key={frame.id} 
                           className={`relative aspect-[3/4] bg-zinc-900 rounded overflow-hidden border transition-all duration-300 group cursor-pointer ${isSelected ? 'border-amber-500 ring-1 ring-amber-500/50 shadow-lg shadow-amber-900/20 opacity-100' : `${borderColor} opacity-60 hover:opacity-100`}`}
                           onClick={() => onSelectConcept && onSelectConcept(frame.id)}
                        >
                            {/* 图片渲染 */}
                            {frame.status === 'completed' && frame.imageUrl ? (
                                <>
                                    <img 
                                        src={frame.imageUrl} 
                                        className="w-full h-full object-cover" 
                                    />
                                    <button 
                                        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/80 text-white/70 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (onPreviewConcept) onPreviewConcept(frame.imageUrl!);
                                        }}
                                    >
                                        <ZoomInIcon className="w-3 h-3" />
                                    </button>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-[7px] text-zinc-700">...</span>
                                </div>
                            )}
                            
                            {/* 编号标签 */}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1 py-0.5 flex justify-between items-center pointer-events-none">
                                <span className={`text-[7px] font-mono uppercase ${isSelected ? 'text-amber-400 font-bold' : 'text-zinc-500'}`}>
                                    {String.fromCharCode(65 + idx)}
                                </span>
                            </div>
                        </div>
                    )
                })}
             </div>
             
             {/* 续拍按钮 */}
             {selectedConceptId !== undefined && onGenerateMore && (
                 <button 
                    onClick={onGenerateMore}
                    disabled={isExtending}
                    className="w-full mt-4 py-3 border border-dashed border-zinc-700 hover:border-amber-500 hover:bg-zinc-800/50 text-xs text-zinc-400 hover:text-amber-500 tracking-widest transition-all rounded flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                 >
                    {isExtending ? (
                         <>
                           <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                           <span>剧情扩充中...</span>
                         </>
                    ) : (
                         <>
                           <FilmIcon className="w-4 h-4 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                           <span className="text-[10px]">
                               使用 [方案 {String.fromCharCode(65 + Math.abs(selectedConceptId + 1))}] 续拍
                           </span>
                         </>
                    )}
                 </button>
             )}
          </div>
      ) : visualReferenceImageUrl ? (
          <div className="mt-8 mb-6 animate-in fade-in duration-1000">
             <div className="relative rounded-lg overflow-hidden border border-white/10 group cursor-zoom-in shadow-lg">
                <img 
                  src={visualReferenceImageUrl} 
                  alt="Visual Reference" 
                  className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500 hover:scale-105 transform"
                />
             </div>
          </div>
      ) : (
        <div className="mt-auto py-12 border-t border-dashed border-white/10 text-center">
          <p className="text-[10px] text-zinc-700 tracking-widest">
            等待视觉定调...
          </p>
        </div>
      )}
    </div>
  );
};
