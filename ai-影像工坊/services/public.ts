// ==========================================
// Public Service Facade (The Stable Surface)
// ==========================================

import { Infrastructure } from "./api/client";
import { dbService } from "./capabilities/infra/db";
import { voiceService } from "./capabilities/infra/voiceService";
import { LocalizationService } from "./capabilities/infra/localizationService";
import { MemoryManager } from "./capabilities/memory/memoryManager";
import { FrameMetadata, ShootPlan } from "../types";

// --- Engines ---
import { InspirationEngine } from "./capabilities/engines/inspirationEngine";
import { InspirationProEngine } from "./capabilities/engines/inspirationProEngine";
import { ScriptAnalyzer } from "./capabilities/engines/scriptAnalyzer";
import { AssetRecaller } from "./capabilities/engines/assetRecaller";
import { PromptRenderer } from "./capabilities/engines/promptRenderer";
import { PromptEngine } from "./capabilities/engines/promptEngine";

// --- Domain Services ---
import { DirectorEngine } from "./features/director";

// --- Exports ---
export { Infrastructure, dbService, voiceService, LocalizationService, MemoryManager };
export { InspirationEngine, InspirationProEngine, ScriptAnalyzer, AssetRecaller, PromptEngine };
export { SafetySentinel } from "./capabilities/guardrails/safetySentinel";
export { JSONHealer } from "./capabilities/guardrails/jsonHealer";
export { ExecutionPolicy } from "./policies/executionPolicy";

// --- API Surface Implementation ---

// 1. Plan Shoot
export const generateShootPlan = async (...args: Parameters<typeof DirectorEngine.planShoot>) => {
    return DirectorEngine.planShoot(...args);
};

// 2. Render Shot
export const generateFrameImage = async (plan: ShootPlan, description: string, modelType: 'pro' | 'flash', metadata: FrameMetadata, signal?: AbortSignal) => {
    // 1. Construct Prompt using the Renderer
    const prompt = PromptRenderer.renderFallback(
        plan, 
        description, 
        metadata.variant || "Cinematic", 
        metadata.castingTraits || ""
    );

    // 2. Execute via Infrastructure with Retry
    return Infrastructure.runWithRetry(
        () => Infrastructure.generateImage(prompt, modelType, signal),
        signal
    );
};

// 3. Expand Universes
export const expandParallelUniverses = DirectorEngine.proposeNewVariants;

// 4. Generate More Frames (Robust Pipeline)
export const generateMoreFrames = async (
    plan: any, 
    count: number, 
    model: any, 
    onLog?: (msg: string) => void, 
    referenceStyle?: string, 
    onChunkReady?: (scripts: string[], chunkIndex: number) => void
) => {
    return DirectorEngine.extendScript(
        plan, 
        count,
        model,
        referenceStyle || "Cinematic",
        onLog,
        onChunkReady
    );
};

// 5. Utilities
export const setCustomApiKey = Infrastructure.setApiKey;
export const getCustomApiKey = Infrastructure.getApiKey;
export const toggleProxyMode = Infrastructure.toggleProxy;
export const setProxyMode = Infrastructure.setProxyMode;
export const getConnectionStatus = Infrastructure.getStatus;
export const validateApiKey = Infrastructure.validate;
export const setModelPreferences = Infrastructure.setModelPreferences;
export const getModelPreferences = Infrastructure.getModelPreferences;
export const getAvailableModels = Infrastructure.getAvailableModels;
export const refreshAvailableModels = Infrastructure.refreshModels;

export const constructFullPrompt = (plan: any, desc: string, meta: any) => 
    PromptRenderer.renderFallback(plan, desc, meta.variant || "Cinematic", meta.castingTraits || "");

export const cleanVariantText = (text: any): string => String(text).replace(/^(Option|Variant|方案)[:\.\-]\s*/i, "").trim();

export const generateMicroCasting = PromptEngine.generateMicroCasting;
export const generateRandomPrompt = () => InspirationEngine.generateHighTensionPrompt();
export const generateProRandomPrompt = () => InspirationProEngine.generateMasterpiece();

export const regenerateSingleVariant = async (plan: any, current: string) => {
    return (await DirectorEngine.proposeNewVariants(plan, 1))[0];
};
