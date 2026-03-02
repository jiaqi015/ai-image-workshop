
import { STYLE_KERNELS } from "../../assets/styleKernels";
import { IntentCategory } from "./intentClassifier";

export const StyleKernelSelector = {
    select: (intent: IntentCategory, keywords: string[]) => {
        const text = keywords.join(" ").toLowerCase();
        
        if (intent === "ADULT") {
            // 成人意图强制转为“侵入式凝视”或“材质压迫”，而非肉体
            return Math.random() > 0.5 ? STYLE_KERNELS.invasive_gaze_core : STYLE_KERNELS.material_oppression;
        }

        if (text.includes("cold") || text.includes("real") || intent === "DOCUMENTARY") {
            return STYLE_KERNELS.body_reality_documentary;
        }

        if (text.includes("texture") || text.includes("fabric") || intent === "FASHION") {
            return STYLE_KERNELS.material_oppression;
        }

        // Default
        return STYLE_KERNELS.invasive_gaze_core;
    }
};
