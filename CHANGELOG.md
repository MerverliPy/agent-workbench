# Changelog

All notable changes to agent-workbench are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/) conventions. Phases correspond to the phase-based development workflow defined in `docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md`.

---

## [Phase 26] — 2026-07-02

### Added
- **Plugin SDK** (`packages/plugin-sdk`): typed interfaces for tool, provider, panel, and hook extension points
- `PluginManifest` schema with permission declarations (filesystemRead, filesystemWrite, network, subprocess)
- `PluginRegistry` — install, enable, disable, uninstall lifecycle management
- `PluginLoader` — dynamic import and registration of tool, provider, hook, and panel plugins
- `validatePluginPermissions` — sandbox permission validation with `AGENT_WORKBENCH_UNSAFE_PLUGINS` env toggle
- Server plugin routes: `GET/POST /plugins`, `POST /plugins/:name/enable|disable`, `DELETE /plugins/:name`
- Plugin install from local paths with manifest validation and duplicate detection
- `providerRegistry.registerPluginProvider()` — public API for plugin provider registration
- **CLI** (`apps/cli`): `agent-workbench plugin list|install|enable|disable|uninstall` commands
- 26 new tests for plugin registry, loader, routes, and sandbox validation
- Total test suite: 523 tests, 0 failures

### Changed
- `ProviderRegistry` now exposes `registerPluginProvider` for plugin-based provider registration
- `PluginManifest` schema extended with optional `permissions` field
- Server startup now calls `loadAllPlugins()` to load enabled plugins at boot

---

## [Phase 25] — 2026-07-01

### Added
- **Telemetry** (`packages/telemetry`): Tracer, MetricsExporter, ErrorReporter, RequestLogger
- OpenTelemetry-style tracing with parent-child span relationships
- Prometheus-compatible `/metrics` endpoint with counters, gauges, and latency histograms
- Error reporting with session context (trace ID, session ID, run ID)
- `/observability/spans`, `/observability/errors`, `/observability/tracer`, `/observability/dashboard` endpoints
- **Dashboard** (`apps/dashboard`): SolidJS + Tailwind with sessions overview, latency table, cost trends, auto-refresh
- `/health/detailed` endpoint with provider health status and p50/p95 latency
- Configurable log levels (debug/info/warn/error)
- 59 unit tests for telemetry modules

---

## [Phase 24] — 2026-06-30

### Added
- **Provider marketplace** (`packages/models`): browse, add, remove, configure provider profiles
- Custom provider profiles stored in `~/.agent-workbench/providers/`
- API keys stored in separate `.key` files (0o600, never in profile JSON)
- **Smart router**: task classification, provider scoring with tier priority, category match, cost efficiency
- **Cost tracking**: per-message, per-session, per-day cost estimates
- **Provider health monitoring**: latency percentiles, error rates, automatic failover
- Provider priority tiers: preferred → fallback → emergency
- Rate limit detection via health probe error tracking
- Marketplace CRUD routes: `GET/POST/PATCH/DELETE /marketplace/providers/:id`
- 22 integration tests for marketplace routes and smart router classification

---

## [Phase 23] — 2026-06-29

### Added
- **PTY shell execution** (`packages/shell`): `PtyCommandRunner` for full pseudo-terminal support
- Interactive program support: vim, nano, git rebase -i, Python REPL, node REPL
- PTY shell tool (`packages/tools`) integrated with permission engine
- Output buffer with scrollback for terminal output
- PTY orchestration in core runtime for lifecycle management
- Session-scoped PTY: each session gets its own terminal

---

## [Phase 22] — 2026-06-28

### Added
- **Multi-session support**: run multiple sessions side-by-side across different projects
- **Workspace management**: create, list, update, delete workspaces; assign sessions to workspaces
- Session groups with tag-based grouping
- Bulk session operations: archive, delete, export
- `WorkspaceRepository` with full CRUD and workspace-session associations
- Server routes for workspace CRUD and session-to-workspace assignment

---

## [Phase 21] — 2026-06-27

### Added
- **TUI polish**: command palette (Ctrl+K), multiline prompt editor, syntax highlighting for code blocks
- Agent mode switcher in header (build ↔ plan)
- Configurable color themes (light/dark/high-contrast)
- Keyboard shortcut reference (Ctrl+/)
- Session rename from TUI
- Expand/collapse tool call results

---

## [Phase 20B] — 2026-06-26

### Added
- **Mobile web chat panel**: real model response streaming with typing indicator
- Markdown rendering in message bubbles (bold, italic, code blocks, lists)
- Send-on-Enter with Shift+Enter for newline
- Stream indicator animation during model response
- Permission prompt as browser notification when tab is backgrounded
- Error state rendering: network failure, timeout, provider error
- Empty state: "No messages yet" with suggested prompts

---

## [Phase 20A] — 2026-06-25

### Added
- **Mobile web non-chat panels**: file browser with real server directory contents
- Git tree panel: branch name, dirty file count, recent commits
- Settings panel: saveable server URL, connected provider display, theme toggle
- Service worker caches app shell for offline load
- **PWA**: complete manifest with 192×192 and 512×512 icons
- Touch-optimized: all interactive elements ≥ 44×44px
- Swipe gesture on navigation drawer
- Dark/light/system theme toggle persisted to localStorage
- Offline banner via existing offline detection

---

## [Phase 19] — 2026-06-24

### Added
- **Live provider adapters**: OpenAI, Anthropic, OpenRouter, Ollama
- Provider auto-detection from `AGENT_WORKBENCH_PROVIDER` env var
- Fallback chain: primary → secondary if unavailable
- Streaming token support in all provider adapters
- Tool call parsing from OpenAI/Anthropic tool-use responses
- Rate limiting per provider (tokens-per-minute)
- Token counting per provider (tiktoken for OpenAI, claude-tokenizer for Anthropic)
- Credential redaction in logs (no API keys leaked)
- Provider configuration via `.env` with `PROVIDER_ENV_MAP`

---

## [Phase 18] — 2026-06-23

### Added
- **Mobile web companion UI** (`apps/mobile-web`): SolidJS + Vite + Tailwind scaffold
- 7-panel navigation drawer: Sessions, Chat, FileBrowser, GitTree, ActivityLog, Help, Settings
- SDK client connected via WorkbenchClient
- SSE event stream with exponential backoff reconnection logic
- Permission prompt modal for tool execution approval
- StatusBar with connection indicator
- ErrorBoundary component with graceful degradation
- LoadingSkeleton components for all panels
- Offline detection via browser online/offline events
- PWA scaffold with app icons

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
