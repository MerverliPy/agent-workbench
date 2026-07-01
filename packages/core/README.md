# 🧠 @agent-workbench/core

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-6..16-blue)]()

Agent runtime orchestration: session runner, tool dispatch, permission orchestration, and plan gate.

## Status

**Complete** — implemented across Phases 6–16. Handles session lifecycle, context building, model/tool loop, plan gating, token health, and agent modes.

## Purpose

Central agent runtime that owns the session lifecycle, dispatches tool calls through registered handlers, evaluates permission gates before execution, and records all operations in the run ledger.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `SessionRunner` | `SessionRunner` | Manages session lifecycle, message loop, run orchestration |
| `ContextBuilder` | `ContextBuilder` | Builds and compresses context for model calls |
| `ModelRouter` | `ModelRouter` | Routes model requests to the configured provider |
| `ToolCallDispatcher` | `ToolCallDispatcher` | Dispatches tool calls to registered handlers |
| `EventPublisher` | `EventPublisher` | Internal event publishing for runtime events |
| `RunLedger` | `RunLedger` | Append-only audit trail for runtime events |
| `PlanGate` | `PlanGate`, `isMutationOrRisky`, `isMutationTool`, `isShellTool` | Pre-execution plan validation gate |
| `TokenHealthService` | `TokenHealthService` | Token health monitoring during runs |
| `RunRegistry` | `RunRegistry` | Active run state tracking |
| `AgentRegistry` | `AgentRegistry`, `BUILD_AGENT`, `PLAN_AGENT`, `ALL_AGENTS` | Agent mode definitions and selection |

## Types

```typescript
export type {
  ContextMessage,
  ToolCallRequest,
  ToolCallResult,
  RunOptions,
  RunResult,
  CoreDependencies,
  AgentProfile,
  ActiveRun,
} from "@agent-workbench/core";
```

## Usage

```typescript
import { SessionRunner, AgentRegistry, PlanGate } from "@agent-workbench/core";

const runner = new SessionRunner({
  tools: toolRegistry,
  permissions: permissionEngine,
  storage: storageConnection,
  models: providerRegistry,
  planner: planGate,
});
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: tool definitions, shell execution, permission policy decisions, storage schema, TUI rendering, model adapters, protocol schemas.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md), [`docs/18_PHASE_EXIT_GATES.md`](../docs/18_PHASE_EXIT_GATES.md), [`docs/21_PACKAGE_OWNERSHIP.md`](../docs/21_PACKAGE_OWNERSHIP.md)
