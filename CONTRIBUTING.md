# 🤝 Contributing to agent-workbench

First off, thank you for considering contributing! This project is a local-first, permission-gated agent workbench, and every contribution helps.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Phase Workflow](#phase-workflow)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Architecture Principles](#architecture-principles)

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

This compiles TypeScript to `dist/` for all workspace packages in dependency order (17 packages + apps).

---

## Project Structure

```
agent-workbench/
├── apps/
│   ├── tui/          # OpenTUI + SolidJS terminal client
│   ├── server/       # Hono HTTP/SSE server
│   ├── mobile-web/   # SolidJS PWA (touch-optimized)
│   ├── dashboard/    # SolidJS observability dashboard
│   └── cli/          # CLI entrypoint (plugin management)
├── packages/
│   ├── core/         # Runtime orchestration
│   ├── protocol/     # Zod schemas, route contracts
│   ├── sdk/          # Typed HTTP/SSE client
│   ├── tools/        # Tool definitions & registry
│   ├── permissions/  # Allow/ask/deny engine
│   ├── shell/        # Simple + PTY command runners
│   ├── storage/      # SQLite/Drizzle persistence
│   ├── models/       # Provider adapters + marketplace
│   ├── tokens/       # Token health & budgets
│   ├── diff/         # Patch preview/apply
│   ├── planner/      # Pre-run plan gates
│   ├── events/       # Event bus
│   ├── cache/        # Read/grep/glob cache
│   ├── telemetry/    # OpenTelemetry tracing, metrics
│   ├── plugin-sdk/   # Plugin extension interfaces
│   ├── config/       # Config loading (scaffold)
│   └── ui/           # Shared UI primitives (scaffold)
├── docs/             # Phase planning docs (00–27)
├── decisions/        # Architecture Decision Records (0017)
├── tests/            # Unit, integration, e2e, fixtures
├── scripts/          # Build & health scripts
└── tools/            # Model-router benchmark tooling
```

---

## Code Style

- **TypeScript** with `strict: true` and `noUncheckedIndexedAccess`
- **Biome** for formatting and linting (see `biome.json`)
- **No `any`** — prefer `unknown` with type guards
- **Zod** as the single source of truth for all data shapes
- **ULID** primary keys, ISO-8601 timestamps

Run the formatter:

```bash
npx @biomejs/biome format --write .
```

---

## Phase Workflow

This project follows a **phase-based development** model (currently 0–26 complete, 27–30 planned). Each phase has:

1. A **plan doc** (`docs/NN_PHASE_NAME.md`) defining scope and deliverables
2. An **ADR** (`decisions/NNNN-topic.md`) recording architectural decisions
3. **Exit gates** in `docs/18_PHASE_EXIT_GATES.md` that must be satisfied
4. **Tests** covering the implementation

**Rules:**
- Do not skip ahead to later phases
- Do not start a phase until its exit gate is complete
- Exceptions require explicit maintainer approval

---

## Making Changes

### For Human Contributors

1. Fork the repo and create a branch from `main`
2. Make your changes following the architecture boundaries
3. Run tests: `bun test`
4. Ensure all 602 tests pass
5. Ensure `bash scripts/build-all.sh` completes cleanly
6. Submit a pull request

### For AI Agents

See [`AGENTS.md`](./AGENTS.md) for the agent-specific workflow, which includes:

1. Read relevant docs and decisions before making changes
2. Propose a bounded plan identifying target files and risk
3. Obtain approval before writing, editing, or running shell commands
4. Execute through the runtime (never through the TUI)

---

## Testing

```bash
# Full test suite (602 tests, 0 failures)
bun test

# Per-category
bun test unit
bun test integration
bun test e2e

# Specific areas
bun test tests/unit/plugin-sdk/    # Plugin system (26 tests)
bun test tests/unit/telemetry/     # Telemetry (59 tests)
bun test tests/integration/server/ # Server integration

# Build verification
bash scripts/build-all.sh
```

### Test Structure

- `tests/unit/` — Isolated unit tests per package (core, tools, permissions, models, telemetry, plugin-sdk, etc.)
- `tests/integration/` — Cross-package integration + fault injection
- `tests/e2e/` — Full-stack end-to-end validation
- `tests/helpers/` — Shared test utilities and fixtures (test-db, test-server, mock-model)

---

## Pull Request Process

1. Ensure all 602 tests pass and CI is green
2. Update README and package-level docs if your change affects public API
3. Update phase checklists if your change completes a phase exit gate
4. Include a clear PR description referencing the relevant docs/decisions
5. PRs require at least one review before merging

### PR Title Convention

```
Phase N: Brief description
feat: Brief description
fix: Brief description
docs: Brief description
chore: Brief description
```

---

## Architecture Principles

These principles must be preserved in every contribution:

| Principle | Description |
|-----------|-------------|
| **TUI is thin** | The TUI renders and accepts input only. Never executes tools, permissions, or runtime logic. |
| **Server is thin** | Routes delegate to core runtime. Never execute tools or shell commands directly. |
| **Schema-first** | All data shapes are defined in Zod schemas first, then consumed everywhere. |
| **Permission-gated** | No file mutation or shell execution bypasses the permission engine. |
| **Localhost default** | The server binds to `127.0.0.1` by default (override with `WORKBENCH_HOST=0.0.0.0`). |
| **Full audit trail** | Every tool call, permission decision, and runtime event is recorded in the run ledger. |
| **Plugin sandbox** | Plugins declare permissions; risky operations are logged and gated. |

---

## Getting Help

- Open an issue for bugs or feature requests
- See the [`docs/`](./docs/) directory for detailed planning docs
- See [`AGENTS.md`](./AGENTS.md) for the AI agent workflow
- See [`docs/27_PROJECT_ROADMAP.md`](docs/27_PROJECT_ROADMAP.md) for the project roadmap
