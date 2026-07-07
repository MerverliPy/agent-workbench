<div align="center">
  <h1>⚡ agent-workbench</h1>
  <p><em>Local-first agent workbench for disciplined AI-assisted development</em></p>

  <p>
    <a href="#"><img src="https://img.shields.io/badge/Bun-%3E%3D1.0-cc00ff?logo=bun" alt="Bun" /></a>
    <a href="#"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
    <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" /></a>
  </p>
</div>

---

> **Status:** All 30 phases complete · 564+ tests passing · Ready for production use

---

## 📋 Table of Contents

- [What Is agent-workbench?](#what-is-agent-workbench)
- [Quick Start](#quick-start)
- [Features](#features)
- [Configuration](#configuration)
- [Deployment Scenarios](#deployment-scenarios)
- [Safety Model](#safety-model)
- [Enterprise](#enterprise)
- [Project Roadmap](#project-roadmap)
- [Contributing](#contributing)

---

## What Is agent-workbench?

agent-workbench is a **local-first, AI-assisted development tool** that runs entirely on your machine. It provides a terminal user interface (TUI), a mobile web companion, and a dashboard — all powered by a local server that orchestrates AI model calls, file operations, shell commands, and permissions in a safety-gated environment.

Unlike cloud-hosted coding agents, agent-workbench:

- **Runs locally** — no data leaves your machine unless you explicitly configure a remote model provider
- **Respects your permissions** — every file mutation and shell command requires your approval by default
- **Keeps a full audit trail** — every action is logged in an immutable chain
- **Works offline** — use with local models (Ollama) in air-gapped mode

### Interfaces

| Interface | Purpose |
|-----------|---------|
| **Terminal UI** (TUI) | Full-featured terminal chat interface with streaming, keybindings, command palette |
| **Mobile Web** | Touch-optimized PWA companion for phones and tablets |
| **Dashboard** | Observability panel showing sessions, latency, costs, and metrics |
| **CLI** | Command-line entry point for plugin management and scripting |

---

## Quick Start

### Prerequisites

- **Bun >= 1.x** — [Install Bun](https://bun.sh/docs/installation)
- A model provider API key (or [Ollama](https://ollama.com) for local inference)

### Run agent-workbench

```bash
# Clone
git clone https://github.com/MerverliPy/agent-workbench.git
cd agent-workbench

# Install and build
bun install
bash scripts/build-all.sh

# Set your model provider (pick one)
export AGENT_WORKBENCH_PROVIDER=openai
export OPENAI_API_KEY=sk-...

# Start the server
cd apps/server && bun run start
```

Open your browser to `http://localhost:3000` or launch the TUI:

```bash
# In a second terminal
cd apps/tui && bun run dev
```

### Connect a mobile device

```bash
cd apps/mobile-web && bun run dev
```

Then navigate to the displayed URL on your phone (same network).

---

## Features

### Core

| Feature | Description |
|---------|-------------|
| **AI chat sessions** | Interactive agent sessions with streaming responses |
| **Codebase inspection** | Read, grep, and glob tools with caching for fast searches |
| **File editing** | Permission-gated write, edit, and patch with diff previews |
| **Shell execution** | Run commands through a safety gate, with PTY support for interactive programs |
| **Multi-session** | Run multiple agent sessions side-by-side |
| **Workspaces** | Organize sessions by project workspace |

### Providers

Connect any OpenAI-compatible model provider:

| Provider | Config |
|----------|--------|
| **OpenAI** | `AGENT_WORKBENCH_PROVIDER=openai` + `OPENAI_API_KEY` |
| **Anthropic** | `AGENT_WORKBENCH_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` |
| **OpenRouter** | `AGENT_WORKBENCH_PROVIDER=openrouter` + `OPENROUTER_API_KEY` |
| **Ollama** (local) | `AGENT_WORKBENCH_PROVIDER=ollama` (no API key needed) |
| **OpenCode bridge** | Auto-discovers providers from `~/.config/opencode/` |
| **Hermes bridge** | Auto-discovers providers from `~/.hermes/config.yaml` |

### Observability

- Real-time metrics dashboard with session overview, latency percentiles, and cost tracking
- OpenTelemetry-style tracing across all operations
- Error reporting and request logging

### Plugins

Extend via the plugin SDK with custom tools, providers, panels, and hooks:

```bash
agent-workbench plugin list
agent-workbench plugin install local:~/my-plugin
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_WORKBENCH_PROVIDER` | Default model provider | (stub) |
| `AGENT_WORKBENCH_MODEL` | Model name | Provider default |
| `WORKBENCH_HOST` | Server bind address | `127.0.0.1` |
| `WORKBENCH_PORT` | Server port | `3000` |
| `AGENT_WORKBENCH_AUTH_ENABLED` | Enable authentication | `false` |
| `AGENT_WORKBENCH_AUTH_SECRET` | Shared auth secret | (none) |
| `AGENT_WORKBENCH_TLS_ENABLED` | Enable HTTPS | `false` |
| `AGENT_WORKBENCH_AIRGAPPED` | Block external network calls | `false` |

### Provider Keys

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `OPENROUTER_API_KEY` | OpenRouter |

### SSO (Enterprise)

| Variable | Description |
|----------|-------------|
| `AGENT_WORKBENCH_SSO_ISSUER` | OIDC issuer URL |
| `AGENT_WORKBENCH_SSO_CLIENT_ID` | OIDC client ID |
| `AGENT_WORKBENCH_SSO_CLIENT_SECRET` | OIDC client secret |
| `AGENT_WORKBENCH_SSO_REDIRECT_URI` | OIDC callback URI |

---

## Deployment Scenarios

### Single Developer (Default)

```bash
export AGENT_WORKBENCH_PROVIDER=ollama
cd apps/server && bun run start
# → http://127.0.0.1:3000
```

### Air-Gapped (No External Network)

```bash
export AGENT_WORKBENCH_AIRGAPPED=true
export AGENT_WORKBENCH_PROVIDER=ollama
cd apps/server && bun run start
```

All external API calls are blocked. Only localhost services (Ollama) are allowed.

### TLS + Auth (Team Access)

```bash
export AGENT_WORKBENCH_TLS_ENABLED=true
export AGENT_WORKBENCH_AUTH_ENABLED=true
export AGENT_WORKBENCH_AUTH_SECRET=your-secret
export WORKBENCH_HOST=0.0.0.0
cd apps/server && bun run start
```

See the [On-Prem Deployment Guide](docs/compliance/on-prem-deployment-guide.md) for detailed hardening instructions.

---

## Safety Model

agent-workbench enforces a layered safety model that puts you in control:

| Operation | Default | What happens |
|-----------|---------|--------------|
| Read files, search code | ✅ Allow | No prompt |
| Write / edit / patch files | ❓ Ask | Shows diff preview, you approve or deny |
| Shell commands | ❓ Ask | Shows command, you approve or deny |
| Destructive operations | 🚫 Deny | Blocked unless explicitly configured |

Every permission decision is recorded in an immutable audit trail.

---

## Enterprise

agent-workbench includes features for enterprise deployment:

| Feature | Description |
|---------|-------------|
| **SSO (OIDC)** | Authenticate via Okta, Auth0, Azure AD — no OAuth libraries needed, built-in JWKS verification |
| **RBAC** | Three roles: Viewer (read-only), Developer (read+write), Admin (full access) |
| **Audit Trail** | SHA-256 chained, tamper-evident log of all actions |
| **PII Scanner** | Detects and redacts emails, phones, SSNs, credit cards, API keys, and more |
| **Data Retention** | Configurable auto-deletion policies for session data |
| **FIPS 140-2** | FIPS-approved algorithm checks, Known Answer Tests, CSPRNG |
| **SBOM** | CycloneDX software bill of materials via `bun run sbom` |
| **Compliance Docs** | SOC 2 readiness checklist, GDPR addendum, security whitepaper |

See [docs/compliance/](docs/compliance/) for full documentation.

---

## Project Roadmap

agent-workbench was built in 30 phases. All phases are complete:

| Wave | Phases | Focus |
|------|--------|-------|
| Foundation | 0–5 | Architecture, protocol, server, storage |
| Core Runtime | 6–14 | Session runner, tools, permissions, shell, agents |
| Production | 15–17 | Model providers, streaming, CI/CD |
| Interfaces | 18–21 | Mobile web, TUI polish |
| Ecosystem | 22–26 | PTY, marketplace, plugins, observability |
| Enterprise | 27–30 | Remote access, SSO, RBAC, compliance, eval |

See [`docs/27_PROJECT_ROADMAP.md`](docs/27_PROJECT_ROADMAP.md) for the full roadmap.

---

## Contributing

We welcome contributions! See [`CONTRIBUTING.md`](CONTRIBUTING.md) for:

- Development setup
- Code style and standards
- Pull request process
- Architecture principles

---

## Security

See [`SECURITY.md`](SECURITY.md) for our security policy and vulnerability reporting process.

---

## License

MIT — see [`LICENSE`](LICENSE) for details.
