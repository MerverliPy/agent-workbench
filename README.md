# agent-workbench

Status: Phase 0 — Planning Docs  
Project type: local-first OpenCode-style agent TUI workbench  
Documentation depth: agent-ready  
Implementation status: non-functional planning only

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

## 2. Current Phase

The project is currently in **Phase 0 — Planning Docs**.

Phase 0 is strict non-functional planning. It must produce implementation-ready Markdown documentation only.

## 3. Phase 0 Allowed Files

Only the following files and folders are allowed in Phase 0:

```text
agent-workbench/
├─ README.md
├─ docs/
└─ decisions/
```

This batch covers:

```text
README.md
docs/00_PROJECT_INTENT.md
docs/01_TECH_STACK_DECISION.md
docs/02_ARCHITECTURE.md
docs/03_BACKEND_FRONTEND_BOUNDARY.md
docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md
docs/05_PERMISSION_MODEL.md
docs/06_SECURITY_MODEL.md
```

## 4. Phase 0 Forbidden Files

Do not create the following in Phase 0:

```text
package.json
bun.lock
apps/
packages/
src/
tests/
scripts/
runtime files
placeholder implementation files
generated SDK files
database migrations
OpenAPI generated output
```

If a future agent creates any of these during Phase 0, it is violating the current project contract.

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

## 7. Phase Order

Future work must follow this order:

```text
Phase 0  Planning docs
Phase 1  Workspace scaffold
Phase 2  Protocol contract
Phase 3  Local server
Phase 4  TUI shell
Phase 5  Storage
Phase 6  Core runtime
Phase 7  Read-only tools
Phase 8  Permission engine
Phase 9  File mutation tools
Phase 10 Shell execution
Phase 11 Agent modes
Phase 12 Token health
```

No phase may depend on a later phase. If a later concept is needed earlier, document the interface or placeholder contract, not implementation code.

## 8. Current Next Step

After this batch, continue generating Phase 0 docs:

```text
docs/07_API_CONTRACT_PLAN.md
docs/08_DATA_MODEL_PLAN.md
docs/09_AGENT_MODEL.md
docs/10_TOOL_RUNTIME_MODEL.md
docs/11_TOKEN_HEALTH_MODEL.md
docs/12_TUI_UX_MODEL.md
docs/13_RUN_LEDGER_MODEL.md
docs/14_DRY_RUN_MODEL.md
docs/15_CACHE_MODEL.md
docs/16_TESTING_STRATEGY.md
docs/17_RISK_REGISTER.md
docs/18_PHASE_EXIT_GATES.md
docs/19_TARGET_REPO_TREE.md
decisions/*.md
```

## 9. Agent Instructions

When continuing this project:

1. Treat these docs as the source of truth.
2. Do not re-ask answered architectural questions.
3. Do not invent unresolved details.
4. Mark uncertainty as `Unknown`, `Unresolved`, `Needs confirmation`, or `Provisional`.
5. Do not create implementation files during Phase 0.
6. Preserve the TUI/server/core/storage/permission boundaries.
7. Preserve schema-first API design.
8. Preserve localhost-only server default.
9. Preserve full run ledger requirement.
10. Preserve permission-gated file and shell execution.

## 10. Validation Checklist

Before leaving Phase 0:

```text
[ ] README.md exists.
[ ] docs/00 through docs/19 exist.
[ ] decisions/0001 through decisions/0015 exist.
[ ] No package.json exists.
[ ] No apps/ folder exists.
[ ] No packages/ folder exists.
[ ] No src/ folder exists.
[ ] No tests/ folder exists.
[ ] No scripts/ folder exists.
[ ] All docs state that Phase 0 is non-functional planning only.
[ ] All risky systems have documented permissions and ledger requirements.
[ ] The exact next phase is Phase 1 — Workspace Scaffold.
```
