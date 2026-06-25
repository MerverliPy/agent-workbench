agent-workbench Agent Rules

Mission

Build agent-workbench: a local-first OpenCode-style agent TUI workbench.

Use the existing docs and decisions as source of truth. Do not re-decide confirmed architecture. Mark missing details as Unknown, Unresolved, Needs confirmation, or Provisional.

Stack

TypeScript + Bun monorepo.

Core stack:

* OpenTUI + SolidJS for TUI
* Hono for local server
* Zod as protocol source of truth
* OpenAPI generated from protocol schemas
* SQLite + Drizzle for local storage
* SSE for event streaming
* Typed SDK for client/server interaction

Architecture Boundaries

* apps/tui: thin client only.
* apps/server: local HTTP/SSE control plane.
* packages/core: agent runtime orchestration.
* packages/protocol: Zod schemas, route contracts, shared protocol types.
* packages/sdk: typed client for protocol/API/SSE.
* packages/events: shared event names, event helpers, and event-streaming types only.
* packages/storage: SQLite/Drizzle persistence.
* packages/permissions: permission policy/evaluation.
* packages/tools: tool definitions and execution adapters.
* packages/shell: simple command runner first; PTY later.
* packages/diff: patch/diff utilities.
* packages/tokens: token health, budgets, compaction support.
* packages/cache: read/grep/glob cache.
* packages/planner: execution planning before mutation.
* packages/ui: shared UI primitives only.

TUI may import packages/sdk, packages/protocol, packages/events, and packages/ui.

TUI must not import runtime authority packages directly: core, tools, shell, storage, permissions/internal, or models/internal.

Current Phase

Phase 0 is complete.
Phase 1 scaffold is accepted.
Phase 2 Protocol Contract is accepted.
Phase 3 Local Server is accepted.

Current work is Phase 4: TUI Shell, unless the user explicitly says otherwise.

Phase 4 scope:

1. Implement the terminal TUI shell in apps/tui using OpenTUI + SolidJS.
2. Render a chat-first layout: header, session sidebar, message timeline, prompt editor, status bar.
3. Add command palette, permission modal placeholder, diff viewer placeholder, run ledger panel placeholder, and token-health panel placeholder.
4. Connect to the local server through @agent-workbench/sdk.
5. Subscribe to SSE events via sdk.events.connect().
6. Handle Phase 3 placeholder routes returning HTTP 501 gracefully.
7. Keep the TUI as a thin client — no tool execution, no file mutation, no model calls, no shell execution, no storage access, no permission policy.

Do not implement core runtime, tools, storage schema, permission engine, model adapters, shell runner, diff engine, or token-health runtime unless the active phase explicitly allows it.

Protocol Rules

Zod is the source of truth.

Prefer explicit schemas for:

* error envelopes
* event envelopes
* sessions
* messages
* tools
* permissions
* files
* config
* providers
* route contracts

Export inferred TypeScript types from schemas. Avoid duplicated hand-written protocol types when z.infer is enough.

Use stable names. Avoid speculative abstractions.

Route contracts must distinguish pathParams, query, body, response, and errors.

Server and SDK code must consume protocol contracts instead of duplicating DTOs.

SDK successful responses must be validated, not cast.

OpenAPI generation must preserve path params, query params, request bodies, error responses, and SSE media types.

SSE parsing must validate event envelopes and must not silently swallow malformed events.

Safety Model

Default permission posture:

* read: allow
* grep/glob: allow
* edit/write/patch: ask
* bash: ask
* destructive operations: deny unless explicitly configured

File mutation must be patch-first with diff preview and approval by default.

Shell execution starts as a simple command runner before PTY support.

Server defaults to localhost-only.

No plaintext secrets in storage by default.

Agent Behavior

Before changing files:

1. Inspect relevant files only.
2. State the smallest implementation plan.
3. Modify only files required for the current phase.
4. Keep changes minimal and reviewable.
5. Verify with focused commands.

Do not bulk-read all docs. Load docs lazily only when relevant to the task.

Do not create placeholder runtime code outside the approved phase.

Do not invent dependency versions or APIs. Check installed package metadata or official docs when uncertain.

Code Standards

Use strict TypeScript.
Prefer small modules with clear exports.
Prefer named exports.
Keep protocol packages dependency-light.
Do not add circular package dependencies.
Do not use any unless justified locally.
Do not swallow errors silently.
Use discriminated unions for protocol variants where useful.
Keep schemas readable and stable.

Verification

After changes, run the narrowest relevant checks first.

Preferred commands, when available:

* bun install
* bun run typecheck
* bun run lint
* bun test

If a command is unavailable because scripts are not defined yet, report that clearly and do not fabricate a pass.

Git Discipline

Keep commits narrow and phase-scoped.

Do not mix unrelated server, TUI, runtime, storage, tools, shell, model, or UI work into the active phase.

Before committing:

1. Confirm changed files match the active phase.
2. Run the narrowest relevant checks.
3. Confirm git status --short contains only intentional changes.