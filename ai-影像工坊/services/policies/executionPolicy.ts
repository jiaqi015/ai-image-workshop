
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
        strategy: ShootStrategy
    ): ExecutionProfile {
        // 单通道后端网关调度
        let concurrency = 2;
        let staggerDelay = 500;
        let timeout = 20000;
        let label = '网关标准队列';

        switch (strategy) {
            case 'pro':
                concurrency = 1;
                staggerDelay = 1800;
                timeout = 60000;
                label = '电影级 (Pro) 队列';
                break;
            case 'flash':
                concurrency = 2;
                staggerDelay = 900;
                label = '极速 (Flash) 队列';
                break;
            case 'hybrid':
                concurrency = 2;
                staggerDelay = 1200;
                label = '混合流智能路由';
                break;
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
