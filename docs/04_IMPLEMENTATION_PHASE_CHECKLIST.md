# 04 — Implementation Phase Checklist

> **⚠️ DEPRECATED — July 2026.** This document tracks phases 0–18 only and is 9+ phases behind reality (current: Phase 29). The authoritative source is [`docs/27_PROJECT_ROADMAP.md`](./27_PROJECT_ROADMAP.md). This file is kept for historical reference only. Do not use for current development decisions.

Status: Complete through Phase 26; Phase 29 active. See docs/27_PROJECT_ROADMAP.md for current roadmap.
Document type: agent-ready implementation checklist
Scope: phases 0 through 18, dependencies, gates, and forbidden shortcuts. Phases 19–30 defined in docs/27_PROJECT_ROADMAP.md

## 1. Purpose

This document defines the required implementation order for `agent-workbench`.

Future agents must follow this phase order. Do not skip ahead to later-phase implementation unless the current phase explicitly allows it.

## 2. Phase List

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
Phase 13 Pre-run planner
Phase 14A Automated tests
Phase 14B Hardening
Phase 15 Provider integration (complete)
Phase 16 Streaming responses (complete)
Phase 17 CI/CD + E2E validation (complete)
Phase 18 Mobile web companion UI (active)
```

## 3. Phase 0 — Planning Docs

### Purpose

Create agent-ready documentation only.

### Required Outputs

```text
README.md
docs/00_PROJECT_INTENT.md
docs/01_TECH_STACK_DECISION.md
docs/02_ARCHITECTURE.md
docs/03_BACKEND_FRONTEND_BOUNDARY.md
docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md
docs/05_PERMISSION_MODEL.md
docs/06_SECURITY_MODEL.md
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

### Forbidden

```text
package.json
bun.lock
apps/
packages/
src/
tests/
scripts/
runtime code
placeholder implementation files
```

### Exit Gate

```text
[ ] All Phase 0 docs exist.
[ ] All decisions are captured as ADRs.
[ ] No functional files exist.
[ ] Phase 1 scaffold is fully documented.
```

## 4. Phase 1 — Workspace Scaffold

### Purpose

Create the monorepo structure.

### Required Outputs

```text
apps/cli
apps/server
apps/tui
packages/protocol
packages/sdk
packages/core
packages/events
packages/storage
packages/config
packages/permissions
packages/tools
packages/models
packages/shell
packages/diff
packages/tokens
packages/cache
packages/planner
packages/ui
```

### Requirements

```text
[ ] Create root package management files.
[ ] Create TypeScript config.
[ ] Create package boundaries.
[ ] Create empty package shells only as needed.
[ ] Add boundary-checking approach.
```

### Exit Gate

```text
[ ] No package has overlapping ownership.
[ ] TUI cannot import forbidden packages.
[ ] Core remains UI-agnostic.
[ ] Server remains route/control-plane focused.
```

## 5. Phase 2 — Protocol Contract

### Purpose

Define schemas before implementation.

### Required Outputs

```text
packages/protocol/src/schemas/*
packages/protocol/src/routes/*
packages/protocol/src/openapi/*
packages/sdk contract plan
```

### Requirements

```text
[ ] Define session schema.
[ ] Define message schema.
[ ] Define tool call schema.
[ ] Define tool result schema.
[ ] Define permission request schema.
[ ] Define permission decision schema.
[ ] Define event schema.
[ ] Define error envelope schema.
[ ] Define config schema.
[ ] Define token-health schema.
```

### Exit Gate

```text
[ ] Zod schemas exist before route handlers.
[ ] OpenAPI generation path exists.
[ ] SDK generation or typed SDK plan exists.
[ ] Errors use one envelope format.
```

## 6. Phase 3 — Local Server

### Purpose

Build local control plane.

### Requirements

```text
[ ] Create Hono app.
[ ] Bind localhost by default.
[ ] Add health route.
[ ] Add SSE event route.
[ ] Add session route placeholders backed by protocol.
[ ] Add config/provider/file/permission/tool/TUI/auth route groups.
[ ] Add structured error middleware.
[ ] Add request ID middleware.
[ ] Add localhost-only middleware.
```

### Exit Gate

```text
[ ] Server can run without TUI.
[ ] Server validates requests.
[ ] Server exposes event stream.
[ ] Server does not own core runtime internals.
```

## 7. Phase 4 — TUI Shell

### Purpose

Build terminal shell without agent logic.

### Requirements

```text
[ ] Initialize OpenTUI + SolidJS app.
[ ] Render chat-first layout.
[ ] Add message timeline.
[ ] Add prompt editor.
[ ] Add status bar.
[ ] Add session sidebar.
[ ] Add command palette.
[ ] Add permission modal placeholder.
[ ] Add diff viewer placeholder.
[ ] Add run ledger panel placeholder.
[ ] Add token-health panel placeholder.
[ ] Connect to server through SDK.
[ ] Subscribe to SSE events.
```

### Exit Gate

```text
[ ] TUI renders without core runtime.
[ ] TUI connects to local server.
[ ] TUI can submit prompt request.
[ ] TUI does not execute tools.
[ ] TUI does not access storage directly.
```

## 8. Phase 5 — Storage

### Purpose

Add local durable state.

### Requirements

```text
[ ] Define SQLite path policy.
[ ] Add Drizzle schema.
[ ] Add sessions table.
[ ] Add messages table.
[ ] Add tool_calls table.
[ ] Add permission_requests table.
[ ] Add permission_decisions table.
[ ] Add run_ledger table.
[ ] Add file_changes table.
[ ] Add config_snapshots table.
[ ] Add summaries table.
[ ] Add cache_entries table.
```

### Exit Gate

```text
[ ] Sessions survive restart.
[ ] Messages survive restart.
[ ] Ledger records are queryable.
[ ] Secrets are not stored in plaintext by default.
```

## 9. Phase 6 — Core Runtime

### Purpose

Create session runner and model/tool loop skeleton.

### Requirements

```text
[ ] Create SessionRunner.
[ ] Create ContextBuilder.
[ ] Create ModelRouter.
[ ] Create ToolRegistry integration.
[ ] Create EventPublisher integration.
[ ] Create RunLedger integration.
[ ] Add run abort/cancellation.
[ ] Support prompt → read-only tools → response flow.
```

### Exit Gate

```text
[ ] Core runs without TUI dependency.
[ ] Prompt reaches model path.
[ ] Read-only tool path can be invoked.
[ ] Events stream to server/TUI.
[ ] Runs can be aborted.
```

## 10. Phase 7 — Read-Only Tools

### Purpose

Add safe codebase inspection.

### Required Tools

```text
read
grep
glob
```

### Requirements

```text
[ ] Implement structured tool inputs.
[ ] Implement structured tool results.
[ ] Add result compression.
[ ] Add tool-result truncation hooks.
[ ] Add ledger records.
[ ] Add cache integration.
```

### Exit Gate

```text
[ ] Tools cannot mutate state.
[ ] Large results are compressed.
[ ] Tool calls are visible in TUI.
[ ] Tool calls are recorded in ledger.
```

## 11. Phase 8 — Permission Engine

### Purpose

Centralize safety policy.

### Requirements

```text
[ ] Implement allow.
[ ] Implement ask.
[ ] Implement deny.
[ ] Add tool-level rules.
[ ] Add path-level rules.
[ ] Add command-level rules.
[ ] Add agent-level rules.
[ ] Add permission request events.
[ ] Persist permission decisions.
```

### Exit Gate

```text
[ ] Denied actions cannot execute.
[ ] Ask-gated actions pause runtime.
[ ] TUI can approve/deny but not decide policy.
[ ] Permissions are recorded in ledger.
```

## 12. Phase 9 — File Mutation Tools

### Purpose

Add controlled file changes.

### Required Tools

```text
write
edit
apply_patch
diff_preview
revert_last_change
```

### Requirements

```text
[ ] Use patch-first mutation.
[ ] Create diff preview before apply.
[ ] Require approval by default.
[ ] Record file changes.
[ ] Support dry-run preview.
```

### Exit Gate

```text
[ ] No mutation bypasses permissions.
[ ] No mutation bypasses diff preview.
[ ] Mutations are ledgered.
[ ] Revert path exists where possible.
```

## 13. Phase 10 — Shell Execution

### Purpose

Add controlled command execution.

### Requirements

```text
[ ] Implement simple command runner.
[ ] Add timeout.
[ ] Add abort.
[ ] Add working directory controls.
[ ] Add stdout/stderr streaming.
[ ] Add risk classifier.
[ ] Add command permission evaluation.
[ ] Add dry-run command preview.
[ ] Add PTY design doc only.
```

### Exit Gate

```text
[ ] Shell cannot run without permission check.
[ ] Destructive commands are denied or ask-gated.
[ ] Output streams as events.
[ ] Commands are ledgered.
[ ] Long-running commands can be aborted.
```

## 14. Phase 11 — Agent Modes

### Purpose

Add primary agent modes.

### Required Agents

```text
Build
Plan
```

### Requirements

```text
[ ] Define Build agent.
[ ] Define Plan agent.
[ ] Add agent selector in TUI.
[ ] Add agent-specific permissions.
[ ] Store prompts as versioned config.
[ ] Do not add subagents yet.
```

### Exit Gate

```text
[ ] Build and Plan are selectable.
[ ] Agent permissions are explicit.
[ ] No subagent delegation exists.
[ ] Agents cannot bypass permissions.
```

## 15. Phase 12 — Token Health

### Purpose

Keep long sessions usable.

### Requirements

```text
[ ] Add context budget calculator.
[ ] Add tool-output truncation.
[ ] Add session summarization.
[ ] Add compaction suggestions.
[ ] Add relevance ranking.
[ ] Add token-health panel.
[ ] Add user-approved compaction.
```

### Exit Gate

```text
[ ] Token-health status is visible.
[ ] Oversized tool outputs are controlled.
[ ] Compaction is suggested, not hidden.
[ ] Important facts are preserved in summaries.
```

## 16. Phase 13 — Pre-Run Planner

### Purpose

Require execution plans before mutation and risky operations.

### Requirements

```text
[ ] Create plan data structures and validation.
[ ] Implement plan gate enforcement.
[ ] Integrate plan permission evaluation.
[ ] Add plan event emission.
[ ] Add plan ledger records.
[ ] TUI displays plan summaries and risk indicators.
```

### Exit Gate

```text
[ ] Plans identify target files and risky steps.
[ ] Plans cannot bypass permissions, diff preview, or dry-run.
[ ] Plans cannot execute tools directly.
[ ] Risky plans require approval according to policy.
[ ] Plan events are recorded in ledger.
```

## 17. Phase 14A — Automated Tests

### Purpose

Add comprehensive automated test coverage for all implemented systems.

### Requirements

```text
[ ] Add unit tests for protocol, permissions, tools, tokens, planner, cache, diff packages.
[ ] Add integration tests for core runtime, storage, shell, diff, SDK/transport.
[ ] Add e2e tests for server health, session lifecycle, TUI boundary, localhost security.
[ ] Cover session runner, plan gate enforcement, tool dispatch, permission engine.
[ ] Cover token budgets, path safety, diff preview, shell deny.
[ ] Use mock model providers only. No real external provider calls.
[ ] Use temp directories and temp databases for isolated test runs.
```

### Exit Gate

```text
[ ] All implemented phases have test coverage.
[ ] Unit, integration, and e2e test suites pass.
[ ] No tests depend on real model providers.
[ ] No tests depend on external network access.
[ ] Tests are deterministic and isolated.
```

## 18. Phase 14B — Hardening

### Purpose

Harden test coverage with regression, security, fault injection, and contract tests.

### Requirements

```text
[ ] Add regression test coverage for session-runner, plan gate, tool interaction paths.
[ ] Add security test coverage for path safety, shell deny, plan-gate enforcement.
[ ] Add fault injection tests for model faults, tool faults, abort scenarios.
[ ] Add contract tests for SDK/transport, API error envelopes, protocol/Zod schemas.
[ ] Add manual intentional-break verification procedures.
[ ] All tests use mock providers and temp resources.
```

### Exit Gate

```text
[ ] Regression tests pass.
[ ] Security tests pass.
[ ] Fault injection tests pass.
[ ] Contract tests pass.
[ ] Intentional-break procedures verify test detection.
[ ] Test-repeat passes at default 3 runs.
[ ] Test-health passes all static checks.
```

## 19. Phase 15 — Provider Integration (Complete)

### Purpose

Add a minimal OpenAI-compatible provider adapter behind the existing ModelProvider interface.

### Requirements

```text
[x] One minimal OpenAI-compatible provider adapter (OpenAICompatibleProvider).
[x] Provider configuration from environment variables only (AGENT_WORKBENCH_PROVIDER, OPENAI_API_KEY, OPENAI_BASE_URL).
[x] Provider registry/factory for server wiring.
[x] Real provider route handlers (GET /provider, GET /provider/:providerId, GET /provider/:providerId/model).
[x] Provider error normalization (auth, rate-limit, server, response errors).
[x] Secret redaction (API keys, Authorization headers, Bearer tokens).
[x] Offline tests with fake fetch/mock HTTP only.
[x] No streaming, no provider-specific TUI, no broad provider matrix.
[x] Default tests remain offline and do not require real API keys.
[x] Must not alter tested safety boundaries.
[x] Must not bypass permission enforcement, tool gates, planner gates, or previews.
```

## 20. Phase 16 — Streaming Provider Responses (Complete)

### Purpose

Add streaming model responses from the provider through the existing event architecture to the TUI.

### Requirements

```text
|[x] ModelStreamChunk type defined in packages/models.
|[x] ModelProvider.stream() interface defined with fallback for non-streaming providers.
|[x] StubModelProvider.stream() emits fake chunks for offline testing.
|[x] OpenAICompatibleProvider.stream() parses real SSE chunks with stream:true.
|[x] ModelRouter.routeStream() wraps provider.stream() with message mapping.
|[x] Streaming event schemas (model.stream_delta, .stream_complete, .stream_error) in protocol.
|[x] SessionRunner emits deltas as events, buffers for final message, persists only on completion.
|[x] SessionRunner falls back to call() for providers without stream().
|[x] SDK EventsResource exposes onStreamDelta/onStreamComplete.
|[x] TUI assistant message rendering appends deltas incrementally.
|[x] Streaming flag added to provider model metadata.
|[x] Streaming tests with mock provider: unit, integration, e2e.
|[x] No streaming for tool calls (tool-call responses remain atomic).
|[x] Stream error events are redacted (same rules as Phase 15).
|[x] AbortSignal mid-stream produces clean error event.
```

### Exit Gate

```text
|[x] Streaming works end-to-end: provider SSE → ModelRouter → SessionRunner → EventPublisher → server SSE → SDK → TUI.
|[x] Stub and OpenAI provider both support streaming.
|[x] Non-streaming providers continue to work unchanged (fallback path).
|[x] Tool-call responses remain non-streaming.
|[x] Only final complete messages are persisted — deltas are ephemeral.
|[x] TUI renders streaming text incrementally without tool/policy/storage authority.
|[x] Stream errors are redacted.
|[x] All existing tests pass.
|[x] Test-health passes all static checks.
|[x] git diff --check is clean.
```

## 21. Cross-Phase Rules

Do not:

```text
[ ] Implement code in Phase 0.
[ ] Implement routes before schemas.
[ ] Implement TUI execution logic.
[ ] Implement mutation before permissions.
[ ] Implement shell before permissions.
[ ] Implement subagents before Build/Plan.
[ ] Implement automatic compaction without visibility.
```

## 22. Phase Completion Status

| Phase | Name | Status |
|---:|---|---|
| 0 | Planning Docs | Complete |
| 1 | Workspace Scaffold | Complete |
| 2 | Protocol Contract | Complete |
| 3 | Local Server | Complete |
| 4 | TUI Shell | Complete |
| 5 | Storage | Complete |
| 6 | Core Runtime | Complete |
| 7 | Read-Only Tools | Complete |
| 8 | Permission Engine | Complete |
| 9 | File Mutation Tools | Complete |
| 10 | Shell Execution | Complete |
| 11 | Agent Modes | Complete |
| 12 | Token Health | Complete |
| 13 | Pre-Run Planner | Complete |
| 14A | Automated Tests | Complete |
| 14B | Hardening | Complete |
| 15 | Provider Integration | Complete |
| 16 | Streaming Responses | Complete |
| 17 | CI/CD Pipeline & E2E Validation | In Progress |

## 23. Agent Instructions

Future agents must:

1. Identify current phase before acting.
2. Check phase exit gates before moving forward.
3. Refuse to create later-phase files early unless explicitly instructed.
4. Record uncertainty.
5. Avoid hidden implementation assumptions.
6. Preserve the stack and boundaries.

## 23. Validation Checklist

```text
[ ] Every phase has a purpose.
[ ] Every phase has requirements.
[ ] Every phase has an exit gate.
[ ] Phase order is explicit.
[ ] Forbidden shortcuts are listed.
[ ] Current status is clear.
```
