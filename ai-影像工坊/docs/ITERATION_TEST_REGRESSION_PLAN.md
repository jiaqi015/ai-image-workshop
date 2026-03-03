# Iteration, Testing, and Regression Plan (V1)

## 1. Product North Star

Build a resilient AI filmmaking workflow where users only choose `text model` and `image model`, while the platform absorbs provider differences.

Primary quality dimensions:

1. Artistic Quality
2. Character/Scene Consistency
3. Style Tension
4. Script Diversity

## 2. Release Cadence

- Sprint length: 2 weeks
- Release train: weekly preview + biweekly production
- Hard gate: no production release without passing quality gate scripts

## 3. Three-Sprint Plan

### Sprint 1: Contract and Routing Stability

Goals:

1. Stabilize backend provider contract
2. Normalize error semantics
3. Build deterministic regression baseline

Deliverables:

1. Backend contract tests (`scripts/regression/run-backend-contracts.mjs`)
2. Golden prompt baseline (`quality/golden-prompts.v1.json`)
3. CI gate workflow (`.github/workflows/quality-gate.yml`)

Exit criteria:

1. Typecheck/build/contract tests all pass
2. No schema regressions in `/api/ai?action=models`

### Sprint 2: Quality Axis Improvement

Goals:

1. Quantify 4 quality axes
2. Enforce consistency constraints over batch generation

Deliverables:

1. Quality scoring runtime (planned)
2. Auto-repair strategy for low-score generations (planned)
3. Golden suite trend report (`quality/reports/*.json`) (planned)

Exit criteria:

1. +10% average score uplift vs Sprint 1 baseline
2. No increase in error rate or TTFF p95

### Sprint 3: Reliability and Ops

Goals:

1. End-to-end observability and rollback readiness
2. Provider outage tolerance

Deliverables:

1. Trace ID pipeline (planned)
2. Failure injection scripts (planned)
3. Release rollback checklist (planned)

Exit criteria:

1. 7 days production run with no P0 incidents
2. Fallback success rate >= 90%

## 4. Test Pyramid

### 4.1 Contract Tests (must-pass)

Validate stable backend semantics:

1. `GET /api/ai?action=health`
2. `GET /api/ai?action=models`
3. `POST /api/ai` error behavior (`chat`, `image`, unsupported action)
4. Auth behavior with `AI_GATEWAY_TOKEN`
5. Rate limit header existence

### 4.2 Regression Golden Suite (must-pass)

Validate quality asset baseline integrity:

1. dataset schema
2. unique IDs
3. dimension coverage
4. scenario coverage
5. provider-family tag coverage

### 4.3 Live Provider Smoke (optional)

When enabled by env (`RUN_LIVE_PROVIDER_SMOKE=1`), run low-cost smoke checks for providers with configured keys.

## 5. Quality Gate Definition

A release is blocked unless all are true:

1. `npm run typecheck` passes
2. `npm run build` passes
3. `npm run test:contracts` passes
4. `npm run test:golden` passes

## 6. Commands

```bash
npm run quality:gate
```

Optional provider smoke:

```bash
RUN_LIVE_PROVIDER_SMOKE=1 npm run test:golden
```

## 7. Ownership

1. Architecture owner: backend contract + routing invariants
2. Product owner: golden prompt baseline and acceptance policy
3. QA owner: gate policy and regression triage

