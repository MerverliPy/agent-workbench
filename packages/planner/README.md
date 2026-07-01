# 📋 @agent-workbench/planner

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-13-blue)]()

Pre-run and mutation planning gates before risky operations.

## Status

**Complete** — Phase 13. Plan validation, risk classification, and mutation detection all implemented.

## Purpose

Enforces that every mutation or risky operation has an approved plan before execution. Validates plan structure, classifies risk levels, and detects mutation vs read-only operations.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `validate` | `validatePlan`, `computePlanRiskLevel`, `hasMutationSteps`, `hasRiskySteps` | Plan validation and risk analysis |

## Types

```typescript
export type { PlanValidationResult } from "@agent-workbench/planner";
```

## Usage

```typescript
import { validatePlan, hasMutationSteps } from "@agent-workbench/planner";

const plan = {
  title: "Refactor auth module",
  steps: [
    { action: "read", target: "src/auth.ts" },
    { action: "edit", target: "src/auth.ts", description: "Update token validation" },
  ],
};

const validation = validatePlan(plan);
const hasMutation = hasMutationSteps(plan.steps);
// → true (has edit step)
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: runtime orchestration, tool execution, permission policy, storage, TUI rendering.

👉 See [`docs/14_DRY_RUN_MODEL.md`](../docs/14_DRY_RUN_MODEL.md)
