
import { ShootStrategy } from "../../types";

// ==========================================
// 执行策略中心 (Execution Policy Center)
// 职责: 将用户的宏观策略 (Strategy) 映射为底层的微观执行参数 (Model, Concurrency, RateLimit)
// 解决了 "选什么模式用什么模型" 以及 "并发多少才不会崩" 的核心调度问题
// ==========================================

export interface ExecutionProfile {
    // 调度配置
    concurrency: number;        // 最大并发请求数
    staggerDelay: number;       // 错峰启动延迟 (ms)，防止瞬间 QPS 爆炸
    timeout: number;            // 单次请求超时时间 (ms)
    
    // 标识
    label: string;              // UI展示用的策略标签
}

export class ExecutionPolicy {
    
    /**
     * 核心调度算法：根据用户输入计算执行配置
     */
    static resolve(
        strategy: ShootStrategy, 
        isProxy: boolean
    ): ExecutionProfile {
        
        // 只负责调度，不负责模型选择
        let concurrency = 3;
        let staggerDelay = 500;
        let timeout = 20000;
        let label = '标准队列';

        if (isProxy) {
            // --- Proxy Mode Strategies ---
            // 代理模式下通常并发限制较宽松，但模型调用贵
            switch (strategy) {
                case 'pro':
                    concurrency = 2; // 稳健
                    label = '代理-高画质队列';
                    break;
                case 'flash':
                    concurrency = 4; // 激进
                    label = '代理-极速队列';
                    break;
                case 'hybrid':
                    concurrency = 3;
                    label = '代理-混合队列';
                    break;
            }
        } else {
            // --- Direct Google Cloud Strategies ---
            // [CRITICAL UPDATE]: Drastically reduced concurrency to fix 429 Limit: 0 errors
            
            switch (strategy) {
                case 'pro':
                    concurrency = 1; // Strict serial execution for Pro to avoid limits
                    staggerDelay = 2000; // Increased delay
                    timeout = 60000; 
                    label = '电影级 (Pro) 队列';
                    break;
                    
                case 'flash':
                    concurrency = 2; // Reduced from 4 to 2
                    staggerDelay = 1000; // Increased from 300 to 1000
                    label = '极速 (Flash) 队列';
                    break;
                    
                case 'hybrid':
                    concurrency = 2;
                    staggerDelay = 1200;
                    label = '混合流智能路由';
                    break;
            }
        }

        return {
            concurrency,
            staggerDelay,
            timeout,
            label
        };
    }

    /**
     * 混合模式下的单帧路由逻辑
     */
    static routeHybridFrame(description: string, frameIndex: number, totalFrames: number): 'pro' | 'flash' {
        const desc = description.toLowerCase();
        
        // 规则 1: 首尾帧 (Anchor Frames) 使用高质量
        if (frameIndex === 0 || frameIndex === totalFrames - 1) return 'pro';
        
        // 规则 2: 需要皮肤质感/微距特写的，使用 Pro
        if (desc.includes('close-up') || desc.includes('portrait') || desc.includes('texture') || desc.includes('detail')) {
            return 'pro';
        }
        
        // 规则 3: 远景/轮廓/剪影，使用 Flash (足够好了)
        if (desc.includes('wide shot') || desc.includes('silhouette') || desc.includes('long shot') || desc.includes('blur')) {
            return 'flash';
        }

        // 默认 Flash 以节省资源
        return 'flash';
    }
}
