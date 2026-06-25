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
Phase 4 TUI Shell is accepted.
Phase 5 Storage is accepted.
Phase 6 Core Runtime is accepted.

Current work is Phase 7: Read-Only Tools, unless the user explicitly says otherwise.

Phase 7 scope:

1. Inspect only the relevant Phase 7 docs, packages/tools, packages/core integration points, and adjacent cache/storage/event surfaces before changing files.
2. Implement the initial read-only tools in packages/tools:
   - read
   - grep
   - glob
3. Implement structured tool inputs.
4. Implement structured tool results.
5. Add tool input schema validation.
6. Add tool-result compression and truncation hooks for large outputs.
7. Respect sensitive paths and project-root boundaries.
8. Add cache integration for read/grep/glob where supported by the existing package structure.
9. Ensure read-only tool calls are recorded in the run ledger.
10. Ensure read-only tool calls remain visible through the existing runtime event/server/TUI path.
11. Wire tool registration into the existing Phase 6 ToolRegistry/Core runtime path only as needed.

Phase 7 must not implement file mutation tools, write/edit/apply_patch, shell execution, permission engine policy, diff application, token-health runtime, planner runtime, model-provider-specific UI, database table definitions, or unrelated TUI features.

Read-only tools must not mutate project state.

Do not implement future phases unless the active phase explicitly allows it.

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