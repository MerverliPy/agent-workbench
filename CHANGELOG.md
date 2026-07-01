# Changelog

All notable changes to agent-workbench are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/) conventions. Phases correspond to the phase-based development workflow defined in `docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md`.

---

## [Phase 17] — 2026-06-30

### Added
- GitHub Actions CI pipeline with 4 jobs: static check, typecheck matrix, test suite, E2E suite
- E2E validation tests covering full server → SDK → mock provider → event stream flow
- Build step (`scripts/build-all.sh`) for workspace packages to resolve from `dist/`

### Fixed
- Missing `streamingMessageId` import in TUI `App.tsx` causing build error
- Build step in CI so workspace packages resolve from `dist/` (not raw source)

---

## [Phase 16] — 2026-06-29

### Added
- `ModelProvider.stream()` interface for streaming model responses
- Streaming implementation in `OpenAICompatibleProvider` (SSE-based delta streaming)
- Streaming `StubModelProvider` for offline/deterministic testing
- Streaming delta routing: provider → ModelRouter → SessionRunner → server SSE → SDK → TUI
- Incremental text rendering in TUI message timeline
- `ModelStreamChunk` type: content delta, usage metadata, stop reason, done flag

### Changed
- `ModelProvider` interface extended with optional `stream()` method
- Server SSE transport updated for streaming model responses
- SDK event handling updated for streaming chunks

---

## [Phase 15] — 2026-06-26

### Added
- `ModelProvider` interface: `ModelRequest`, `ModelResponse`, `ModelMessage`, `ModelToolCall`, `ModelUsage`, `ModelResponseKind`
- `OpenAICompatibleProvider` — OpenAI-compatible API adapter with injectable `fetch`
- `StubModelProvider` for deterministic offline testing
- `ProviderRegistry` — provider registration, lookup, and lifecycle
- `ProviderConfigError`, `ProviderAuthError`, `ProviderRateLimitError`, `ProviderServerError`, `ProviderResponseError`
- `redactApiKey`, `redactAuthorizationHeader`, `redactString`, `redactHeaders`, `redactError` — secret redaction utilities
- `parseProviderConfig` — environment variable configuration parser
- Provider metadata routes: `GET /provider`, `GET /provider/:id`, `GET /provider/:id/model`
- 323 tests (unit + integration + e2e), 0 failures, 961 expect() calls

### Changed
- Server services context updated with `ProviderRegistry` integration
- Provider routes moved from placeholders to real handlers

---

## [Phase 14B] — 2026-06-25

### Added
- Regression hardening tests
- Security regression coverage (path traversal, injection, secret exposure)
- Fault injection tests for model faults, tool faults, abort handling
- Contract tests for protocol schema validation

---

## [Phase 14A] — 2026-06-24

### Added
- Automated test infrastructure: unit, integration, and e2e test directories
- Test fixtures and helper utilities
- Core test coverage for all implemented packages

---

## [Phase 13] — 2026-06-22

### Added
- Pre-run plan validation: `validatePlan`, `computePlanRiskLevel`
- Mutation detection: `hasMutationSteps`, `hasRiskySteps`
- Plan gate enforcement before risky operations
- Plan-related types and validation logic in `packages/planner`

---

## [Phase 12] — 2026-06-20

### Added
- Token counting: `estimateTokens`, `estimateTokensFromLength`, `providerReportedTokens`
- Budget calculation: `calculateBudget` with health levels (healthy/warning/critical)
- Truncation: `truncateToolOutput` with configurable options
- Compaction: `suggestCompaction` for overloaded contexts
- Token health monitoring integration with runtime

---

## [Phase 11] — 2026-06-18

### Added
- Agent mode definitions: `BUILD_AGENT`, `PLAN_AGENT`
- `AgentRegistry` for agent mode registration and lookup
- Agent-level permission rules
- Agent metadata and selection protocol schemas
- Server agent routes

---

## [Phase 10] — 2026-06-16

### Added
- `SimpleCommandRunner` — process spawning, timeout, abort, stdout/stderr capture
- `previewCommand` — static command risk classification and dry-run metadata
- `redactSecrets` — API key and secret redaction in shell output
- Output limits: `MAX_STDOUT_BYTES`, `MAX_STDERR_BYTES`, `DEFAULT_TIMEOUT_MS`, `MAX_TIMEOUT_MS`
- Bash/shell tool definition in `packages/tools`
- Permission gating for shell commands (default: `ask`)

### Security
- No shell command bypasses permission checks
- Destructive commands default to `deny` unless explicitly configured
- Secret values redacted from command output

---

## [Phase 9] — 2026-06-14

### Added
- File mutation tools: write, edit, apply_patch
- Diff preview generation: `generateDiffPreview`, `extractDiffParams`
- Patch application: `applyMutation`, `canApplyPatch`
- Mutation revert: `revertMutation`, `contentHash`
- Path guard: `isSensitivePath`, `assertSafePath`, `toRelativePath`
- Diff preview tool for pre-mutation safety checks

---

## [Phase 8] — 2026-06-12

### Added
- `PermissionEngine` — core evaluation engine with allow/ask/deny
- `PermissionGate` — decision enforcement
- `defaultPolicy` — sensible defaults: read=allow, edit=ask, bash=ask, destructive=deny
- Tool rules, path rules, command rules, agent rules
- Permission request/response protocol schemas

---

## [Phase 7] — 2026-06-10

### Added
- Read-only tools: `read`, `grep`, `glob`
- `ToolRegistry` — central tool registration and execution
- Output compression: `truncateLines`, `truncateItems`
- Read/search cache infrastructure (`packages/cache`)

---

## [Phase 6] — 2026-06-08

### Added
- `SessionRunner` — session lifecycle and message loop
- `ContextBuilder` — context assembly for model calls
- `ModelRouter` — model request routing
- `ToolCallDispatcher` — tool dispatch orchestration
- `RunLedger` — append-only audit trail
- `EventPublisher` — internal event publishing

---

## [Phase 5] — 2026-06-06

### Added
- SQLite/Drizzle schema with 10 tables
- `SessionRepository`, `MessageRepository`, `ToolCallRepository`
- `PermissionRepository`, `PermissionDecisionRepository`
- `LedgerRepository`, `FileChangeRepository`
- `ConfigSnapshotRepository`, `SummaryRepository`, `CacheRepository`
- Migration generation and execution via Drizzle Kit
- ULID primary keys, ISO-8601 timestamps, JSON text columns

---

## [Phase 4] — 2026-06-04

### Added
- OpenTUI + SolidJS chat shell with 5-region layout
- Server connection via SDK health check
- SSE event subscription with display routing
- Message submission via SDK
- Command palette (Ctrl+P)
- Key bindings: Enter (newline), Ctrl+Enter (submit), Ctrl+C (exit)
- Placeholder panels for permissions, diff, ledger, token health
- Graceful 501 handling for unimplemented server routes

---

## [Phase 3] — 2026-06-02

### Added
- Hono app with route registration and middleware
- Request validation from protocol schemas
- Structured `ErrorEnvelope` responses
- Localhost-only default binding
- SSE transport plumbing
- Placeholder routes for future phases
- Request ID middleware

---

## [Phase 2] — 2026-06-01

### Added
- Zod schemas for all data shapes
- Route contract definitions (session, message, provider, tool, file, permission, etc.)
- Error envelope types
- Event envelope types
- OpenAPI metadata generation

---

## [Phase 1] — 2026-05-30

### Added
- Bun monorepo scaffold with workspaces
- 16 package directories + 3 app directories
- `tsconfig.base.json` with strict TypeScript
- Biome configuration
- `.env.example` with provider documentation
- Phase validation and manifest docs
- Build and test infrastructure

---

## [Phase 0] — 2026-05-28

### Added
- Planning documentation (docs/00 through docs/19)
- Architecture Decision Records (decisions/0001 through decisions/0015)
- Project intent, tech stack, architecture, and boundary docs
- Permission model, security model, data model plans
- Phase exit gates and implementation checklist
