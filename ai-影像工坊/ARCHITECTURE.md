
# System Architecture & Iron Laws (系统架构与铁律)

> **Objective**: A Professional, Consistent, and Resilient AI Filmmaking Studio.
> **Philosophy**: Separation of Concerns (SoC) + Domain Driven Design (DDD) Lite.

## 1. Directory Structure (目录结构)

- **`assets/` (The DNA)**: 
  - Pure static data. Templates, dictionaries, constants.
  - **Rule**: NO logic, NO imports from services, NO side effects.
  
- **`services/capabilities/` (The Engine Room)**: 
  - Atomic functional units.
  - **Engines**: Pure logic for specific tasks (e.g., Prompt Engineering, Script Analysis).
  - **Guardrails**: Safety filters, JSON repair.
  - **Infra**: Database, Voice, Localization.
  
- **`services/features/` (The Business Logic)**: 
  - End-to-End flows that combine capabilities.
  - Example: `DirectorEngine` combines `ScriptAnalyzer`, `AssetRecaller`, and `JSONHealer`.
  
- **`services/api/` (The Network Layer)**: 
  - Handling HTTP, Retries, Proxy routing, and Error normalization.
  
- **`hooks/` (The Orchestration Layer)**: 
  - Connects UI to Services. Manages React State and Side Effects.
  - **Rule**: Hooks should NOT contain complex business logic (e.g., prompt parsing).

- **`services/public.ts` (The Gateway)**: 
  - The ONLY allowed import source for the UI/Hooks layer.

## 2. The Four Iron Laws (四大铁律)

### Law 1: Orchestration Isolation (编排隔离)
**Hooks must ONLY depend on `services/public.ts`, `assets/`, or `types/`.**
- ❌ **Forbidden**: `import { DirectorEngine } from "../services/features/director"`
- ✅ **Allowed**: `import { generateShootPlan } from "../services/public"`
- **Why**: Allows refactoring of internal services without breaking the UI.

### Law 2: Assets Purity (资产纯净)
**Assets must contain ONLY static data.**
- ❌ **Forbidden**: Functions that call APIs, `Date.now()`, or dynamic state.
- ✅ **Allowed**: Strings, Arrays, JSON objects, RegEx patterns.
- **Why**: Assets should be serializable and potentially loaded from a remote config in the future.

### Law 3: Policy Independence (策略独立)
**Features determine HOW, Orchestration determines WHEN.**
- Features (e.g., `camera.ts`) should expose *capabilities* (e.g., `shootFrame`).
- Hooks (e.g., `useDarkroom.ts`) should determine *concurrency*, *retries*, and *batching*.

### Law 4: The Public Barrier (公共屏障)
**`services/public.ts` is the API Surface.**
- If a function isn't exported in `public.ts`, it is **internal/private**.
- UI components should never reach deep into `services/capabilities/...`.

## 3. Key Patterns (核心模式)

- **Facade Pattern**: `useStudioArchitect` hides the complexity of 10+ state variables from `App.tsx`.
- **Semantic Isolation**: `CameraEngine` physically separates "Subject" prompts from "Style" prompts to prevent style bleeding.
- **Resilience Layer**: `Infrastructure` handles 429 Rate Limits and Network Errors transparently, so the UI doesn't crash.
- **JSON Healing**: We assume LLMs output broken JSON and fix it aggressively (`JSONHealer`).
