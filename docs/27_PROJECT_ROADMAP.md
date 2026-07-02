# 27 — Project Roadmap

Status: Active planning — Phase 18 (mobile web companion UI) in progress
Document type: Roadmap for Phases 19–30
Supersedes: incremental updates in docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md

---

## 1. Roadmap Overview

```
Phase 18 ◀ active  ████████████████████░░  mobile web companion UI
Phase 19 ▌         ██████████████████████  live provider integration
Phase 20A▌         ██████████████████████  mobile web: non-chat panels
Phase 20B▌         ██████████████████████  mobile web: chat + streaming
Phase 21 ▌         ██████████████████████  TUI polish & UX completion
Phase 22 ▌         ██████████████████████  multi-session & workspace mgmt
Phase 23 ▌         ██████████████████████  PTY terminal execution
Phase 24 ██ active ████████████████████░░  provider marketplace & smart routing
Phase 25 ▌         ░░░░░░░░░░░░░░░░░░░░  observability & production readiness
Phase 26 ▌         ░░░░░░░░░░░░░░░░░░░░  plugin system & extensibility
Phase 27 ▌         ░░░░░░░░░░░░░░░░░░░░  remote access & collaboration
Phase 28 ▌         ░░░░░░░░░░░░░░░░░░░░  desktop application (Tauri)
Phase 29 ▌         ░░░░░░░░░░░░░░░░░░░░  model experimentation & eval
Phase 30 ▌         ░░░░░░░░░░░░░░░░░░░░  enterprise readiness & compliance
```

### Timeline

| Wave | Phases | Estimated | Focus |
|------|--------|-----------|-------|
| **Now** | 18 | Active | Mobile web companion |
| **Short-term** | 19–21 | 3–4 weeks | Core feature completion |
| **Medium-term** | 22–25 | 2–3 months | Power user features |
| **Long-term** | 26–30 | 4–6 months | Ecosystem & enterprise |

---

## 2. Phase 18: Mobile Web Companion UI ◀ ACTIVE

### Priority: 🔴 CRITICAL (in progress)
### Dependencies: Phase 17 (CI/CD pipeline)
### Estimated: 1 week remaining (scaffold complete)

### Purpose

Build a lightweight, touch-optimized mobile web app at `apps/mobile-web/` that connects to the same server via the existing SDK — no server or core changes required. See `docs/26_PHASE_18_MOBILE_WEB_UI.md` for the full plan.

### Current State (2026-07-02)

```text
[✅] SolidJS + Vite project scaffolded
[✅] 7-panel navigation drawer (Sessions, Chat, FileBrowser, GitTree, ActivityLog, Help, Settings)
[✅] SDK client connected (WorkbenchClient)
[✅] SSE event stream with reconnection logic
[✅] Permission prompt modal
[✅] StatusBar with connection indicator
[✅] ErrorBoundary component
[✅] Offline detection (online/offline events)
[✅] LoadingSkeleton components
[✅] PWA icons (192x192 + 512x512)
[  ] Chat panel streams real model responses with typing indicator
[  ] File browser shows real directory contents from server
[  ] Git tree shows branch, dirty files, unpushed commits
[  ] Settings panel supports provider selection and theme toggle
[  ] Service worker caches app shell for offline load
[  ] PWA is installable (manifest + service worker)
[  ] Push notification for permission prompts (browser backgrounded)
[  ] Touch-optimized: all buttons ≥ 44×44px, swipe gestures on drawers
[  ] Landscape orientation support
[  ] Dark/light/system theme toggle persists to localStorage
[  ] Offline banner when connection drops (using existing offline.ts)
```

### Exit Gates

```text
[ ] All 7 panels render real data from the server (no hardcoded placeholders)
[ ] Chat panel: user can type a prompt, see streaming response via SDK
[ ] FileBrowser: browses real project directory, previews files
[ ] GitTree: shows branch name, dirty count, recent commits
[ ] PWA manifest + service worker registered → app is installable
[ ] Works on iOS Safari + Android Chrome (minimum: last 2 versions each)
[ ] Permission prompts appear as modal and can be approved/denied
[ ] Loading skeletons on all panels (using existing components)
[ ] Offline detection shows banner (using existing offline.ts)
[ ] All 357+ tests continue to pass
[ ] apps/mobile-web typecheck: tsc --noEmit passes clean
```

### Risks

- **iOS Safari PWA limitations**: No push notifications on iOS (addressed via browser Notification API for desktop + fallback in-app banner on iOS)
- **SSE on mobile browsers**: Some mobile browsers close idle SSE connections aggressively — reconnection logic already implemented with exponential backoff

---

## 3. Phase 19: Live Provider Integration

### Priority: 🔴 CRITICAL
### Dependencies: Phase 17 (CI/CD), Phase 16 (streaming)
### Estimated: 1–2 weeks

### Purpose

Replace the `StubModelProvider` with real LLM provider adapters. The stub returns deterministic text — it's excellent for testing but prevents the agent from performing actual work. This phase makes the tool loop functional end-to-end.

### Required Outputs

```text
packages/models/src/providers/
  ├── openai.ts            # OpenAI-compatible adapter (GPT-4, etc.)
  ├── anthropic.ts         # Anthropic adapter (Claude)
  ├── openrouter.ts        # OpenRouter adapter (multi-provider)
  ├── ollama.ts            # Local Ollama adapter
  └── provider-factory.ts  # Auto-detect from env vars

packages/models/src/provider-config.ts    # Typed config schema
packages/models/src/streaming-adapter.ts  # Standardised streaming interface
tests/integration/
  ├── openai-provider.test.ts
  ├── anthropic-provider.test.ts
  └── provider-fallback.test.ts

.env.example updates:
  AGENT_WORKBENCH_PROVIDER=openai|anthropic|ollama
  OPENAI_API_KEY=
  ANTHROPIC_API_KEY=
  OPENROUTER_API_KEY=
```

### Exit Gates

```text
[ ] OpenAI adapter implements ModelProvider interface (call + stream)
[ ] Anthropic adapter implements ModelProvider interface (call + stream)
[ ] OpenRouter adapter implements ModelProvider interface
[ ] Ollama adapter works against local llama.cpp/ollama
[ ] Provider auto-detection from AGENT_WORKBENCH_PROVIDER env var
[ ] Fallback chain: primary → secondary if unavailable
[ ] Streaming tokens emit model.stream_delta SSE events
[ ] Tool calls are correctly parsed from OpenAI/Anthropic tool-use responses
[ ] Rate limiting per provider (tokens-per-minute)
[ ] Token counting per provider (tiktoken for OpenAI, claude-tokenizer for Anthropic)
[ ] Credential redaction in logs (no API keys leaked)
[ ] All 357+ existing tests continue to pass
```

### Risks

- **API key management**: In a local-first tool, where do keys live?
  - Solution: `.env` + system keychain (macOS Keychain, Linux `secret-tool`, Windows Credential Manager)
- **Token counting accuracy**: Different models use different tokenizers
  - Solution: Best-effort estimation for unknown models; exact for supported ones

---

## 4. Phase 20A: Mobile Web — Non-Chat Panels (FileBrowser, GitTree, Settings, etc.)

### Priority: 🟡 HIGH — can run in PARALLEL with Phase 19
### Dependencies: Phase 18 (mobile-web scaffold), NONE for live providers
### Estimated: 4–5 days

### Purpose

Complete all mobile-web panels that do NOT require a live LLM provider. These six panels can be built and tested against stub/static data, then wired to real APIs once Phase 19 delivers providers. Running this in parallel with Phase 19 eliminates the 1-week blocking dependency.

### Required Outputs

```text
apps/mobile-web/src/components/panels/
  ├── FileBrowserPanel.tsx    # ✅ Functional — verify against real server
  ├── GitTreePanel.tsx        # 🔧 Complete — wire to git status API
  ├── SessionsPanel.tsx       # ✅ Functional — add messageCount from API
  ├── ActivityLogPanel.tsx    # ✅ Functional — verify against real SSE events
  ├── HelpPanel.tsx            # 🔧 Enhance — keyboard shortcuts reference
  ├── SettingsPanel.tsx        # 🔧 Complete — server URL config, provider display

apps/mobile-web/src/
  ├── lib/pwa.ts               # New — service worker registration
  ├── lib/sync.ts              # New — background sync for offline message queue
  └── sw.ts                    # New — service worker for offline caching

Other:
  manifest.json                 # Complete — icons, display mode, screenshots
```

### Exit Gates

```text
[ ] FileBrowser shows real directory contents from server API
[ ] GitTree shows branch name, dirty file count, recent commits
[ ] Settings panel: saveable server URL, displays connected provider
[ ] Service worker caches app shell for offline load
[ ] PWA manifest complete → app is installable (lightbox prompt)
[ ] Touch-optimized: all interactive elements ≥ 44×44px
[ ] Swipe gesture on nav drawer (open/close)
[ ] Dark/light/system theme toggle persists to localStorage
[ ] Loading skeletons on all panels (using existing LoadingSkeleton)
[ ] Offline banner when connection drops (using existing offline.ts)
[ ] All 357+ tests continue to pass
[ ] apps/mobile-web typecheck: tsc --noEmit passes clean
```

### Risks

- **GitTree panel**: Requires a `/tool/git` or git-status endpoint that may not exist yet. Fallback: wrap existing `bash` tool to run `git status --porcelain` and parse output.
- **PWA install prompt**: `BeforeInstallPromptEvent` is Chrome-only. iOS requires user to use "Add to Home Screen" manually. Accept both paths.

---

## 5. Phase 20B: Mobile Web — Chat Panel & Streaming

### Priority: 🟡 HIGH — starts AFTER Phase 19 completes
### Dependencies: Phase 19 (live providers), Phase 20A (PWA infrastructure)
### Estimated: 3–4 days

### Purpose

Complete the chat panel with real model streaming. This is the only mobile-web panel that genuinely depends on a live LLM provider. All other panels were completed in Phase 20A.

### Required Outputs

```text
apps/mobile-web/src/components/
  ├── ChatView.tsx             # 🔧 Already exists — verify streaming works
  ├── MessageBubble.tsx        # 🔧 Already exists — add code block rendering
  ├── PromptInput.tsx          # 🔧 Already exists — add send-on-Enter
  └── StreamingIndicator.tsx   # 🔧 Already exists — verify with real stream

apps/mobile-web/src/lib/
  └── notifications.ts         # New — browser Notification API for perm prompts
```

### Exit Gates

```text
[ ] Chat panel streams real model responses with typing cursor
[ ] Messages render markdown (bold, italic, code blocks, lists)
[ ] Send-on-Enter with Shift+Enter for newline
[ ] Stream indicator animates during model response
[ ] Permission prompt appears as browser notification when tab is backgrounded
[ ] Error state rendering: network failure, timeout, provider error
[ ] Empty state: "No messages yet" with suggested prompts
[ ] All 357+ tests continue to pass
[ ] apps/mobile-web typecheck: tsc --noEmit passes clean
```

### Risks

- **SSE on mobile**: Mobile browsers may throttle background SSE — addressed by the already-implemented exponential backoff reconnection logic.
- **Markdown rendering**: Need a lightweight markdown library that doesn't bloat the bundle. Recommendation: `marked` (19KB gzipped) or hand-roll a simple renderer.

---

## 4. Phase 21: TUI Polish & UX Completion

### Priority: 🟡 HIGH
### Dependencies: Phase 19 (live providers)
### Estimated: 1 week

### Purpose

Polish the terminal UI to rival tools like `claude-code` and `opencode`. Add keyboard shortcuts, color themes, multiline input, and command suggestions.

### Required Outputs

```text
apps/tui/src/
  ├── components/prompt/MultilineEditor.tsx     # Shift+Enter for newlines
  ├── components/session/AgentSwitcher.tsx       # Toggle build/plan modes
  ├── components/messages/CodeBlock.tsx          # Syntax highlighting
  ├── components/messages/ToolCallCard.tsx       # Expand/collapse tool results
  ├── components/panels/ConfigPanel.tsx           # View/edit .env settings
  └── lib/keybindings.ts                         # Centralised shortcut registry

Keyboard shortcuts:
  Ctrl+K          — Focus command palette
  Ctrl+L          — Clear session
  Ctrl+D          — Toggle diff viewer
  Ctrl+/          — Show all shortcuts
  Shift+Enter     — Newline in prompt
```

### Exit Gates

```text
[ ] Command palette (Ctrl+K) fuzzy-searches tools, sessions, actions
[ ] Multiline prompt editor with syntax highlighting for code blocks
[ ] Diff viewer shows +/- with color (green/red via chalk or similar)
[ ] Agent mode switcher in header (build ↔ plan)
[ ] Configurable color theme (light/dark/high-contrast)
[ ] Keyboard shortcut reference (Ctrl+/)
[ ] Session rename from the TUI
[ ] Copy-to-clipboard for code blocks
```

### Risks

- **OpenTUI rendering performance**: SolidJS signals inside a terminal rendering loop can cause flicker if not batched. Use `batch()` for multi-signal updates.
- **ANSI color support**: Terminal emulators vary in color support. Test against kitty, iTerm2, Windows Terminal, and tmux. Fall back to 16-color palette for broad compatibility.
- **Keyboard shortcut conflicts**: Ctrl+K and Ctrl+D are used by many terminal emulators natively. Provide remapping via `~/.agent-workbench/keybindings.json`.

---

## 5. Phase 22: Multi-Session & Workspace Management

### Priority: 🟡 HIGH
### Dependencies: Phase 19
### Estimated: 1 week

### Purpose

Let users run multiple sessions side-by-side (different projects, different agents). Add workspace management — project-level config, session groups, and bulk operations.

### Required Outputs

```text
packages/protocol/src/schemas/
  ├── workspace.ts            # Workspace schema
  └── session-group.ts        # Session group schema

packages/storage/src/
  └── repositories/
      ├── workspace-repository.ts
      └── session-group-repository.ts

apps/server/src/routes/
  ├── workspace-routes.ts
  └── session-group-routes.ts

apps/tui/src/components/session/
  └── SessionSidebar.tsx       # Multi-session tabs/split view
```

### Exit Gates

```text
[ ] Create/list/update/delete workspaces (project-level config containers)
[ ] Assign sessions to workspaces
[ ] Session groups (tag-based grouping)
[ ] Bulk session operations (archive, delete, export)
[ ] Workspace import/export (tar.gz with session history + project files)
[ ] Session export: conversation JSON + project context
[ ] TUI supports switching between sessions without losing state
```

### Risks

- **SQLite concurrent access**: Multiple sessions writing to the same database can hit `SQLITE_BUSY`. Use WAL mode (already enabled) and retry with exponential backoff for write contention.
- **Session state migration**: Swapping sessions in the TUI means swapping the entire `Session` object in-memory. If the TUI has local state (cursor position, scroll offset), it must be preserved per-session — use a `Map<sessionId, SessionState>` pattern.

---

## 6. Phase 23: PTY Terminal Execution

### Priority: 🟡 HIGH
### Dependencies: Phase 10 (simple command runner)
### Estimated: 2 weeks

### Purpose

Upgrade `packages/shell` from `SimpleCommandRunner` (spawn-and-capture) to a full PTY-based terminal with interactive support. This enables `vim`, `git rebase -i`, REPLs, and long-running watchers.

### Required Outputs

```text
packages/shell/src/
  ├── pty-runner.ts            # PTY-based process execution
  ├── pty-output-buffer.ts     # Ring buffer for terminal output
  └── pty-resize.ts            # Handle terminal resize events

packages/tools/src/
  └── tools/pty-shell.ts       # PTY shell tool definition

packages/core/src/
  └── pty-orchestrator.ts      # Core orchestration for PTY lifecycle
```

### Exit Gates

```text
[ ] PTY runner creates pseudo-terminal via node-pty or Bun native
[ ] Interactive programs work (nano, vim, python REPL, node REPL)
[ ] Terminal resize events propagate to child process
[ ] Output buffer with scrollback (last N lines)
[ ] ANSI escape sequence support in TUI output display
[ ] Ctrl+C sends SIGINT to foreground process group
[ ] Session-scoped PTY: each session gets its own terminal
[ ] PTY output is NOT stored in ledger (enormous output — summary only)
[ ] Permission checks apply to PTY (same as bash tool)
```

### Risks

- **Bun PTY support**: Bun's native `Bun.spawn()` does not create pseudo-terminals. Use `node-pty` (native addon) or `Deno.Command` with PTY flag if migrating to Deno. For Bun: wrap `script` command: `/usr/bin/script -qc "command" /dev/null`.
- **Output buffering**: PTY output can be megabytes per second (e.g., `cat` of a large file). Ring buffer with configurable max size (default 1MB) and `circular_buffer` pattern.
- **ANSI state tracking**: The TUI must track terminal state (cursor position, colors, clear screen sequences) to render PTY output correctly. Use a virtual terminal emulator like `xterm-headless` or parse ANSI sequences manually.
- **Permission risk — PTY bypass**: Interactive programs can spawn subprocesses that bypass the permission engine. The PTY tool must inherit the same permission constraints as bash (no bypass). Sandbox with `unshare` or `bubblewrap` on Linux.

---

## 7. Phase 24: Provider Marketplace & Smart Routing ◀ ACTIVE

### Priority: 🔴 CRITICAL (implementation in progress)
### Dependencies: Phase 19
### Estimated: ~95% complete (exit gates need testing & schema integration)

### Purpose

Build a provider marketplace where users can add, configure, and share model configurations. Smart routing selects the best provider based on task complexity, cost, and latency.

### Current State (2026-07-02)

```text
[✅] Provider marketplace: browse, add, remove, configure providers
[✅] Custom provider profiles stored in ~/.agent-workbench/providers/
[✅] API keys stored in separate .key files (0o600, never in profile JSON)
[✅] Smart router selects provider based on task classification
[✅] Task classifier with keyword scoring (read, code_gen, arch_review, summarize)
[✅] Provider scoring with tier priority + category match + cost efficiency
[✅] Cost tracking: per-message, per-session, per-day cost estimates
[✅] Provider health monitoring: latency percentiles, error rates
[✅] Automatic failover fallback chain (preferred → fallback → emergency)
[✅] Provider priority tiers: preferred → fallback → emergency
[✅] Rate limit detection (via health probe error tracking)
[✅] ProviderProfile + CostRecord + CostSummary Zod schemas
[✅] Marketplace CRUD route contracts (list, get, create, update, delete, test)
[✅] Server routes wired: GET/POST/PATCH/DELETE /marketplace/providers/:id
[✅] Provider health monitor periodic checks (every 60s)
[  ] Protocol schema fully integrated into OpenAPI generation
[  ] Integration tests for marketplace CRUD routes
[  ] Integration tests for smart router classification
```

### Required Outputs

```text
packages/models/src/
  ├── marketplace.ts            # Provider marketplace registry
  ├── smart-router.ts           # Task-based routing decision engine
  ├── cost-tracker.ts           # Per-session cost tracking
  └── provider-health.ts        # Health checks + failover logic

packages/protocol/src/schemas/
  └── provider-profile.ts       # Typed provider profile schema

Smart routing rules:
  read/grep/glob       → cheapest model (deepseek-v3-flash)
  code generation       → mid-tier (deepseek-v4-pro, claude-sonnet)
  architecture/review  → strongest (claude-opus, o3)
  summarization        → cheapest (gpt-4o-mini)
```

### Exit Gates

```text
[ ] Provider marketplace: browse, add, remove, configure providers
[ ] Custom provider profiles stored in ~/.agent-workbench/providers/
[ ] Smart router selects provider based on task classification
[ ] Cost tracking: per-message, per-session, per-day cost estimates
[ ] Provider health monitoring: latency percentiles, error rates
[ ] Automatic failover: if primary fails, fall back to secondary
[ ] Provider priority tiers: preferred → fallback → emergency
[ ] Rate limit awareness: back off when rate-limited
```

---

## 8. Phase 25: Observability & Production Readiness

### Priority: 🟡 HIGH
### Dependencies: Phase 24 (provider metrics)
### Estimated: 2 weeks

### Purpose

Make agent-workbench observable and production-grade. Add distributed tracing, alerting, error reporting, and a status dashboard.

### Required Outputs

```text
packages/telemetry/                          # NEW PACKAGE
  ├── src/
  │   ├── index.ts
  │   ├── tracer.ts          # OpenTelemetry spans
  │   ├── metrics-exporter.ts # Prometheus push gateway
  │   ├── error-reporter.ts   # Sentry-compatible
  │   └── request-logger.ts   # Structured request/response logging

apps/server/src/
  └── middleware/
      ├── tracing.ts          # Span creation per request
      └── audit-log.ts        # Audit trail for security events

apps/dashboard/                            # NEW APP
  ├── src/                    # React dashboard (or SolidJS)
  └── README.md

Existing: apps/server/src/utils/metrics.ts → enhanced with histograms
```

### Exit Gates

```text
[ ] OpenTelemetry tracing: spans for model calls, tool execution, permission checks
[ ] Metrics exporter: push to Prometheus/Grafana
[ ] Error reporting with session context (trace ID, session ID, run ID)
[ ] Audit log: immutable record of all security-relevant events
[ ] Dashboard: sessions overview, latency heatmap, cost trends
[ ] Health check includes provider status (connected/degraded/failed)
[ ] Graceful degradation: continue serving if telemetry backend is down
[ ] Configurable log levels (debug/info/warn/error)
```

---

## 9. Phase 26: Plugin System & Extensibility

### Priority: 🟢 MEDIUM
### Dependencies: Phase 19 (providers needed for plugin testing)
### Estimated: 3 weeks

### Purpose

Allow third-party developers to write plugins that extend agent-workbench. Plugins can add tools, providers, TUI panels, and custom middleware.

### Required Outputs

```text
packages/plugin-sdk/                         # NEW PACKAGE
  ├── src/
  │   ├── index.ts            # PluginSDK entry point
  │   ├── tool-plugin.ts      # Tool extension interface
  │   ├── provider-plugin.ts  # Provider extension interface
  │   ├── panel-plugin.ts     # TUI panel extension interface
  │   ├── hook-plugin.ts      # Lifecycle hooks (onSessionStart, etc.)
  │   └── plugin-manifest.ts  # Manifest schema

~/.agent-workbench/plugins/
  ├── plugin.json             # Plugin registry
  └── agent-workbench-github/ # Example: GitHub integration plugin
      ├── plugin.json
      ├── src/tools.ts        # GitHub API tools
      └── src/panels.tsx      # GitHub-specific TUI panels

Plugin lifecycle:
  install  → bunx agent-workbench plugin install <name>
  enable   → bunx agent-workbench plugin enable <name>
  disable  → bunx agent-workbench plugin disable <name>
  update   → bunx agent-workbench plugin update <name>
```

### Exit Gates

```text
[ ] Plugin manifest schema: name, version, tools, providers, panels, hooks
[ ] Plugin SDK exports typed interfaces for each extension point
[ ] Tool plugins: register custom tools via ToolRegistry
[ ] Provider plugins: register custom providers via ProviderRegistry
[ ] Panel plugins: add custom panels to TUI via panel registry
[ ] Hook plugins: lifecycle hooks (onSessionStart, onMessageReceived, etc.)
[ ] Plugin sandboxing: plugins run in isolated context (no filesystem access)
[ ] Plugin marketplace: discover and install plugins from npm/GitHub
[ ] Hot reload: enable/disable plugins without restarting server
```

---

## 10. Phase 27: Remote Access & Collaboration

### Priority: 🟢 MEDIUM
### Dependencies: Phase 22 (workspaces), Phase 25 (observability)
### Estimated: 3 weeks

### Purpose

Make agent-workbench accessible from remote machines and enable team collaboration. TLS-secured remote access, shared sessions, and review workflows.

### Required Outputs

```text
packages/auth/                              # NEW PACKAGE
  ├── src/
  │   ├── index.ts
  │   ├── auth-middleware.ts   # Bearer token authentication
  │   ├── tls-config.ts        # Self-signed cert generation
  │   └── session-tokens.ts    # Time-limited session tokens

apps/server/src/
  └── routes/
      ├── auth-routes.ts       # Login/logout/token-refresh
      └── share-routes.ts      # Session sharing endpoints

packages/collab/                           # NEW PACKAGE
  ├── src/
  │   ├── shared-session.ts    # Multi-user session state
  │   ├── review-queue.ts      # Peer review submission queue
  │   └── presence.ts          # Real-time user presence
```

### Exit Gates

```text
[ ] TLS with auto-generated self-signed certificates
[ ] Bearer token authentication with time-limited tokens
[ ] Authorization: read-only vs read-write access
[ ] Remote access: connect from any device on the network via HTTPS
[ ] Tailscale integration: auto-detect tailnet IP for remote access
[ ] Share sessions: generate a link that grants view-only access
[ ] Collaborative review: submit agent-generated code for human review
[ ] Presence: see who's viewing a session
[ ] Rate limiting per authenticated user (not just IP)
```

---

## 11. Phase 28: Desktop Application (Tauri)

### Priority: 🟢 MEDIUM
### Dependencies: Phase 21 (TUI polish), Phase 22 (workspaces)
### Estimated: 3 weeks

### Purpose

Package agent-workbench as a native desktop application using Tauri (Rust backend, SolidJS frontend). Provides system tray, native notifications, and automatic updates.

### Required Outputs

```text
apps/desktop/                              # NEW APP
  ├── src-tauri/
  │   ├── Cargo.toml
  │   ├── src/main.rs          # Tauri backend (bundles Bun server)
  │   └── icons/               # App icons (all platforms)
  ├── src/                     # SolidJS UI (reuses apps/tui components)
  ├── tauri.conf.json
  └── package.json

Native features:
  - System tray icon with quick actions (new session, pause, quit)
  - Native notifications for permission prompts
  - Auto-start on login
  - Automatic updates via Tauri updater
  - macOS: menu bar integration
  - Windows: toast notifications
  - Linux: systemd user service
```

### Exit Gates

```text
[ ] macOS .dmg build
[ ] Windows .msi installer
[ ] Linux .AppImage + .deb
[ ] System tray with context menu
[ ] Native notifications via OS notification center
[ ] Auto-update check on startup
[ ] Command-line interface for headless mode
[ ] Bundles Bun runtime (no separate install needed)
```

---

## 12. Phase 29: Model Experimentation & Evaluation

### Priority: 🟢 MEDIUM
### Dependencies: Phase 19 (live providers), Phase 24 (smart routing)
### Estimated: 2 weeks

### Purpose

Built-in model evaluation tools. A/B test prompts across providers, run eval harnesses, and track prompt effectiveness over time.

### Required Outputs

```text
packages/eval/                             # NEW PACKAGE
  ├── src/
  │   ├── index.ts
  │   ├── runner.ts            # Eval runner (built-in + custom evals)
  │   ├── metrics.ts           # Accuracy, latency, cost metrics
  │   ├── comparison.ts        # Side-by-side model comparison
  │   └── prompt-store.ts      # Version-controlled prompt library

~/.agent-workbench/evals/
  └── my-eval/                 # Custom evaluation suite

Integration with:
  - lm-evaluation-harness      # Standard benchmarks (MMLU, HumanEval, etc.)
  - promptfoo                  # Prompt evaluation framework
```

### Exit Gates

```text
[ ] Built-in eval runner with standard benchmarks (MMLU, HumanEval, GSM8K)
[ ] A/B test: same prompt → compare outputs across 2+ models
[ ] Prompt versioning with git-backed history
[ ] Cost-per-eval tracking
[ ] Latency percentiles (p50, p95, p99) per model per task type
[ ] Side-by-side diff viewer for model outputs
[ ] Export eval results to CSV/JSON for external analysis
```

---

## 13. Phase 30: Enterprise Readiness & Compliance

### Priority: 🟢 MEDIUM
### Dependencies: Phase 25 (observability), Phase 27 (auth)
### Estimated: 3 weeks

### Purpose

Features needed for enterprise deployment: SSO, audit compliance, data residency, and air-gapped operation.

### Required Outputs

```text
packages/compliance/                       # NEW PACKAGE
  ├── src/
  │   ├── audit.ts             # Immutable audit trail
  │   ├── data-retention.ts    # Configurable data retention policies
  │   ├── pii-scanner.ts       # PII detection and redaction
  │   └── fips.ts              # FIPS 140-2 compliance helpers

apps/server/src/
  └── middleware/
      ├── sso-middleware.ts    # OIDC/SAML SSO
      └── compliance-headers.ts # Content-Security-Policy, etc.

Documentation:
  - Security whitepaper
  - SOC 2 readiness checklist
  - GDPR data processing addendum
  - On-prem deployment guide
```

### Exit Gates

```text
[ ] SSO: OIDC (Okta, Auth0, Azure AD) and SAML
[ ] Role-based access control: admin, developer, viewer
[ ] Immutable audit trail with cryptographic chaining
[ ] Data retention: auto-delete sessions older than N days
[ ] PII detection: scan tool inputs/outputs for PII and redact
[ ] Air-gapped mode: no external network calls, bundled model
[ ] SOC 2 Type II readiness documentation
[ ] GDPR: right to access, right to delete endpoints
[ ] Supply chain: SBOM generation, dependency vulnerability scanning
[ ] FIPS 140-2 compliance for cryptographic operations
```

---

## 14. Horizons — Beyond Phase 30

These are speculative directions that may become formal phases based on community demand:

### Horizon 1: AI-Native IDE
- Inline code suggestions (like Copilot but local-first)
- AI-generated pull request descriptions
- Automated refactoring with before/after diff review
- Test generation from implementation

### Horizon 2: Multi-Agent Systems
- Subagent spawning (already in AGENTS.md as "do not implement")
- Agent-to-agent communication protocol
- Hierarchical task decomposition
- Agent specialisation (code agent, review agent, test agent)

### Horizon 3: Voice & Multimodal
- Voice-to-text prompt input
- Image understanding via multimodal models
- Screen context awareness
- Video walkthrough generation

### Horizon 4: CI/CD Integration
- GitHub Actions integration
- GitLab CI integration
- PR review bot mode
- Automated changelog generation from agent actions

---

## 15. Contribution Guide

### How to contribute to future phases

1. **Pick a phase** from phases 19–30
2. **Read the exit gates** — they define what "done" means
3. **Follow the architecture boundaries** in `AGENTS.md`
4. **Write tests first** — 357 existing tests must continue to pass
5. **Open a PR** with a phase plan doc in `docs/`
6. **Get community review** before implementation

### Phase Proposal Template

Create `docs/NN_PHASE_XX_TITLE.md`:

```markdown
# NN — Phase XX: Title

Status: Proposed
Document type: phase plan
Dependencies: Phase N

## Purpose
...

## Required Outputs
...

## Architecture Changes
...

## Exit Gates
...

## Risks
...
```

---

*Last updated: 2026-07-02*
*Next review: After Phase 18 completion*
