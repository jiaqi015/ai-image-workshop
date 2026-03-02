
import { AssetAxis } from "../../../types";

// ==========================================
// 内存管理器 (Memory Manager)
// 职责: 管理二进制图像数据的生命周期，将 Base64 转换为轻量级 Blob URL
// 核心价值: 极大降低 React State 的内存占用，消除渲染卡顿
// V2: Style Trace Persistence
// ==========================================

export interface StyleTrace {
    kind: "style_trace";
    ts: number;
    stance: {
        intent: string;
        targetAxes: Partial<Record<AssetAxis, number>>;
        forbidden: string[];
        tone: "cold" | "neutral" | "clinical";
    };
    usedAssetIds: string[];
    scores: {
        tensionScore?: any;
        boundaryScore?: any;
    };
}

export const MemoryManager = {
    
    // 注册表：跟踪所有创建的 URL 以便后续清理
    _registry: new Set<string>(),
    _traces: [] as StyleTrace[], // In-memory cache for traces

    // 1. Base64 -> Blob -> ObjectURL
    // 这是高性能渲染的关键。React State 只存 URL 字符串，不存 MB 级的数据。
    allocate: (base64Data: string, mimeType: string = 'image/png'): string => {
        try {
            // 处理可能带前缀的 base64 (data:image/png;base64,...)
            const cleanBase64 = base64Data.split(',')[1] || base64Data;
            
            const byteCharacters = atob(cleanBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });
            
            const url = URL.createObjectURL(blob);
            MemoryManager._registry.add(url);
            return url;
        } catch (e) {
            console.error("Memory Allocation Failed:", e);
            // 降级策略：如果转换失败，直接返回原 Base64（虽然慢但能用）
            return base64Data.startsWith('data:') ? base64Data : `data:${mimeType};base64,${base64Data}`;
        }
    },

    // 2. 释放内存
    // 必须在组件卸载或清空画廊时调用
    release: (url: string) => {
        if (!url || !url.startsWith('blob:')) return;
        URL.revokeObjectURL(url);
        MemoryManager._registry.delete(url);
    },

    // 3. 批量释放
    releaseAll: () => {
        MemoryManager._registry.forEach(url => URL.revokeObjectURL(url));
        MemoryManager._registry.clear();
        console.debug("MemoryManager: All blobs released.");
    },

    // 4. Blob URL -> Base64 (用于持久化存储到 IndexedDB)
    // IndexedDB 虽然支持 Blob，但为了兼容旧数据结构和导出逻辑，这里提供转换
    hydrateToBase64: async (blobUrl: string): Promise<string> => {
        if (!blobUrl.startsWith('blob:')) return blobUrl; // 已经是 base64 或 http url

        try {
            const response = await fetch(blobUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Hydration failed:", e);
            return blobUrl;
        }
    },
    
    // 5. 保存样式轨迹 (Memory Expansion)
    saveStyleTrace: (trace: StyleTrace) => {
        MemoryManager._traces.push(trace);
        // Persist to localStorage for lightweight retention (limit to last 50)
        if (MemoryManager._traces.length > 50) MemoryManager._traces.shift();
        try {
            localStorage.setItem("style_traces", JSON.stringify(MemoryManager._traces));
        } catch (e) { console.warn("Trace save failed", e); }
    },

    // 6. 检索相似轨迹
    findSimilarTraces: (targetAxes: Partial<Record<AssetAxis, number>>, limit: number = 3): StyleTrace[] => {
        // Load from storage if empty
        if (MemoryManager._traces.length === 0) {
            try {
                const stored = localStorage.getItem("style_traces");
                if (stored) MemoryManager._traces = JSON.parse(stored);
            } catch(e) {}
        }

        return MemoryManager._traces
            .map(trace => ({
                trace,
                sim: calculateSimilarity(trace.stance.targetAxes, targetAxes)
            }))
            .sort((a, b) => b.sim - a.sim)
            .filter(item => item.sim > 0.7) // Threshold
            .slice(0, limit)
            .map(item => item.trace);
    }
};

function calculateSimilarity(
  a: Partial<Record<AssetAxis, number>> | undefined, 
  b: Partial<Record<AssetAxis, number>> | undefined
): number {
    if (!a || !b) return 0;
    let sum = 0, count = 0;
    for (const key of Object.keys(b) as AssetAxis[]) {
        if (typeof a[key] === 'number' && typeof b[key] === 'number') {
            sum += 1 - Math.abs(a[key]! - b[key]!);
            count++;
        }
    }
    return count > 0 ? sum / count : 0;
}
