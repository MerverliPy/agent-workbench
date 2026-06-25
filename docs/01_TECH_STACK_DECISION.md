# 01 — Tech Stack Decision

Status: Phase 0 — Planning Docs  
Document type: agent-ready stack decision  
Scope: selected technologies, rejected alternatives, implementation implications

## 1. Purpose

This document records the confirmed technical stack for `agent-workbench`.

The stack is selected to support a local-first, OpenCode-style agent TUI with a thin terminal frontend, local HTTP/SSE server, schema-first API, typed SDK, core agent runtime, permissioned tool execution, and local persistence.

## 2. Confirmed Stack

```text
Language: TypeScript
Runtime: Bun
TUI renderer: OpenTUI
TUI component model: SolidJS
Server framework: Hono
API/schema layer: Zod + OpenAPI generation
Storage: SQLite + Drizzle
Event transport: Server-Sent Events
SDK: TypeScript SDK generated or derived from protocol contracts
Model layer: provider adapter layer, AI SDK-style
Formatting/linting: Biome is provisional
```

## 3. Stack Table

| Layer | Decision | Status |
|---|---|---|
| Language | TypeScript | Confirmed |
| Runtime | Bun | Confirmed |
| TUI | OpenTUI | Confirmed |
| TUI components | SolidJS | Confirmed |
| Server | Hono | Confirmed |
| API schemas | Zod | Confirmed |
| API documentation | OpenAPI derived from Zod contracts | Confirmed |
| Storage | SQLite + Drizzle | Confirmed |
| Event stream | SSE | Confirmed |
| SDK | Typed TypeScript SDK | Confirmed |
| Model abstraction | Provider adapter layer | Confirmed |
| Formatting/linting | Biome | Provisional |
| First shell model | Simple command runner | Confirmed |
| Full PTY | Later design, not first shell phase | Confirmed |

## 4. Rationale

The selected stack supports one language and type system across:

```text
TUI
server
protocol schemas
SDK
core runtime
tools
permissions
models
storage adapters
token-health logic
```

This reduces cross-language schema drift and helps coding agents make coherent changes across the repo.

## 5. Rejected Primary Stack

### Go + Bubble Tea as Primary Stack

Rejected as the primary stack for this project.

Reason:

- Better suited to compact standalone terminal apps.
- Introduces cross-language boundary with TypeScript SDKs and AI tooling.
- Increases schema duplication risk.
- Less aligned with the confirmed OpenCode-style TypeScript architecture direction.
- Makes future web/desktop/SDK clients more expensive to share with core types.

Go may still be considered later for isolated native components if needed, but it is not the primary project stack.

Potential later Go/native areas:

```text
PTY supervisor
sandbox runner
resource limiter
file watcher
native binary helper
```

These are not part of the confirmed early implementation.

## 6. Hard Constraints

Future implementation must preserve:

```text
[ ] TypeScript as primary language.
[ ] Bun as primary runtime/tooling choice.
[ ] OpenTUI + SolidJS for TUI.
[ ] Hono for local server.
[ ] Zod as schema source of truth.
[ ] SQLite + Drizzle for local persistence.
[ ] SSE for event stream.
[ ] Typed SDK between TUI and server.
```

Do not replace these without explicit confirmation.

## 7. Ownership Implications

### TUI Stack Ownership

`apps/tui` owns:

```text
OpenTUI rendering
SolidJS component tree
keyboard interactions
command palette
message timeline
permission modal rendering
diff viewer rendering
ledger panel rendering
token-health rendering
```

It must not own:

```text
tool execution
model calls
permission evaluation
file writes
shell execution
storage repositories
```

### Server Stack Ownership

`apps/server` owns:

```text
Hono app
HTTP routes
SSE routes
middleware
request validation
response envelopes
localhost binding
local auth hooks
```

It must not own:

```text
agent reasoning internals
tool implementation internals
database schema ownership
TUI rendering
```

### Protocol Stack Ownership

`packages/protocol` owns:

```text
Zod schemas
route contracts
error envelopes
OpenAPI document generation inputs
shared inferred types
```

It must not own:

```text
business logic
database queries
TUI state
tool execution
```

## 8. Implementation Rules

When implementing after Phase 0:

1. Define schemas in `packages/protocol` before routes.
2. Make route handlers validate requests against protocol schemas.
3. Generate or derive SDK types from the protocol package.
4. Do not hand-maintain divergent request/response interfaces.
5. Do not let database schema become the API schema source of truth.
6. Keep provider-specific model logic behind a model adapter boundary.
7. Keep Bun-specific runtime concerns out of protocol definitions.

## 9. Non-Goals

This stack decision does not define:

- Final package versions.
- Exact dependency list.
- Exact Bun build commands.
- Exact OpenTUI component API usage.
- Exact Hono route implementation.
- Exact Drizzle driver selection.
- Exact model providers.

Those remain unresolved until implementation phases.

## 10. Unknowns and Unresolved Details

| ID | Detail | Status |
|---|---|---|
| TS-001 | Exact dependency versions | Unknown |
| TS-002 | Exact OpenTUI/Solid integration API | Needs verification during implementation |
| TS-003 | Exact SQLite driver for Bun | Needs confirmation |
| TS-004 | Exact model provider list | Unresolved |
| TS-005 | Exact SDK generation tool | Unresolved |
| TS-006 | Whether Biome is final | Provisional |

## 11. Acceptance Criteria

This decision is preserved when:

```text
[ ] All future package plans use TypeScript.
[ ] API contracts are Zod-first.
[ ] TUI uses OpenTUI + SolidJS.
[ ] Server uses Hono.
[ ] Persistence uses SQLite + Drizzle.
[ ] SDK is typed and protocol-driven.
[ ] No Go/Bubble Tea primary architecture is introduced.
```

## 12. Exit Gate

Phase 0 may not exit until all implementation docs reference this stack consistently.

## 13. Anti-Patterns

Do not:

- Implement the server in a different language without confirmation.
- Use TypeScript interfaces as the only API contract.
- Hand-code separate request types in TUI and server.
- Let routes define schemas ad hoc.
- Use a browser-first frontend architecture for the terminal client.
- Add Go/Bubble Tea as the main TUI stack.
- Build around remote deployment as the default.

## 14. Agent Instructions

For future coding agents:

1. Treat this file as the stack source of truth.
2. Do not suggest replacing the primary stack unless asked.
3. Verify current library APIs before writing code.
4. If a dependency has changed, document the change before implementing around it.
5. Mark version-specific assumptions as `Needs verification`.

## 15. Validation Checklist

```text
[ ] Stack table is present.
[ ] Rejected alternatives are documented.
[ ] Implementation implications are clear.
[ ] Unknowns are marked.
[ ] Future agents are instructed not to invent versions or APIs.
```
