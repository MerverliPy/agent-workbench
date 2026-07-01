# 🚦 @agent-workbench/permissions

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-8-blue)]()

Allow/ask/deny policy engine and risk evaluators.

## Status

**Complete** — Phase 8. Full permission engine with path, command, and agent-level rules.

## Purpose

Central permission policy engine that evaluates tool calls, file paths, shell commands, and agent profiles against configured rules. Returns `allow`, `ask`, or `deny` outcomes.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `PermissionEngine` | `PermissionEngine` | Core evaluation engine, rule resolution |
| `PermissionGate` | `PermissionGate`, `PermissionDecisionValue` | Gate that enforces decisions |
| `Policy` | `defaultPolicy` | Default allow/ask/deny configuration |

## Types

```typescript
export type {
  PermissionEvalInput,   // Tool call + context for evaluation
  PermissionEvalResult,  // Outcome + matched rule + reason
  PermissionOutcome,     // "allow" | "ask" | "deny"
  PermissionPolicy,      // Policy configuration shape
  ToolRule,              // Tool-level rules
  PathRule,              // Path-based rules
  CommandRule,           // Shell command rules
  AgentRule,             // Agent-specific rules
} from "@agent-workbench/permissions";
```

## Default Policy

| Operation | Default | Rule |
|-----------|---------|------|
| Read (read, grep, glob) | `allow` | No approval needed |
| Edit / write / patch | `ask` | Requires user approval |
| Bash / shell commands | `ask` | Requires user approval |
| Destructive operations | `deny` | Blocked unless explicitly configured |

## Usage

```typescript
import { PermissionEngine, defaultPolicy } from "@agent-workbench/permissions";

const engine = new PermissionEngine(defaultPolicy);

const result = engine.evaluate({
  toolName: "write",
  targetPath: "/project/src/index.ts",
  agentId: "build",
});
// → { outcome: "ask", matchedRule: "...", reason: "File write requires approval" }
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: tool definitions, runtime orchestration, shell execution, storage, TUI rendering.

👉 See [`docs/05_PERMISSION_MODEL.md`](../docs/05_PERMISSION_MODEL.md), [`docs/06_SECURITY_MODEL.md`](../docs/06_SECURITY_MODEL.md)
