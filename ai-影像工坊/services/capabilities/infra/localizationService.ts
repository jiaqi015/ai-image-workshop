
import { GatewayClient } from "../../api/client";

// ==========================================
// 汉化与扩写保障服务 (Localization & Expansion Service)
// 职责: 确保所有输出为中文，且内容丰满（填满UI的三行）。
// 升级: 引入并发控制，防止 API 速率限制 (429)
// ==========================================

// 简单的异步并发控制器
const pLimit = (concurrency: number) => {
    const queue: (() => Promise<any>)[] = [];
    let activeCount = 0;

    const next = () => {
        activeCount--;
        if (queue.length > 0) {
            const task = queue.shift();
            task!();
        }
    };

    const run = <T>(fn: () => Promise<T>): Promise<T> => {
        return new Promise((resolve, reject) => {
            const task = async () => {
                activeCount++;
                try {
                    const result = await fn();
                    resolve(result);
                } catch (err) {
                    reject(err);
                } finally {
                    next();
                }
            };

            if (activeCount < concurrency) {
                task();
            } else {
                queue.push(task);
            }
        });
    };

    return run;
};

export const LocalizationService = {
    
    // 核心方法：将简短描述扩写为“中文电影文学脚本”
    enrichToChinese: async (text: string, context: string = "Cinematic Shot", model?: string): Promise<string> => {
        // 资源节约检查
        if ((text.match(/[\u4e00-\u9fa5]/g)?.length || 0) > 30) return text;

        const prompt = `
        Role: Senior Film Scriptwriter.
        Task: Rewrite the input into Rich Chinese Cinematic Prose (中文电影文学脚本).
        Context: ${context}
        
        Requirements:
        1. Output ONLY the rewritten text in Simplified Chinese.
        2. Expand details to approx 50-80 characters.
        3. Focus on: Visuals, Atmosphere, Lighting, Texture.
        4. Style: Poetic, Professional, Evocative (Wong Kar-wai style).
        
        Input: "${text}"
        `;

        try {
            const targetModel = model || GatewayClient.getModelPreferences().textModel;
            const result = await GatewayClient.routeRequest(targetModel, [{ role: "user", content: prompt }]);
            return result ? result.trim() : text;
        } catch (e) {
            console.warn("Localization failed, returning original:", e);
            return text;
        }
    },

    // 批量处理计划中的列表 - 升级：并发限流
    processPlanFrames: async (items: string[], context: string = "Movie Frame", model?: string): Promise<string[]> => {
        if (!items || items.length === 0) return [];
        
        // 限制并发数为 3，平滑 API 调用曲线
        const limit = pLimit(3);
        
        const promises = items.map(item => 
            limit(() => LocalizationService.enrichToChinese(item, context, model))
        );
        
        return Promise.all(promises);
    }
};
