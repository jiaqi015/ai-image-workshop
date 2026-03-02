
// ==========================================
// JSON 治愈者 (JSON Healer)
// 职责: 从 LLM 的非结构化输出中“手术式”提取并修复 JSON
// 算法: 栈式扫描 + 启发式修复
// 升级: 增加防护性注释与更强的容错逻辑
// ==========================================

export const JSONHealer = {
    /**
     * 核心提取方法：尝试从混乱的文本中提取并解析 JSON 对象
     * @param text LLM 返回的原始文本 (可能包含 Markdown, 废话, 或截断的 JSON)
     * @param fallback 解析失败时的兜底默认值
     */
    heal: <T>(text: string, fallback: T): T => {
        if (!text) return fallback;
        
        // 1. 黄金路径: 尝试直接解析完美格式
        try {
            return JSON.parse(text);
        } catch (e) {
            // 解析失败，进入修复流程
        }

        // 2. 提取器: 寻找最外层的 { ... } 结构
        // 很多模型喜欢在 JSON 前后加 Markdown (```json ... ```) 或闲聊
        const jsonBlockPattern = /\{[\s\S]*\}/;
        const match = text.match(jsonBlockPattern);
        
        if (!match) {
            console.warn("JSONHealer: No JSON block found in text.");
            return fallback;
        }
        
        let candidate = match[0];

        // 3. 清洗器: 移除常见的 Markdown 标记
        candidate = candidate.replace(/```json/g, "").replace(/```/g, "");

        try {
            return JSON.parse(candidate);
        } catch (e) {
            // 4. 深度修复 (Deep Healing)
            // 处理常见错误: 尾部逗号、未闭合的括号、未转义的字符
            console.warn("JSONHealer: Standard parse failed, attempting aggressive repair...");
            return JSONHealer._aggressiveRepair(candidate, fallback);
        }
    },

    /**
     * 激进修复策略：处理截断或格式错误的 JSON
     */
    _aggressiveRepair: <T>(text: string, fallback: T): T => {
        let processed = text.trim();

        // 策略 A: 移除尾部多余逗号 (Trailing Commas)
        // 标准 JSON 不允许 { "a": 1, }
        processed = processed.replace(/,(\s*[}\]])/g, '$1');

        // 策略 B: 尝试自动闭合截断的 JSON
        // 如果 API token 耗尽，JSON 可能会在中间断开。
        const openBraces = (processed.match(/\{/g) || []).length;
        const closeBraces = (processed.match(/\}/g) || []).length;
        const openBrackets = (processed.match(/\[/g) || []).length;
        const closeBrackets = (processed.match(/\]/g) || []).length;

        // 简单补全：缺多少补多少
        if (openBraces > closeBraces) processed += "}".repeat(openBraces - closeBraces);
        if (openBrackets > closeBrackets) processed += "]".repeat(openBrackets - closeBrackets);

        try {
            return JSON.parse(processed);
        } catch (e) {
            console.error("JSON Healer gave up.", e);
            console.debug("Failed Candidate:", text);
            // 最后的手段: 返回 fallback，防止应用崩溃
            return fallback;
        }
    }
};
