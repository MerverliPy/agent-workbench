# 🤝 Contributing to agent-workbench

First off, thank you for considering contributing! agent-workbench is a local-first agent workbench, and we welcome contributions of all kinds — bug fixes, features, documentation, and plugins.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Architecture Principles](#architecture-principles)
- [Getting Help](#getting-help)

---

## Getting Started

This is a **TypeScript + Bun monorepo** with multiple packages and apps. The best way to start contributing:

1. Read the [README.md](README.md) to understand what the project does
2. Browse the [`docs/`](docs/) directory for detailed documentation
3. Check open issues for things to work on
4. Join the discussion in GitHub issues

---

## Project Structure

```
agent-workbench/
├── apps/
│   ├── tui/          # Terminal UI client
│   ├── server/       # HTTP/SSE server
│   ├── mobile-web/   # Mobile PWA companion
│   ├── dashboard/    # Observability dashboard
│   └── cli/          # CLI entry point
├── packages/
│   ├── core/         # Core runtime orchestration
│   ├── protocol/     # Zod schemas, API contracts
│   ├── sdk/          # Typed client SDK
│   ├── tools/        # Tool definitions
│   ├── permissions/  # Permission engine
│   ├── shell/        # Command runners
│   ├── storage/      # SQLite persistence
│   ├── models/       # Model provider adapters
│   ├── compliance/   # Enterprise compliance
│   ├── auth/         # Auth & RBAC
│   ├── collab/       # Collaboration
│   ├── eval/         # Model evaluation
│   ├── telemetry/    # Observability
│   ├── plugin-sdk/   # Plugin system
│   └── ...           # Cache, tokens, diff, planner, events, etc.
├── docs/             # Documentation
├── tests/            # Test suite
└── scripts/          # Build and utility scripts
```

---

## Development Setup

### Prerequisites

- **Bun >= 1.0** — [Install Bun](https://bun.sh/docs/installation)

### Clone & Install

```bash
git clone https://github.com/MerverliPy/agent-workbench.git
cd agent-workbench
bun install
```

### Build All Packages

```bash
bash scripts/build-all.sh
```

This compiles TypeScript to `dist/` for all workspace packages in dependency order.

---

## Code Style

- **TypeScript** with `strict: true`
- **Biome** for formatting and linting (see `biome.json`)
- **No `any`** — prefer `unknown` with type guards
- **Zod** as the single source of truth for all data shapes
- **ULID** primary keys, ISO-8601 timestamps

Run the formatter:

```bash
npx @biomejs/biome format --write .
```

---

## Making Changes

### For Human Contributors

1. Fork the repo and create a branch from `main`
2. Make your changes following the architecture boundaries
3. Run tests: `bun test`
4. Ensure `bash scripts/build-all.sh` completes cleanly
5. Submit a pull request

### For AI Agents

See [`docs/dev/AGENTS.md`](docs/dev/AGENTS.md) for the agent-specific workflow and rules.

---

## Testing

```bash
# Full test suite
bun test

# Per-category
bun test unit
bun test integration
bun test e2e

# Build verification
bash scripts/build-all.sh
```

---

## Pull Request Process

1. Ensure all tests pass and CI is green
2. Update README and package-level docs if your change affects public API
3. Include a clear PR description
4. PRs require at least one review before merging

### PR Title Convention

```
feat: Brief description
fix: Brief description
docs: Brief description
chore: Brief description
```

---

## Architecture Principles

| Principle | Description |
|-----------|-------------|
| **TUI is thin** | The TUI renders and accepts input only. Never executes tools, permissions, or runtime logic. |
| **Server is thin** | Routes delegate to core runtime. Never execute tools or shell commands directly. |
| **Schema-first** | All data shapes are defined in Zod schemas first. |
| **Permission-gated** | No file mutation or shell execution bypasses the permission engine. |
| **Localhost default** | Server binds to `127.0.0.1` by default. |
| **Full audit trail** | Every tool call and permission decision is recorded. |
| **Plugin sandbox** | Plugins declare permissions; risky operations are gated. |

---

## Getting Help

- Open an issue for bugs or feature requests
- See [`docs/27_PROJECT_ROADMAP.md`](docs/27_PROJECT_ROADMAP.md) for the project roadmap
- See [`docs/dev/`](docs/dev/) for developer documentation and architecture records
