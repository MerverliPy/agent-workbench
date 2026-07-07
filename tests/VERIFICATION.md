# Test Verification Guide

All 30 phases are complete. The current test baseline covers the full stack:

- **564+ tests** with 0 failures
- Unit, integration, and end-to-end test suites
- All packages build cleanly via `bash scripts/build-all.sh`

## Running Tests

```bash
# Full test suite
bun test

# Per-category
bun test unit
bun test integration
bun test e2e

# Specific packages
bun test tests/unit/models/         # Provider adapters
bun test tests/unit/plugin-sdk/     # Plugin system
bun test tests/unit/telemetry/      # Observability
bun test tests/unit/permissions/    # Permission engine
bun test tests/integration/server/  # Server integration

# Build verification
bash scripts/build-all.sh
```

## Test Structure

| Directory | Contents |
|-----------|----------|
| `tests/unit/` | Isolated unit tests per package (core, tools, permissions, models, telemetry, plugin-sdk, eval, compliance, auth, etc.) |
| `tests/integration/` | Cross-package integration tests (server, storage, security, sdk, core, shell, diff, faults) |
| `tests/e2e/` | Full-stack end-to-end validation |
| `tests/helpers/` | Shared test utilities and fixtures (test-db, test-server, mock-model) |
| `tests/fixtures/` | Sample projects and test data |

## Key Commands

```bash
# Build all packages (required before running tests)
bash scripts/build-all.sh

# Type check individual packages
cd packages/protocol && bun run typecheck
cd packages/storage && bun run typecheck
cd packages/core && bun run typecheck
cd packages/models && bun run typecheck
cd packages/compliance && bun run typecheck
cd apps/server && bun run typecheck

# CI pipeline (static check → typecheck → tests → e2e)
bash scripts/test-health.sh
```
