# 00 — Project Intent

Status: Phase 0 — Planning Docs  
Document type: agent-ready project intent  
Scope: product purpose, principles, goals, non-goals, and success criteria

## 1. Purpose

This document defines the intent of `agent-workbench`.

The project is a local-first, OpenCode-style agent TUI workbench for software development. It should provide a terminal-native user experience while keeping privileged execution, state, tool calls, and policy enforcement in backend-controlled runtime layers.

The project must be designed so another coding agent can implement it phase by phase without needing the original planning conversation.

## 2. Product Goal

Create a local agent workbench that lets a developer interact with coding agents through a terminal UI while maintaining strong local safety controls.

The target product should support:

```text
interactive agent sessions
read-only codebase inspection
permission-gated edits
permission-gated shell commands
auditable run history
token-aware long sessions
local-first persistence
typed API and SDK
future extensibility to web, desktop, or automation clients
```

## 3. Target Outcome

The final system should feel like a disciplined local control plane for coding-agent work:

```text
User asks for work
  ↓
Agent plans
  ↓
Agent reads/searches safely
  ↓
Agent requests risky actions
  ↓
System asks user when required
  ↓
Approved actions execute
  ↓
Everything is logged
  ↓
Token health is maintained
```

## 4. Confirmed Design Direction

The project direction is:

```text
local-first
TUI-first
server-controlled
schema-first
permission-gated
patch-first for file mutation
audit-ledger-first for risky operations
token-health-aware
agent-ready documentation before implementation
```

## 5. Scope

### In Scope

The planned system includes:

- Terminal UI.
- Local backend server.
- Typed SDK.
- Core agent runtime.
- Read-only tools.
- File mutation tools.
- Shell command runner.
- Permission engine.
- SQLite-backed persistence.
- Run ledger.
- Build and Plan agents.
- Token-health system.
- Dry-run preview system.
- Read/search cache.
- Pre-run or mutation planner.

### Out of Scope for the Initial Implementation

The following are not part of the first implementation unless confirmed later:

- Full web UI.
- Desktop app.
- Multi-user team server.
- Remote-hosted control plane.
- LAN access by default.
- Full PTY shell in first shell phase.
- Subagents in first agent phase.
- Telemetry.
- Plaintext provider secret storage.

### Out of Scope for Phase 0

Phase 0 must not include:

- Code.
- Config files.
- Runtime placeholders.
- Package files.
- Test files.
- Scripts.
- Generated outputs.
- Database migrations.
- SDK generation.
- API implementation.

## 6. Non-Goals

The project is not trying to be:

- A browser-first IDE.
- A hosted SaaS agent platform.
- A general-purpose workflow automation system.
- A remote execution service.
- A multi-user collaboration server.
- A replacement for permissions with model judgment.
- A TUI that directly runs tools or edits files.
- A quick prototype that ignores safety boundaries.

## 7. Guiding Principles

### Principle 1 — TUI Is a Thin Client

The TUI renders state, accepts user input, and calls the local API. It must not execute tools, modify files, run shell commands, or decide permissions.

### Principle 2 — Server Is the Local Control Plane

The server owns request validation, local API, event streaming, lifecycle, and route-level orchestration.

### Principle 3 — Core Owns Agent Runtime

The core runtime owns the session loop:

```text
prompt → context → model call → tool request → permission → tool result → next step
```

### Principle 4 — Permissions Are Mandatory

Every file mutation and shell action must pass through a permission engine before execution.

### Principle 5 — Auditability Is Required

Every risky or meaningful operation must be recorded in the run ledger.

### Principle 6 — Token Health Is Required

Long sessions must not degrade silently. Tool outputs, message history, and context budgets must be managed intentionally.

### Principle 7 — Phase Order Matters

Implementation must follow the confirmed phase order. Do not implement later-phase capabilities early.

## 8. Confirmed User Preferences

The user prefers:

- Dense, structured, implementation-ready Markdown.
- Clear phase-based execution.
- Pre-generated answer options when clarification is needed.
- Exact next steps.
- No repeated questions for already-decided items.
- No invented details.
- Uncertainty marked explicitly.
- Docs optimized for coding agents.

## 9. Agent Instructions

When implementing from this document:

1. Read this document before any implementation work.
2. Preserve the project intent even if implementation details change later.
3. Do not collapse frontend, server, and runtime into one layer.
4. Do not treat the TUI as trusted.
5. Do not implement shell or file mutation before permissions.
6. Do not implement code during Phase 0.
7. Record all unresolved details instead of filling them in silently.

## 10. Acceptance Criteria

This document is complete when it clearly establishes:

```text
[ ] What the project is.
[ ] What the project is not.
[ ] What Phase 0 allows.
[ ] What Phase 0 forbids.
[ ] What the guiding architecture principles are.
[ ] What user preferences must be preserved.
[ ] What future agents must not assume.
```

## 11. Exit Gate

Phase 0 may not exit until this project intent is reflected consistently across all Phase 0 docs.

## 12. Anti-Patterns

Do not:

- Create a monolithic TUI that owns execution.
- Let model output directly mutate files.
- Let shell commands run without deterministic permission checks.
- Skip run ledger design.
- Treat token management as optional.
- Use Phase 0 to create runnable scaffolding.
- Invent unresolved implementation details.

## 13. Validation Checklist

```text
[ ] The project is described as local-first.
[ ] The TUI is described as a thin client.
[ ] The server is described as the local control plane.
[ ] The core runtime is identified as the owner of agent execution.
[ ] Phase 0 is explicitly non-functional.
[ ] Non-goals are documented.
[ ] Unconfirmed areas are not presented as final decisions.
```
