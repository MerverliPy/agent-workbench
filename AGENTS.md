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
Phase 8 Permission Engine is accepted.
Phase 9 File Mutation Tools is accepted.
Phase 10 Shell Execution is accepted.

Current work is Phase 11: Agent Modes, unless the user explicitly says otherwise.

Phase 10 scope:

1. Inspect only the relevant Phase 10 docs, decisions, packages/shell, packages/tools bash/tool integration points, packages/core tool-dispatch and permission orchestration, packages/permissions command policy integration, packages/storage ledger/shell-command persistence, packages/events shell events, apps/server route integration points, and apps/tui shell/permission/rendering points before changing files.
2. Implement controlled shell execution through the backend runtime/tool path, not through TUI or direct server route process spawning.
3. Implement a simple command runner first.
4. Add a bash/shell tool only through packages/tools and the existing tool registry/runtime path.
5. Keep packages/shell responsible for command runner mechanics, command preview support, process lifecycle, timeout, abort, stdout/stderr capture, and output limits.
6. Keep packages/tools responsible for shell tool definitions and execution adapters.
7. Keep packages/permissions responsible for command-level allow/ask/deny policy decisions.
8. Keep packages/core responsible for orchestrating shell tool execution, command preview, permission gates, events, ledger entries, timeout/abort flow, and tool result handling.
9. Add static command preview/dry-run metadata before ask-gated shell execution.
10. Ensure shell dry-run/preview never executes the command.
11. Require permission evaluation before any command execution.
12. Ensure bash/shell defaults to ask unless deterministic policy denies it.
13. Ensure destructive commands default to deny unless explicitly configured otherwise by existing policy architecture.
14. Ensure deny prevents command execution.
15. Ensure ask pauses execution until an approve/deny decision is received.
16. Ensure no shell command bypasses permission checks.
17. Ensure no shell command bypasses command preview where Phase 10 docs require preview.
18. Record command proposal, risk classification, preview, permission decision, start, output chunks or controlled output summaries, completion, failure, timeout, and abort events in the run ledger where the existing architecture supports it.
19. Control shell output size and avoid storing unlimited raw command output.
20. Redact obvious secret values from command output where reasonably possible within Phase 10 scope.
21. Support timeout and abort for long-running commands.
22. Keep the TUI renderer-only: it may display command previews, permission prompts, shell status, output summaries/chunks, timeout/abort status, and ledger entries, but it must not spawn processes, execute shell commands, or decide policy.
23. Keep server route handlers thin: they may expose protocol/API surfaces, but must not spawn processes or execute shell commands directly outside the core/tool/permission/shell path.
24. Add PTY design documentation only if required by the docs.
25. Keep PTY execution out of Phase 10 unless explicitly approved by the user.

Phase 10 must not implement full PTY execution, terminal emulation, token-health runtime, broad planner runtime, agent modes, model-provider-specific UI, unrelated TUI features, or broad future-phase behavior.

Do not let model output, TUI code, route handlers, tools, shell utilities, or dry-run/preview code bypass permission checks.

Do not implement future phases unless the active phase explicitly allows it.

Phase 11 scope:

1. Inspect only the relevant Phase 11 docs, decisions, packages/core agent-mode integration, packages/permissions agent-level policy, packages/protocol agent profile schemas, packages/sdk agent selection surface, packages/storage agent persistence (if aligned), packages/events agent events, apps/server agent route integration, and apps/tui agent-mode rendering points before changing files.
2. Define Build and Plan agent modes.
3. Add agent profile metadata and selection model.
4. Ensure selected agent mode is visible to core/runtime.
5. Ensure permission engine can apply agent-level rules.
6. Store/version agent definitions or make them version-ready.
7. Expose enough protocol/server/sdk surface for selecting an agent mode if already aligned with architecture.
8. TUI may render/select agent mode through SDK/server only.
9. TUI must not decide agent policy.
10. Agents cannot bypass permissions.
11. No subagents.
12. No delegation system.
13. No broad planner runtime.
14. No token-health runtime.
15. No provider-specific UI.
16. No unrelated TUI features.

Phase 11 must not implement subagents, delegation, broad planner runtime, token-health runtime, provider-specific UI, full PTY execution, terminal emulation, or future-phase behavior.

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