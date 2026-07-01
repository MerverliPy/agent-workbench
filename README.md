# agent-workbench

Status: Phase 16 in progress (streaming provider responses)
Project type: local-first OpenCode-style agent TUI workbench
Latest pushed commit: 69eba42 Fix ProviderRegistry error message to not expose env var names
Test baseline: 334 tests, 0 failures, 1003 expect() calls

## 1. Project Summary

`agent-workbench` is a planned local-first agent workbench for terminal-based software development workflows. The system is inspired by modern OpenCode-style architecture: a thin terminal UI client talks to a local server, and the server coordinates a core agent runtime that owns sessions, model calls, tools, permissions, storage, and token-health logic.

The target stack is:

```text
TypeScript + Bun
OpenTUI + SolidJS
Hono + Zod/OpenAPI
SQLite + Drizzle
Local HTTP API + SSE event stream
Generated or typed SDK
Custom agent runtime
Custom permission engine
Custom tool runtime
```

## 2. Current State

Phases 0–15 are complete. Phase 16 (streaming provider responses) is in progress — adds `stream()` to the `ModelProvider` interface, implements streaming in `OpenAICompatibleProvider`, and routes streaming deltas through the existing event architecture to the TUI for incremental text rendering.

Phase 0 planning docs (docs/00 through docs/19) remain the architectural source of truth. Their "Phase 0" status labels refer to planning origin, not current project phase.

## 3. Implementation Status

All core systems are implemented:

- Terminal UI (apps/tui) — thin client, rendering only
- Local server (apps/server) — HTTP/SSE control plane
- Schema-first protocol (packages/protocol) — Zod contracts, OpenAPI
- Typed SDK (packages/sdk) — validated client transport
- Core runtime (packages/core) — session runner, tool dispatch, permission orchestration
- Storage (packages/storage) — SQLite/Drizzle, 10 tables, repositories
- Read-only tools (packages/tools) — read, grep, glob
- Permission engine (packages/permissions) — allow/ask/deny, path/command/agent rules
- File mutation tools (packages/tools) — write, edit, apply_patch, diff preview
- Shell execution (packages/shell) — command runner, risk classification, preview
- Agent modes (packages/core) — Build and Plan agents
- Token health (packages/tokens) — budget tracking, compaction support
- Pre-run planner (packages/planner) — mutation plans, plan gate enforcement
- Read/search cache (packages/cache) — invalidation on mutation
- Dry-run preview (packages/diff, packages/shell) — file and command preview
- Automated testing — unit, integration, e2e, fault injection, contract tests
- Hardening — regression, security, fault injection, contract test coverage

## 4. OpenCode Workflow

This project follows an **OpenCode-style agent workflow** — a structured loop of planning, permission-gated execution, review, and verification.

### 4.1 Plan Before Execute

Every mutation or risky operation requires a plan. The agent:

1. Reads relevant files and inspects the current state.
2. Proposes a bounded plan identifying target files, steps, and risk classification.
3. Obtains approval before writing, editing, patching, or running shell commands.
4. Executes the approved plan through the runtime (never through the TUI).

Read-only operations (read, grep, glob) do not require a plan.

### 4.2 Permission Gates

All tool execution passes through the permission engine. The default posture is:

| Operation | Default | Notes |
|---|---|---|
| Read (read, grep, glob) | `allow` | No approval needed |
| Edit / write / patch | `ask` | Requires user approval |
| Bash / shell commands | `ask` | Requires user approval |
| Destructive operations | `deny` | Blocked unless explicitly configured |

The TUI never decides policy — it renders prompts and records decisions. All policy evaluation happens server-side in the core runtime.

### 4.3 Architecture Split

The workflow enforces strict boundaries:

- **TUI** — rendering and user input only. Never spawns processes, executes commands, or evaluates permissions.
- **Server** — thin HTTP/SSE routes. Delegates to core runtime; never executes tools directly.
- **Core runtime** — orchestrates sessions, tool dispatch, permission evaluation, plan gating, and ledger recording.
- **Packages** — tools, permissions, shell, storage, tokens, cache each own a single responsibility.

### 4.4 Safety Model

#### 4.4.1 Runtime Safety Guarantees

- No shell command bypasses permission checks.
- No file mutation bypasses diff preview or plan gate.

#### 4.4.2 Model-Router Workflow Constraints

- No Copilot model is used as the primary autonomous executor.
- No local-only model is the final authority for high-risk work.
- Secrets and tokens are not stored in plaintext by default.
- The server binds to localhost by default.

### 4.5 Verification in Workflow

After changes, run the narrowest relevant check first:

```bash
bun test                           # full suite
bun run typecheck                  # in the changed package or app
bun run lint                       # if configured
```

See section 10 for the full verification command reference.

## 5. Target System Model

```text
TUI client
  ↓
Typed SDK
  ↓
Local HTTP/SSE server
  ↓
Core agent runtime
  ↓
Tools + permissions + models + storage + token health
```

The TUI is never trusted to execute privileged operations. It may request actions and render state, but all actual execution must pass through server-side validation, core runtime orchestration, permission evaluation, and ledger recording.

## 6. Core Product Requirements

The system must eventually support:

- Terminal UI for interactive coding-agent sessions.
- Local backend server bound to localhost by default.
- Schema-first API with Zod as source of truth.
- Server-Sent Events for streaming updates.
- Typed SDK used by TUI and future clients.
- SQLite/Drizzle local persistence.
- Full run ledger for model calls, tool calls, permission decisions, file changes, shell commands, and compaction events.
- Read-only tools first: `read`, `grep`, `glob`.
- Permission model: `allow`, `ask`, `deny`.
- Default permission posture:
  - read: allow
  - edit/write/patch: ask
  - bash: ask
  - destructive commands: deny unless explicitly configured
- Patch-first file mutation with diff preview.
- Simple command runner before full PTY support.
- Initial agents: Build and Plan.
- No subagents initially.
- Token-health system with truncation, summarization, and context budget calculation.
- Optimization layer:
  - run ledger panel
  - required execution plan before mutation
  - read/search cache with invalidation
  - token-health panel
  - dry-run preview for file edits and shell commands

## 7. Phase Completion Summary

```text
Phase 0  Planning docs           COMPLETE
Phase 1  Workspace scaffold      COMPLETE
Phase 2  Protocol contract       COMPLETE
Phase 3  Local server            COMPLETE
Phase 4  TUI shell               COMPLETE
Phase 5  Storage                 COMPLETE
Phase 6  Core runtime            COMPLETE
Phase 7  Read-only tools         COMPLETE
Phase 8  Permission engine       COMPLETE
Phase 9  File mutation tools     COMPLETE
Phase 10 Shell execution         COMPLETE
Phase 11 Agent modes             COMPLETE
Phase 12 Token health            COMPLETE
Phase 13 Pre-run planner         COMPLETE
Phase 14A Automated tests        COMPLETE
Phase 14B Hardening              COMPLETE
Phase 15 Provider integration    COMPLETE
Phase 16 Streaming responses     IN PROGRESS
```

## 8. Next Steps

Phase 16 adds streaming model responses from the OpenAI-compatible provider through the existing SSE event architecture to the TUI. See `docs/24_PHASE_16_STREAMING_RESPONSES.md` and `decisions/0016-streaming-provider-responses.md` for the full scope.

## 9. Agent Instructions

When continuing this project:

1. Treat docs and decisions as the source of truth.
2. Do not re-ask answered architectural questions.
3. Do not invent unresolved details.
4. Mark uncertainty as `Unknown`, `Unresolved`, `Needs confirmation`, or `Provisional`.
5. Preserve the TUI/server/core/storage/permission boundaries.
6. Preserve schema-first API design.
7. Preserve localhost-only server default.
8. Preserve full run ledger requirement.
9. Preserve permission-gated file and shell execution.
10. Provider configuration is environment-sourced. Default tests remain offline with mock providers.

## 10. Verification Commands

```bash
# Full test suite
bun test                           # 334 tests, 0 failures

# Per-category
bun run test:unit
bun run test:integration
bun run test:e2e

# Static health checks
bash scripts/test-health.sh

# Repeatability (default 3 runs)
TEST_REPEAT_COUNT=3 bun run test:repeat
```

Type-check and build verification (from repo root):

```bash
cd packages/protocol && bun run typecheck
cd packages/storage && bun run typecheck
cd packages/core && bun run typecheck
cd packages/sdk && bun run typecheck
cd apps/server && bun run typecheck
cd apps/tui && bun run typecheck
```
