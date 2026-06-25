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
Phase 7 Read-Only Tools is accepted.

Current work is Phase 8: Permission Engine, unless the user explicitly says otherwise.

Phase 8 scope:

1. Inspect only the relevant Phase 8 docs, packages/permissions, packages/protocol permission schemas, packages/storage permission persistence, packages/events permission events, and packages/core permission integration points before changing files.
2. Implement the centralized permission engine in packages/permissions.
3. Support exactly these deterministic decision classes:
   - allow
   - ask
   - deny
4. Define permission request schemas.
5. Define permission decision schemas.
6. Add permission request and permission decision events.
7. Persist permission requests and permission decisions using the existing storage architecture.
8. Ensure risky operations can be routed through permission evaluation before execution.
9. Ensure permission requests and decisions are recorded in the run ledger.
10. Ensure the TUI remains a renderer only and does not decide permission policy.
11. Keep the permission engine backend-owned and deterministic.

Phase 8 must not implement file mutation tools, write/edit/apply_patch, shell execution, diff application, PTY support, token-health runtime, planner runtime, model-provider-specific UI, unrelated TUI features, or broad future-phase behavior.

Do not let route handlers, tools, shell code, or TUI code bypass the permission engine.

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