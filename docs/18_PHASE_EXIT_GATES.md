# 18 — Phase Exit Gates

> **⚠️ DEPRECATED — July 2026.** This document tracks exit gates for phases 0–18 only and is 9+ phases behind reality (current: Phase 29). The authoritative source is [`docs/27_PROJECT_ROADMAP.md`](./27_PROJECT_ROADMAP.md). This file is kept for historical reference only. Do not use for current development decisions.

Status: Phase 17 complete; Phase 18 active (mobile web companion UI)
Document type: agent-ready phase gate checklist
Scope: required completion criteria before moving between phases

## 1. Purpose

This document defines the exit gates for each implementation phase.

A phase is not complete until its exit gate is satisfied. Future agents must not advance phases by assumption.

## 2. Gate Policy

Rules:

```text
[ ] Each phase must satisfy its own exit gate.
[ ] Later-phase work must not be started early.
[ ] Exceptions require explicit user confirmation.
[ ] Unresolved questions must be marked before moving forward.
[ ] Safety gates are mandatory.
```

## 3. Phase 0 Exit Gate — Planning Docs

Phase 0 is complete only when:

```text
[ ] README.md exists.
[ ] docs/00_PROJECT_INTENT.md exists.
[ ] docs/01_TECH_STACK_DECISION.md exists.
[ ] docs/02_ARCHITECTURE.md exists.
[ ] docs/03_BACKEND_FRONTEND_BOUNDARY.md exists.
[ ] docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md exists.
[ ] docs/05_PERMISSION_MODEL.md exists.
[ ] docs/06_SECURITY_MODEL.md exists.
[ ] docs/07_API_CONTRACT_PLAN.md exists.
[ ] docs/08_DATA_MODEL_PLAN.md exists.
[ ] docs/09_AGENT_MODEL.md exists.
[ ] docs/10_TOOL_RUNTIME_MODEL.md exists.
[ ] docs/11_TOKEN_HEALTH_MODEL.md exists.
[ ] docs/12_TUI_UX_MODEL.md exists.
[ ] docs/13_RUN_LEDGER_MODEL.md exists.
[ ] docs/14_DRY_RUN_MODEL.md exists.
[ ] docs/15_CACHE_MODEL.md exists.
[ ] docs/16_TESTING_STRATEGY.md exists.
[ ] docs/17_RISK_REGISTER.md exists.
[ ] docs/18_PHASE_EXIT_GATES.md exists.
[ ] docs/19_TARGET_REPO_TREE.md exists.
[ ] decisions/0001 through decisions/0015 exist.
[ ] No package.json exists.
[ ] No apps/ folder exists.
[ ] No packages/ folder exists.
[ ] No src/ folder exists.
[ ] No tests/ folder exists.
[ ] No scripts/ folder exists.
```

## 4. Phase 1 Exit Gate — Workspace Scaffold

Phase 1 is complete only when:

```text
[ ] Root package management files exist.
[ ] TypeScript config exists.
[ ] apps/cli exists.
[ ] apps/server exists.
[ ] apps/tui exists.
[ ] Required packages exist.
[ ] Package ownership is documented in repo.
[ ] Boundary enforcement approach exists.
[ ] No package has overlapping ownership.
[ ] TUI cannot import forbidden packages.
```

## 5. Phase 2 Exit Gate — Protocol Contract

Phase 2 is complete only when:

```text
[ ] Core Zod schemas exist.
[ ] Route contracts exist.
[ ] Error envelope exists.
[ ] Event envelope exists.
[ ] OpenAPI generation path exists.
[ ] SDK generation or typed SDK path exists.
[ ] Request/response validation strategy exists.
[ ] TUI/server do not maintain divergent API types.
```

## 6. Phase 3 Exit Gate — Local Server

Phase 3 is complete only when:

```text
[ ] Hono server starts.
[ ] Server binds localhost by default.
[ ] Health route works.
[ ] SSE event route works.
[ ] Request validation middleware exists.
[ ] Error envelope middleware exists.
[ ] Localhost-only protection exists.
[ ] Server can run without TUI.
[ ] Server does not own core runtime internals.
```

## 7. Phase 4 Exit Gate — TUI Shell

Phase 4 is complete only when:

```text
[ ] TUI starts.
[ ] OpenTUI + SolidJS render shell.
[ ] Chat-first layout exists.
[ ] Prompt editor exists.
[ ] Status bar exists.
[ ] Command palette exists.
[ ] TUI connects through SDK.
[ ] TUI subscribes to SSE.
[ ] Permission modal placeholder exists.
[ ] Diff viewer placeholder exists.
[ ] Ledger panel placeholder exists.
[ ] Token-health panel placeholder exists.
[ ] TUI does not execute tools.
[ ] TUI does not access storage directly.
```

## 8. Phase 5 Exit Gate — Storage

Phase 5 is complete only when:

```text
[ ] SQLite connection exists.
[ ] Drizzle schema exists.
[ ] Migration path exists.
[ ] sessions table exists.
[ ] messages table exists.
[ ] tool_calls table exists.
[ ] permission_requests table exists.
[ ] permission_decisions table exists.
[ ] run_ledger table exists.
[ ] file_changes table exists.
[ ] config_snapshots table exists.
[ ] summaries table exists.
[ ] cache_entries table exists.
[ ] Repository layer exists.
[ ] Secrets are not stored in plaintext by default.
```

## 9. Phase 6 Exit Gate — Core Runtime

Phase 6 is complete only when:

```text
[ ] SessionRunner exists.
[ ] ContextBuilder exists.
[ ] ModelRouter exists.
[ ] ToolRegistry integration exists.
[ ] EventPublisher integration exists.
[ ] RunLedger integration exists.
[ ] Prompt can produce assistant response.
[ ] Read-only tool path is supported.
[ ] Run cancellation works.
[ ] Core has no TUI dependency.
```

## 10. Phase 7 Exit Gate — Read-Only Tools

Phase 7 is complete only when:

```text
[ ] read tool exists.
[ ] grep tool exists.
[ ] glob tool exists.
[ ] Tool inputs are schema-validated.
[ ] Tool results are structured.
[ ] Large results are compressed.
[ ] Sensitive paths are respected.
[ ] Tool calls are ledgered.
[ ] Tools cannot mutate project state.
```

## 11. Phase 8 Exit Gate — Permission Engine

Phase 8 is complete only when:

```text
[ ] PermissionEngine exists.
[ ] allow works.
[ ] ask works.
[ ] deny works.
[ ] Tool-level rules exist.
[ ] Path-level rules exist.
[ ] Command-level rules exist.
[ ] Agent-level rules exist.
[ ] Ask-gated actions pause runtime.
[ ] Denied actions do not execute.
[ ] Permission decisions persist.
[ ] Permission events emit.
[ ] TUI can approve/deny requests.
[ ] TUI cannot decide policy.
```

## 12. Phase 9 Exit Gate — File Mutation Tools

Phase 9 is complete only when:

```text
[ ] write tool exists.
[ ] edit tool exists.
[ ] apply_patch tool exists.
[ ] diff preview exists.
[ ] dry-run preview exists for file mutation.
[ ] Permission check required for mutation.
[ ] Approval required by default.
[ ] Mutation ledger records exist.
[ ] Revert path exists where possible.
[ ] No mutation bypasses diff preview.
```

## 13. Phase 10 Exit Gate — Shell Execution

Phase 10 is complete only when:

```text
[ ] Simple command runner exists.
[ ] Command parser exists.
[ ] Risk classifier exists.
[ ] Permission check required for bash.
[ ] Timeout works.
[ ] Abort works.
[ ] stdout/stderr stream as events.
[ ] Command output is controlled.
[ ] Shell dry-run/preview exists.
[ ] Commands are ledgered.
[ ] Destructive commands deny by default.
[ ] PTY remains design-only unless explicitly approved.
```

## 14. Phase 11 Exit Gate — Agent Modes

Phase 11 is complete only when:

```text
[ ] Build agent exists.
[ ] Plan agent exists.
[ ] Agent definitions are versioned or version-ready.
[ ] Agent selector exists in TUI.
[ ] Core applies selected agent.
[ ] Permission engine applies agent profile.
[ ] Agent choice is recorded.
[ ] No subagents are implemented.
```

## 15. Phase 12 Exit Gate — Token Health

Phase 12 is complete only when:

```text
[ ] Context budget calculator exists.
[ ] Tool-output truncation exists.
[ ] Session summarization exists.
[ ] Compaction suggestion exists.
[ ] User approval required for compaction by default.
[ ] Relevance ranking exists or is explicitly scoped.
[ ] Token-health status emits events.
[ ] Token-health panel renders state.
[ ] Summaries persist.
[ ] Token estimates are clearly marked as estimates when applicable.
```

## 16. Phase 13 Exit Gate — Pre-Run Planner

Phase 13 is complete only when:

```text
[ ] Plan data structures and validation exist.
[ ] Plan gate enforcement exists.
[ ] Plans identify target files and risky steps.
[ ] Plans cannot bypass permissions, diff preview, or dry-run.
[ ] Plans cannot execute tools directly.
[ ] Risky plans require approval according to policy.
[ ] Plan events are recorded in ledger.
[ ] TUI displays plan summaries and risk indicators without owning plan logic.
```

## 17. Phase 14A Exit Gate — Automated Tests

Phase 14A is complete only when:

```text
[ ] Unit tests exist for protocol, permissions, tools, tokens, planner, cache, diff.
[ ] Integration tests exist for core runtime, storage, shell, diff, SDK/transport.
[ ] E2E tests exist for server health, session lifecycle, TUI boundary, localhost security.
[ ] Tests cover session runner, plan gate enforcement, tool dispatch, permission engine.
[ ] Tests cover token budgets, path safety, diff preview, shell deny.
[ ] All tests use mock model providers only.
[ ] All tests use temp directories and databases for isolation.
[ ] Test suites pass deterministically.
```

## 18. Phase 14B Exit Gate — Hardening

Phase 14B is complete only when:

```text
[ ] Regression tests exist and pass for session-runner, plan gate, tool interaction paths.
[ ] Security tests exist and pass for path safety, shell deny, plan-gate enforcement.
[ ] Fault injection tests exist and pass for model faults, tool faults, abort scenarios.
[ ] Contract tests exist and pass for SDK/transport, API error envelopes, protocol/Zod schemas.
[ ] Manual intentional-break verification procedures are documented.
[ ] All tests use mock providers and temp resources.
[ ] Test-repeat passes at default 3 runs.
[ ] Test-health passes all static checks.
```

## 19. Phase 15 Exit Gate — Provider Integration

Phase 15 is complete only when:

```text
[x] OpenAI-compatible provider adapter implements ModelProvider interface.
[x] Provider adapter maps text responses correctly.
[x] Provider adapter maps tool calls correctly.
[x] Provider adapter normalizes usage fields when present.
[x] Provider adapter handles HTTP auth errors safely.
[x] Provider adapter handles HTTP rate-limit/server errors safely.
[x] Provider adapter handles malformed provider JSON safely.
[x] Provider adapter handles abort signals.
[x] Provider adapter redacts API keys and Authorization headers from all exposed errors.
[x] Provider configuration is parsed from environment variables only.
[x] Missing API key/config produces safe, recoverable configuration errors.
[x] Config parsing does not log or expose secret values.
[x] Provider registry provides metadata for provider routes.
[x] GET /provider returns schema-valid provider list.
[x] GET /provider/:providerId returns provider metadata or structured not-found error.
[x] GET /provider/:providerId/model returns model list or structured not-found error.
[x] Provider routes do not expose secrets.
[x] StubModelProvider and all test mock providers continue to work unchanged.
[x] All provider tests use fake fetch/mock HTTP only.
[x] No tests require OPENAI_API_KEY or network access.
[x] Existing Phase 14B fault/contract tests continue to pass.
[x] Test-health passes all static checks.
[x] Test-repeat passes all 3 runs.
[x] git diff --check is clean.
[x] No streaming, no provider-specific TUI, no broad provider matrix.
```

## 20. Phase 16 Exit Gate — Streaming Provider Responses (Complete)

Phase 16 is complete — all exit gates satisfied:

```text
[x] Streaming works end-to-end: provider SSE → ModelRouter → SessionRunner → EventPublisher → server SSE → SDK → TUI.
[x] Stub and OpenAI provider both support streaming.
[x] Non-streaming providers continue to work unchanged (fallback path).
[x] Tool-call responses remain non-streaming.
[x] Only final complete messages are persisted — deltas are ephemeral.
[x] TUI renders streaming text incrementally without tool/policy/storage authority.
[x] Stream errors are redacted.
[x] All existing tests pass (346 pass, 0 fail).
[x] Test-health passes all static checks.
[x] git diff --check is clean.
```

## 21. Phase 17 Exit Gate — CI/CD Pipeline & End-to-End Validation (Complete)

Phase 17 is complete — all exit gates satisfied:

```text
[x] GitHub Actions CI pipeline runs on every push and PR to main.
[x] Pipeline runs `bun test` — all tests must pass.
[x] Pipeline runs `bash scripts/test-health.sh` — all static checks must pass.
[x] Pipeline runs `bun run typecheck` in every workspace package.
[x] Pipeline runs `git diff --check` — no whitespace errors.
[x] Pipeline reports pass/fail status on PRs via commit status checks.
[x] End-to-end validation test exists covering the full stack:
     server startup → provider route → SDK client → session lifecycle → model response (mock) → event stream → shutdown.
[x] End-to-end streaming test exists: TUI (headless) receives `model.stream_delta/completed` events through the full event chain.
[x] CI job fast-fails on lint/type errors (within 30 seconds).
[x] CI completes within 5 minutes for the full suite.
[x] Verified: 357 tests pass, 0 failures, 1072 expect() calls across 31 files.
[x] Verified: 54 E2E tests pass, 0 failures, 189 expect() calls across 8 files.
[x] Verified: test-health passes all static checks.
```

## 22. Cross-Phase Blockers

These conditions block progress:

```text
[ ] TUI directly executes tools.
[ ] Shell exists before permission engine.
[ ] File mutation exists before diff preview.
[ ] Server binds to non-localhost by default.
[ ] Secrets are stored in plaintext.
[ ] API routes exist without schemas.
[ ] Risky actions are not ledgered.
[ ] Phase 0 contains implementation files.
```

## 23. Phase Advancement Checklist

Before starting a new phase, answer:

```text
[ ] What phase is currently active?
[ ] Is the previous phase exit gate fully satisfied?
[ ] Are unresolved questions documented?
[ ] Are any safety blockers open?
[ ] Does the next phase require user confirmation?
[ ] Will this work create files allowed in the current phase?
```

## 24. Agent Instructions

Future agents must:

1. Check this file before phase transitions.
2. Do not mark phases complete without evidence.
3. Keep safety gates mandatory.
4. Avoid implementing future phases early.
5. Record unresolved issues.
6. Ask only when required; otherwise proceed with documented defaults.

## 25. Validation Checklist

```text
[ ] Every phase has an exit gate.
[ ] Phase 0 restrictions are explicit.
[ ] Safety blockers are explicit.
[ ] Phase advancement checklist exists.
[ ] Future agent instructions are clear.
