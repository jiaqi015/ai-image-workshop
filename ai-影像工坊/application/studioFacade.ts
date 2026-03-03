// ==========================================
// Public Service Facade (The Stable Surface)
// ==========================================

import { GatewayClient } from "../services/api/client";
import type { RandomPromptRequest } from "../services/api/client";
import { dbService } from "../services/capabilities/infra/db";
import { voiceService } from "../services/capabilities/infra/voiceService";
import { LocalizationService } from "../services/capabilities/infra/localizationService";
import { MemoryManager } from "../services/capabilities/memory/memoryManager";
import { FrameMetadata, ShootPlan } from "../types";

// --- Engines ---
import { InspirationEngine } from "../services/capabilities/engines/inspirationEngine";
import { InspirationProEngine } from "../services/capabilities/engines/inspirationProEngine";
import { ScriptAnalyzer } from "../services/capabilities/engines/scriptAnalyzer";
import { AssetRecaller } from "../services/capabilities/engines/assetRecaller";
import { PromptRenderer } from "../services/capabilities/engines/promptRenderer";
import { PromptEngine } from "../services/capabilities/engines/promptEngine";

// --- Domain Services ---
import { DirectorEngine } from "../services/features/director";
import { CameraEngine } from "../services/features/camera";

// --- Exports ---
export { GatewayClient, dbService, voiceService, LocalizationService, MemoryManager };
export { InspirationEngine, InspirationProEngine, ScriptAnalyzer, AssetRecaller, PromptEngine };
export { SafetySentinel } from "../services/capabilities/guardrails/safetySentinel";
export { JSONHealer } from "../services/capabilities/guardrails/jsonHealer";
export { ExecutionPolicy } from "../services/policies/executionPolicy";
export {
    DEFAULT_MASTER_SESSION_PROFILE,
    applyMasterProfileToPlan,
    buildMasterShotList,
    curateFrames,
    summarizeCuration
} from "../services/policies/masterSessionPolicy";

// --- API Surface Implementation ---

// 1. Plan Shoot
export const generateShootPlan = async (...args: Parameters<typeof DirectorEngine.planShoot>) => {
    return DirectorEngine.planShoot(...args);
};

// 2. Render Shot
export const generateFrameImage = async (plan: ShootPlan, description: string, modelType: 'pro' | 'flash', metadata: FrameMetadata, signal?: AbortSignal) => {
    return CameraEngine.shootFrame(plan, description, modelType, metadata, signal);
};

// 3. Expand Universes
export const expandParallelUniverses = async (plan: ShootPlan, count: number = 6, model?: string) => {
    return DirectorEngine.proposeNewVariants(plan, count, model);
};

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
export const setCustomApiKey = GatewayClient.setApiKey;
export const getCustomApiKey = GatewayClient.getApiKey;
export const getConnectionStatus = GatewayClient.getStatus;
export const validateApiKey = GatewayClient.validate;
export const setModelPreferences = GatewayClient.setModelPreferences;
export const getModelPreferences = GatewayClient.getModelPreferences;
export const getAvailableModels = GatewayClient.getAvailableModels;
export const refreshAvailableModels = GatewayClient.refreshModels;

export const constructFullPrompt = (plan: any, desc: string, meta: any) => 
    PromptRenderer.renderFallback(plan, desc, meta.variant || "Cinematic", meta.castingTraits || "");

export const cleanVariantText = (text: any): string => String(text).replace(/^(Option|Variant|方案)[:\.\-]\s*/i, "").trim();

export const generateMicroCasting = PromptEngine.generateMicroCasting;
type RandomPromptPreset = Pick<RandomPromptRequest, "tensionLevel" | "castPreference">;

const resolveRandomPromptPreset = (preset: RandomPromptPreset = {}) => ({
    tensionLevel: preset?.tensionLevel || "medium",
    castPreference: preset?.castPreference || "asian_girl_23_plus",
});

export const generateRandomPrompt = async (preset: RandomPromptPreset = {}): Promise<string> => {
    const resolved = resolveRandomPromptPreset(preset);
    try {
        const data = await GatewayClient.generateRandomPrompt({
            mode: "fast",
            tensionLevel: resolved.tensionLevel,
            castPreference: resolved.castPreference,
            targetLength: 200,
        });
        return data.prompt;
    } catch {
        return InspirationEngine.generateHighTensionPrompt();
    }
};

export const generateProRandomPrompt = async (preset: RandomPromptPreset = {}): Promise<string> => {
    const resolved = resolveRandomPromptPreset(preset);
    try {
        const data = await GatewayClient.generateRandomPrompt({
            mode: "pro",
            tensionLevel: resolved.tensionLevel,
            castPreference: resolved.castPreference,
            targetLength: 200,
            contactSheetCount: 6,
        });
        return data.prompt;
    } catch {
        return InspirationProEngine.generateMasterpiece();
    }
};

export const generateProRandomPromptPack = async (preset: RandomPromptPreset = {}) => {
    const resolved = resolveRandomPromptPreset(preset);
    return GatewayClient.generateRandomPrompt({
        mode: "pro",
        tensionLevel: resolved.tensionLevel,
        castPreference: resolved.castPreference,
        targetLength: 200,
        contactSheetCount: 6,
        sequenceLength: 3,
        sequenceIndex: 0,
    });
};

export const submitRandomPromptPairwiseFeedback = GatewayClient.submitRandomPromptPairwiseFeedback;

export const regenerateSingleVariant = async (plan: any, model?: string) => {
    return (await DirectorEngine.proposeNewVariants(plan, 1, model))[0];
};
