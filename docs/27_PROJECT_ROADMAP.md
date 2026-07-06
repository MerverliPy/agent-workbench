# 27 — Project Roadmap

Status: Phase 29 complete — Phase 30 (enterprise readiness) next
Document type: Roadmap for Phases 19–30
Supersedes: incremental updates in docs/04_IMPLEMENTATION_PHASE_CHECKLIST.md

---

## 1. Roadmap Overview

```text
Phase 18 ✅ complete ██████████████████████  mobile web companion UI
Phase 19 ✅ complete ██████████████████████  live provider integration
Phase 20A✅ complete ██████████████████████  mobile web: non-chat panels
Phase 20B✅ complete ██████████████████████  mobile web: chat + streaming
Phase 21 ✅ complete ██████████████████████  TUI polish & UX completion
Phase 22 ✅ complete ██████████████████████  multi-session & workspace mgmt
Phase 23 ✅ complete ██████████████████████  PTY terminal execution
Phase 24 ✅ complete ██████████████████████  provider marketplace & smart routing
Phase 25 ✅ complete ██████████████████████  observability & production readiness
Phase 26 ✅ complete ██████████████████████  plugin system & extensibility
Phase 27 ✅ complete ██████████████████████  remote access & collaboration
Phase 28 ⏸️        ░░░░░░░░░░░░░░░░░░░░  ⏸️  desktop application (deferred)
Phase 29 ✅ complete ██████████████████████  model experimentation & eval
Phase 30 ✅ complete ██████████████████████  enterprise readiness & compliance
```

### Timeline

| Wave | Phases | Estimated | Focus |
|------|--------|-----------|-------|
| **Complete** | 0–17 | Done | Foundation, core runtime, safety |
| **Complete** | 18–21 | Done | Interfaces (mobile web, TUI polish) |
| **Complete** | 22–27 | Done | Ecosystem (PTY, marketplace, observability, plugins, remote access) |
| **Long-term** | 29–30 | 3–4 months | Evaluation, playgrounds, enterprise, tooling bridges |

---

## 2–9. Phases 18–26: ✅ Complete (archived)

These phases are fully implemented and verified. Details are preserved in git history (`git log -- docs/27_PROJECT_ROADMAP.md`).

| Phase | Focus | Tests | Status |
|-------|-------|-------|--------|
| 18 | Mobile web companion UI | PWA, 7 panels, chat streaming, landscape, offline | ✅ Complete |
| 19 | Live provider integration | OpenAI, Anthropic, OpenRouter, Ollama adapters | ✅ Complete |
| 20A | Mobile web — non-chat panels | FileBrowser, GitTree, Settings, PWA manifest | ✅ Complete |
| 20B | Mobile web — chat + streaming | Real-time streaming, markdown, notifications | ✅ Complete |
| 21 | TUI polish & UX | Command palette, multiline, diff viewer, themes | ✅ Complete |
| 22 | Multi-session & workspaces | Session groups, workspace CRUD, bulk operations | ✅ Complete |
| 23 | PTY terminal execution | Interactive programs, ANSI support, resize events | ✅ Complete |
| 24 | Provider marketplace & smart routing | Marketplace CRUD, cost tracking, health monitoring | ✅ Complete |
| 25 | Observability & production readiness | Tracing, metrics, error reporting, dashboard app | ✅ Complete |
| 26 | Plugin system & extensibility | Plugin SDK, tool/provider/panel/hook plugins | ✅ Complete |

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
  │   ├── presence.ts          # Real-time user presence
  │   └── session-export.ts    # Export/import sessions (JSON + markdown)

apps/cli/src/
  └── commands/
      └── init.ts              # `agent-workbench init` — scaffold workspace from template
```

### Exit Gates

```text
[x] TLS with auto-generated self-signed certificates
[x] Bearer token authentication with time-limited tokens
[x] Authorization: read-only vs read-write access
[x] Remote access: connect from any device on the network via HTTPS
[x] Tailscale integration: auto-detect tailnet IP for remote access
[x] Share sessions: generate a link that grants view-only access
[x] Collaborative review: submit agent-generated code for human review
[x] Presence: see who's viewing a session
[x] Rate limiting per authenticated user (not just IP)
[x] Session export: JSON conversation dump with tool results and permission decisions
[x] Session import: replay a session from an export file
[x] `agent-workbench init` scaffolds a workspace from a template (empty TS, Bun, Python)
[x] Auto-rebuild watch script (`scripts/build-watch.sh`) documented in README
```

---

## 11. Phase 28: Desktop Application (Tauri) ⏸️ DEFERRED

### Priority: 🟢 MEDIUM — deferred
### Dependencies: Phase 21 (TUI polish), Phase 22 (workspaces)
### Estimated: 3 weeks
### Status: ⏸️ Deferred — not a current priority. Phase 28 is shelved in favor of focusing on remote access (Phase 27), evaluation (Phase 29), and enterprise features (Phase 30). The CLI pipe mode and keyboard shortcut overlay features have been moved into the Phase 27 and Phase 29 scopes. Revisit when the mobile-web and remote-access workflows are fully mature.

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

CLI pipe mode (`apps/cli`):
  - `echo "refactor this" | agent-workbench --pipe` — non-interactive batch processing
  - Reads prompt from stdin, writes response to stdout
  - Supports `--session-id` to continue an existing session
  - Supports `--format json` for machine-parseable output

Keyboard shortcut overlay (Ctrl+H / ?):
  - Full-screen reference panel showing ALL keybindings grouped by category
  - Search/filter: type to filter shortcuts by name
  - Sourced from `packages/protocol` keybindings schema (single source of truth)
```

### Exit Gates (deferred)

```text
⏸️ [ ] macOS .dmg build
⏸️ [ ] Windows .msi installer
⏸️ [ ] Linux .AppImage + .deb
⏸️ [ ] System tray with context menu
⏸️ [ ] Native notifications via OS notification center
⏸️ [ ] Auto-update check on startup
⏸️ [ ] Command-line interface for headless mode
⏸️ [ ] Bundles Bun runtime (no separate install needed)
⏸️ [ ] CLI pipe mode: `--pipe` flag reads from stdin, writes to stdout
⏸️ [ ] Keyboard shortcut overlay accessible via Ctrl+H or `?`
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
  │   ├── prompt-store.ts      # Version-controlled prompt library
  │   └── playground.ts        # One-shot model playground (quick test without session)

~/.agent-workbench/prompts/
  └── library/                 # Shared prompt templates (`.prompt.md`)
      ├── code-review.md       # "Review this code for bugs and style issues"
      ├── refactor.md          # "Refactor this code to improve X"
      ├── explain.md           # "Explain this code to a junior developer"
      └── test-gen.md          # "Generate tests for this implementation"

Integration with:
  - lm-evaluation-harness      # Standard benchmarks (MMLU, HumanEval, etc.)
  - promptfoo                  # Prompt evaluation framework
```

### Exit Gates

```text
[x] Built-in eval runner with standard benchmarks (MMLU, HumanEval, GSM8K)
[x] A/B test: same prompt → compare outputs across 2+ models
[x] Prompt versioning with git-backed history
[x] Cost-per-eval tracking
[x] Latency percentiles (p50, p95, p99) per model per task type
[x] Side-by-side diff viewer for model outputs
[x] Export eval results to CSV/JSON for external analysis
[x] Model playground: one-shot chat in the TUI to test any configured model
[x] Prompt library: 4+ built-in prompt templates in ~/.agent-workbench/prompts/library/
[x] Playground supports streaming responses (like the main chat panel)
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

### Integration Bridges (Phase 30 extended scope)

These bridges connect agent-workbench with existing developer tooling:

**Hermes Agent Bridge** (`packages/hermes-bridge`):
  - Plugin that consumes Hermes Agent's routing config, provider pool, and credentials
  - Auto-discovers Hermes provider setup from `~/.hermes/config.yaml` and `auth.json`
  - Maps Hermes provider chains (flash, pro, expensive) to agent-workbench smart router tiers
  - Bidirectional: agent-workbench models appear in Hermes routing table and vice versa

**OpenCode Bridge** (`packages/opencode-bridge`):
  - Plugin that reads OpenCode router state from `~/.opencode/`
  - Exposes OpenCode providers as agent-workbench `ProviderProfile` entries
  - Provider registry sync: changes in one tool propagate to the other
```

### Exit Gates

```text
[x] SSO: OIDC (Okta, Auth0, Azure AD) and SAML
[x] Role-based access control: admin, developer, viewer
[x] Immutable audit trail with cryptographic chaining
[x] Data retention: auto-delete sessions older than N days
[x] PII detection: scan tool inputs/outputs for PII and redact
[x] Air-gapped mode: no external network calls, bundled model fallback
[x] SOC 2 Type II readiness documentation
[x] GDPR: right to access, right to delete endpoints
[x] Supply chain: SBOM generation, dependency vulnerability scanning
[x] FIPS 140-2 compliance for cryptographic operations
[x] Hermes Agent bridge auto-discovers provider config from ~/.hermes/
[x] OpenCode bridge syncs provider registry from ~/.config/opencode/
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
4. **Write tests first** — 602 existing tests must continue to pass
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

*Last updated: 2026-07-06 (Phase 30 complete — enterprise readiness)*
*Next review: After Phase 30 completion*
