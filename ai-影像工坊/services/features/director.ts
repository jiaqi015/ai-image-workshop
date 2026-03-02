
import { ShootPlan, DirectorModel, TensionLevel, RuntimeBlueprint, OptionBlueprint, HardLock } from "../../types";
import { Infrastructure } from "../api/client";
import { ScriptAnalyzer, ScriptAnalysis } from "../capabilities/engines/scriptAnalyzer";
import { AssetRecaller } from "../capabilities/engines/assetRecaller"; 
import { LocalizationService } from "../capabilities/infra/localizationService";
import { JSONHealer } from "../capabilities/guardrails/jsonHealer"; 

// ==========================================
// 领域：导演统筹 (Director Domain)
// 职责: 平行宇宙总架构师。
// 升级: 引入 Blueprint Adjudicator (裁定器) + 流水线引擎
// ==========================================

const FALLBACK_PLAN: ShootPlan = {
    title: "未命名项目 (应急模式)",
    directorInsight: "备用方案启用。手动调整细节。",
    productionNotes: { lighting: "自然光", palette: "中性", composition: "中心构图" },
    shootScope: { nonNegotiables: [], flexibleElements: [], complexityLevel: "low" },
    continuity: {
        character: { description: "通用主体", body: "标准身材", details: [], origin: "director" },
        wardrobe: { description: "简约造型", material: "棉麻", accessories: [], origin: "director" },
        set: { environment: "极简背景", timeOfDay: "日间", atmosphere: "平静", origin: "director" }
    },
    shootGuide: { keyPoses: ["站立"], emotionalSpectrum: ["平静"] },
    contract: { subjectIdentity: "主体", wardrobe: "基础款", location: "影棚", lighting: "柔光", cameraLanguage: "平视", texture: "数码" },
    frames: ["特写镜头", "中景镜头", "全景镜头"],
    visualVariants: ["经典方案 - 选角: 默认"]
};

// ------------------------------------------------------------------
// 1. Adjudication Layer (The Blueprint Builder)
// ------------------------------------------------------------------
const Adjudicator = {
    cleanOption: (text: string) => {
        return text.replace(/^(Option|Variant|方案)[:\.\-]\s*[A-Z0-9]*[:\uff1a]?\s*/i, "").trim();
    },

    buildBlueprint: (plan: ShootPlan, analysis: ScriptAnalysis): string => {
        // 1. Convert Hard Locks
        const hardLocks: HardLock[] = [];
        if (analysis.hardLocks.specificProduct) {
            hardLocks.push({ kind: "product", where: "GLOBAL", strength: "MUST", productId: analysis.hardLocks.specificProduct });
        }
        if (analysis.hardLocks.gender !== 'NEUTRAL') {
             hardLocks.push({ kind: "text", where: "GLOBAL", strength: "SHOULD", text: `Gender: ${analysis.hardLocks.gender}` });
        }
        analysis.hardLocks.explicitTraits.forEach(t => {
            hardLocks.push({ kind: "text", where: "GLOBAL", strength: "SHOULD", text: t });
        });

        // 2. Split Options
        const charOpts = (plan.continuity?.character?.description || "").split("||").map(s => Adjudicator.cleanOption(s)).filter(Boolean);
        const bodyOpts = (plan.continuity?.character?.body || "").split("||").map(s => Adjudicator.cleanOption(s)).filter(Boolean);
        const wardrobeOpts = (plan.continuity?.wardrobe?.description || "").split("||").map(s => Adjudicator.cleanOption(s)).filter(Boolean);

        // 3. Build Option Blueprints
        const buildOption = (id: "A" | "B", index: number): OptionBlueprint => ({
            optionId: id,
            anchors: {
                facial: charOpts[index] || charOpts[0] || "Default Subject",
                bodyForm: bodyOpts[index] || bodyOpts[0] || "Default Body",
                wardrobe: wardrobeOpts[index] || wardrobeOpts[0] || "Default Outfit"
            },
            grammar: {
                camera: ["Cinematic Angle", "Depth of Field"], // Placeholder, effectively handled by PromptEngine defaults
                composition: ["Rule of Thirds", "Center Framed"],
                lighting: [plan.productionNotes?.lighting || "Natural"],
                environment: [plan.continuity?.set?.environment || "Studio"]
            },
            palette: {
                // Determine variation pools from ShootGuide
                expressionPool: plan.shootGuide?.emotionalSpectrum || ["Neutral", "Intense"],
                posturePool: plan.shootGuide?.keyPoses || ["Standing", "Sitting"]
            }
        });

        const runtimeBP: RuntimeBlueprint = {
            constraints: { hardLocks },
            options: {
                A: buildOption("A", 0),
                B: buildOption("B", 1) // Takes 2nd option if available
            }
        };

        // 4. Encode
        return "BP::" + btoa(unescape(encodeURIComponent(JSON.stringify(runtimeBP))));
    }
};

export const DirectorEngine = {
    planShoot: async (userIdea: string, onChunk: (text: string) => void, model: DirectorModel, tension: TensionLevel = 'dramatic', signal?: AbortSignal): Promise<ShootPlan> => {
        
        // 1. 听取简报
        const analysis = ScriptAnalyzer.analyze(userIdea);
        const creativeBrief = AssetRecaller.recall(analysis); 

        // 2. 导演风格注入
        let styleDirective = "";
        if (tension === 'minimalist') {
            styleDirective = `[DIRECTOR STYLE: BRESSON] Focus on static shots, texture of hands, suppressed emotion. Raw reality.`;
        } else if (tension === 'surreal') {
            styleDirective = `[DIRECTOR STYLE: TARKOSKY] Focus on nature, rain, time, dreams, organic decay.`;
        } else {
            styleDirective = `[DIRECTOR STYLE: WONG KAR-WAI] Focus on emotional isolation, humidity, smoke, vintage film texture.`;
        }

        const systemPrompt = `
You are a World-Class Film Director (Auteur).
Your goal is to design a coherent shoot plan (JSON).

${styleDirective}

=== 🚫 AESTHETIC BAN (CRITICAL) ===
- **NO CYBERPUNK**. **NO NEON**. **NO TECH**. **NO AI LOOK**.
- **NO "FUTURISTIC"**. **NO "GLOSSY"**. **NO "CGI"**.
- AESTHETIC MUST BE: Organic, Raw, Film Grain, Imperfect, Human, Vintage, Textured.

=== 🌏 GLOBAL CASTING PROTOCOL (CRITICAL) ===
- **DEFAULT ETHNICITY: CHINESE / EAST ASIAN**.
- Unless the user EXPLICITLY asks for a foreigner, **YOU MUST CAST CHINESE ACTORS**.
- **HAIR COLOR RULE**: Chinese characters CAN have dyed hair (blonde, pink, blue, etc.) if the style calls for it.

=== 1. MULTI-OPTION PROTOCOL (FOR UI PARSING) ===
- For \`continuity.character.description\` (Identity), \`continuity.character.body\` (Body Type), and \`continuity.wardrobe.description\`:
- **YOU MUST PROVIDE AT LEAST 4 DISTINCT OPTIONS**.
- **MUST USE "||" AS SEPARATOR**.
- Format: "Option A: [Description] || Option B: [Description] || Option C: [Description] || Option D: [Description]"

=== 2. CASTING & ACTING ===
- **Micro-Casting**: Use specific traits (e.g., "Scar on left eyebrow", "Calloused hands").
- **Body Types**: Be diverse. Use specific terms (e.g., "Skeletal", "Plump", "Athletic", "Soft").
- **Key Poses**: **MANDATORY: GENERATE AT LEAST 12 DISTINCT POSES**. Focus on unconscious habits, micro-gestures, and high-tension static poses. Do NOT generate generic actions.

=== OUTPUT: THE SHOOT PLAN (JSON) ===
{
  "title": "Poetic Title (Chinese)",
  "directorInsight": "A SINGLE concise, poetic sentence (Chinese). Abstract.",
  "productionNotes": { "lighting": "...", "palette": "...", "composition": "..." },
  "continuity": { 
     "character": { 
        "description": "4+ DISTINCT IDENTITY OPTIONS using || separator. (e.g. Student || Office Lady || Rebel...)", 
        "body": "4+ DISTINCT BODY TYPE OPTIONS using || separator. (e.g. Skinny || Curvy || Muscular || Soft...)",
        "details": ["Feature A", "Feature B"], 
        "origin": "director" 
     },
     "wardrobe": { 
        "description": "4+ DISTINCT OUTFIT OPTIONS using || separator.", 
        "material": "Texture focus", 
        "accessories": ["Item 1", "Item 2"], 
        "origin": "director" 
     },
     "set": { 
        "environment": "Location details. Use || for options.", 
        "timeOfDay": "Natural Light only", 
        "atmosphere": "Humidity, Dust, Smoke", 
        "origin": "director" 
     }
  },
  "shootScope": { 
      "nonNegotiables": ["${analysis.hardLocks.explicitTraits.join('", "')}"], 
      "flexibleElements": [], 
      "complexityLevel": "high"
  },
  "shootGuide": { 
      "keyPoses": [ 
          "Pose 1 (e.g. Biting nail)", 
          "Pose 2 (e.g. Slumping against wall)", 
          "Pose 3", "Pose 4", "Pose 5", "Pose 6", 
          "Pose 7", "Pose 8", "Pose 9", "Pose 10", 
          "Pose 11", "Pose 12..." 
      ], 
      "emotionalSpectrum": ["Emotion 1", "Emotion 2"] 
  },
  "contract": { "subjectIdentity": "...", "wardrobe": "...", "location": "...", "lighting": "...", "cameraLanguage": "...", "texture": "..." },
  "visualVariants": [
     "方案A: ...", "方案B: ...", "方案C: ..."
  ],
  "frames": [ "Shot 1...", "Shot 2..." ]
}
`;

        const genderInstruction = analysis.hardLocks.gender !== 'NEUTRAL' 
            ? `\n[CONSTRAINT] Subject Gender: ${analysis.hardLocks.gender}. Must be explicitly described in 'character' description.` 
            : "";

        const userPrompt = `PROJECT: ${analysis.coreSubject}${genderInstruction}\n[Instruction]: Interpret this with ORGANIC, HUMAN, FILM texture. No digital art feel. Casting Default: CHINESE (Dyed hair OK). Micro-casting Inspiration: "${creativeBrief.microCasting}"`;

        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }];
        const targetModel = model || Infrastructure.getModelPreferences().textModel;

        try {
            if (onChunk) onChunk(`正在接入文本模型: ${targetModel}\n`);
            const fullText = await Infrastructure.routeRequest(targetModel, messages, onChunk, signal);
            
            const rawData = JSONHealer.heal(fullText, FALLBACK_PLAN);
            
            if (!rawData.continuity) rawData.continuity = FALLBACK_PLAN.continuity;
            if (!rawData.continuity.character.body) rawData.continuity.character.body = "Default Body Type";
            
            // --- 3. BLUEPRINT INJECTION (New Architecture) ---
            // Construct the Adjudicated Blueprint and inject it into the plan
            const blueprintToken = Adjudicator.buildBlueprint(rawData, analysis);
            
            // Inject into details so it travels with the plan, but verify details array exists
            if (!rawData.continuity.character.details) rawData.continuity.character.details = [];
            rawData.continuity.character.details.unshift(blueprintToken);

            try {
                 if (rawData.frames) rawData.frames = await LocalizationService.processPlanFrames(rawData.frames, "Movie Frame", targetModel);
                 if (rawData.visualVariants) rawData.visualVariants = await LocalizationService.processPlanFrames(rawData.visualVariants, "Visual Style", targetModel);
                 if (rawData.shootGuide?.keyPoses) rawData.shootGuide.keyPoses = await LocalizationService.processPlanFrames(rawData.shootGuide.keyPoses, "Acting Pose", targetModel);
            } catch (e) {
                 console.warn("Localization failed", e);
            }
            
            return rawData as ShootPlan;

        } catch (e: any) {
            if (e.message === "Aborted" || signal?.aborted) throw e;
            console.error("Director API Failed:", e);
            if (onChunk) onChunk(`\n[系统警报] 导演链路通讯故障 (${e.message})。正在切换备用线路...\n`);
            return FALLBACK_PLAN;
        }
    },

    proposeNewVariants: async (plan: ShootPlan, count: number = 6, model?: string): Promise<string[]> => {
        const prompt = `
        Role: Art Director.
        Task: Create ${count} NEW visual style variants for "${plan.title}".
        Strategy: "Organic Textures".
        Requirements: NO CYBERPUNK. NO TECH. NO AI ART. Use Analog Film stocks.
        Output JSON: { "variants": ["方案N: ...", "方案N+1: ..."] }
        `;

        try {
            const targetModel = model || Infrastructure.getModelPreferences().textModel;
            const res = await Infrastructure.routeRequest(targetModel, [{role:'user', content: prompt}]);
            const json = JSONHealer.heal(res, { variants: [] });
            return await LocalizationService.processPlanFrames(json.variants || [], "Visual Style", targetModel);
        } catch (e) {
            return Array(count).fill("新平行宇宙方案 (生成失败)");
        }
    },

    /**
     * 流水线式剧本扩充 (Pipeline Script Extension)
     * 特性: 线程 A 完成生成+润色后，立即回调上层触发拍摄，无需等待线程 B/C
     */
    extendScript: async (
        plan: ShootPlan, 
        count: number, 
        model: DirectorModel, 
        referenceStyle: string,
        onLog?: (msg: string) => void,
        onChunkReady?: (scripts: string[], chunkIndex: number) => void
    ): Promise<string[]> => {
        const targetModelId = model || Infrastructure.getModelPreferences().textModel;

        // 2. Parallel Chunking
        const CHUNK_SIZE = 5;
        const chunks = [];
        let remaining = count;
        while (remaining > 0) {
            chunks.push(Math.min(remaining, CHUNK_SIZE));
            remaining -= chunks[chunks.length - 1];
        }

        if (onLog) onLog(`[并行引擎] 启动 ${chunks.length} 线程流水线 (Pipeline Mode)...`);

        const results = await Promise.all(
            chunks.map(async (batchSize, i) => {
                 const threadId = i + 1;
                 const t0 = Date.now();
                 
                 // Step A: Generate English Scripts
                 const rawScripts = await DirectorEngine._batchGenerateScripts(plan, batchSize, targetModelId, referenceStyle);
                 
                 if (rawScripts.length > 0) {
                     if (onLog) onLog(`  ↳ 线程 #${threadId}: 构思完成，正在极速润色...`);
                     
                     // Step B: Localize IMMEDIATELY (Pipeline)
                     const localizedScripts = await LocalizationService.processPlanFrames(rawScripts, "Movie Frame", targetModelId);
                     
                     const duration = ((Date.now() - t0) / 1000).toFixed(1);
                     
                     // Step C: Trigger Stream Callback (Fire image gen immediately)
                     if (onChunkReady) {
                         if (onLog) onLog(`  🚀 线程 #${threadId}: 剧本就绪，发射影像生成任务...`);
                         onChunkReady(localizedScripts, i);
                     } else {
                         if (onLog) onLog(`  ✅ 线程 #${threadId}: 闭环完成 (${localizedScripts.length}帧, ${duration}s)`);
                     }

                     return localizedScripts;
                 } else {
                     if (onLog) onLog(`  ❌ 线程 #${threadId}: 生成空数据`);
                     return [];
                 }
            })
        );

        return results.flat();
    },

    // Internal helper for extendScript
    _batchGenerateScripts: async (plan: ShootPlan, count: number, policyModelId: string, referenceStyle?: string): Promise<string[]> => {
        const context = `
        [Project]: ${plan.title || 'Untitled'}
        [Subject]: ${plan.continuity?.character?.description || 'Main Character'} (KEEP CONSISTENT)
        [Visual Style Lock]: ${referenceStyle || plan.visualVariants?.[0] || 'Cinematic'} (CRITICAL)
        `;

        const prompt = `
        Task: Create ${count} NEW distinct cinematic shot descriptions for a movie sequence.
        Context: ${context}
        
        Requirements:
        1. Fast paced, visual storytelling.
        2. Vary shot types (Close-up, Wide, Low-angle).
        3. KEEP SUBJECT CONSISTENT.
        4. ALIGN WITH THE [Visual Style Lock] defined above.
        5. Output strictly JSON: { "frames": ["Shot 1 description", "Shot 2 description", ...] }
        `;

        try {
            const res = await Infrastructure.routeRequest(policyModelId, [{ role: 'user', content: prompt }]);
            const json = JSONHealer.heal(res, { frames: [] as string[] });
            return Array.isArray(json?.frames) ? json.frames : [];
        } catch (e) {
            console.warn(`Script batch generation failed for count ${count}`, e);
            return [];
        }
    }
};
