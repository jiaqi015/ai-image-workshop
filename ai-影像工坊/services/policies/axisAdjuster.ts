
import { AssetAxis } from "../../types";

export const AxisAdjuster = {
    /**
     * 根据上一轮的分析分数，微调下一轮的轴线目标
     */
    suggestAdjustments: (
        currentAxes: Partial<Record<AssetAxis, number>>,
        tensionScore: any,
        boundaryScore: any
    ): Partial<Record<AssetAxis, number>> => {
        const nextAxes = { ...currentAxes };

        // 1. 如果张力不足 (Tension < 0.5)
        // 策略: 增加凝视压迫和机位侵入，制造不适感
        const avgTension = Object.values(tensionScore || {}).reduce((a: any, b: any) => a + b, 0) as number / 6;
        if (avgTension < 0.5) {
            nextAxes.gaze_pressure = Math.min((nextAxes.gaze_pressure || 0.5) + 0.2, 1.0);
            nextAxes.camera_intrusion = Math.min((nextAxes.camera_intrusion || 0.5) + 0.15, 1.0);
            nextAxes.composition_instability = Math.min((nextAxes.composition_instability || 0.4) + 0.2, 1.0);
        }

        // 2. 如果色情风险过高 (Erotic Risk > 0.6)
        // 策略: 增加“纪录片冷感”和“硬光”，去除暧昧氛围，转向临床观察风格
        if (boundaryScore?.eroticRisk > 0.6) {
            nextAxes.documentary_coldness = Math.min((nextAxes.documentary_coldness || 0.5) + 0.3, 1.0);
            nextAxes.lighting_hardness = Math.min((nextAxes.lighting_hardness || 0.5) + 0.2, 1.0);
            // 降低材质存在感（往往关联皮肤/织物）
            nextAxes.material_presence = Math.max((nextAxes.material_presence || 0.7) - 0.2, 0.3);
        }

        return nextAxes;
    }
};
