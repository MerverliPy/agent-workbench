# 25 — Phase 17 CI/CD Pipeline & End-to-End Validation

Status: Draft — not yet accepted
Document type: implementation plan
Scope: GitHub Actions CI pipeline + end-to-end validation tests for the full stack

## 1. Summary

Phase 16 added streaming provider responses. Phase 17 adds the two missing
quality infrastructure layers: **automated CI** (run tests on every push/PR)
and **end-to-end validation** (verify the full agent-workbench stack with
mock providers). These are complementary — CI runs the E2E tests, so building
both in the same phase avoids churn.

This phase changes **zero source packages**. All work is in `.github/workflows/`
and `tests/e2e/`.

## 2. CI/CD Pipeline (GitHub Actions)

### 2.1 Workflow Triggers

- `push` to `main`
- `pull_request` targeting `main`

### 2.2 Jobs

**Job 1: Static Check (fast-fail)**
- Run `bash scripts/test-health.sh` — all static checks must pass.
- Run `git diff --check` — no whitespace errors.
- Expected duration: < 30 seconds.
- If this job fails, the whole workflow stops early.

**Job 2: Typecheck (matrix)**
- Run `bun run typecheck` in every workspace package:
  - `packages/protocol`, `packages/storage`, `packages/core`, `packages/sdk`
  - `apps/server`, `apps/tui`
- Run concurrently where package tooling permits.

**Job 3: Test Suite**
- Run `bun test` — full suite.
- Expect: 346+ tests, 0 failures, < 5 min wall-clock.

**Job 4: E2E Suite** (depends on typecheck + tests passing)
- Run `bun run test:e2e` — end-to-end validation.
- Covers the full-stack integration and streaming validation tests.

### 2.3 Runner

- `ubuntu-latest` (matches WSL2 Ubuntu environment).
- Bun installed via `oven-sh/setup-bun`.
- No Docker, no external services — all mock providers, temp databases.

### 2.4 Security

- No secrets stored in workflow — all provider tests use fake fetch/mock HTTP only.
- No `OPENAI_API_KEY` or other real credentials required.
- No network access needed for any test.

### 2.5 Slack / Notification (Deferred)

Posting CI results to Slack is out of scope. GitHub commit status checks
on PRs are the feedback mechanism.

## 3. End-to-End Validation Tests

### 3.1 Full-Stack E2E Test

A headless integration test that brings up the full stack with mock providers:

```
server startup (Hono, localhost)
  → health check (GET /health → 200)
  → provider route (GET /provider → provider list with stub)
  → SDK client init (connect via typed SDK)
  → session lifecycle (create → send prompt → receive response)
    → permission gate sequence (tool request → deny → check ledger)
  → shutdown (close server, clean temp DB)
```

**Why this matters:** Unit and integration tests cover individual packages.
The E2E test validates that the wiring between server → SDK → core → storage →
events works correctly end-to-end. Without it, regressions in the integration
layer go undetected.

### 3.2 Streaming E2E Test

Validates the Phase 16 streaming path end-to-end:

```
server startup
  → SDK SSE subscription (onStreamDelta, onStreamComplete)
  → session with streaming-capable mock provider
  → verify multiple stream_delta events received
  → verify stream_complete event received with content
  → verify only complete message is persisted
  → verify non-streaming fallback works for stub providers
  → shutdown
```

**Why this matters:** Streaming is the most complex event path in the system.
A dedicated E2E test catches integration bugs that unit tests miss (event
ordering, buffer accumulation, final persistence, fallback edge cases).

### 3.3 Test Infrastructure

- Mock providers live in `tests/helpers/` — reusable `StubModelProvider` with
  controllable responses and streaming support.
- Temp SQLite databases via `:memory:` or temp files.
- Server binds to random available port to avoid port conflicts.
- `beforeAll`/`afterAll` lifecycle for server start/stop.
- 30-second timeout per test (generous for CI headless).

### 3.4 What E2E Tests Do NOT Cover

- Real provider API calls (always mock).
- TUI rendering (headless SDK client simulates TUI logic).
- File system mutations (covered by unit/integration tests).
- Performance/load testing (deferred).
- Cross-process IPC or subprocess spawning (deferred).

## 4. Impact Analysis

### Packages/Areas Changed

| Area | Scope |
|------|-------|
| `.github/workflows/ci.yml` | New — CI pipeline definition |
| `tests/e2e/fullstack.test.ts` | New — full-stack E2E test |
| `tests/e2e/streaming.test.ts` | New — streaming E2E test |
| `tests/helpers/` | New — shared mock server helpers |
| `package.json` | Add `"test:e2e"` script entry |
| `scripts/test-health.sh` | Minor — may need E2E static checks |

### Packages Unchanged

`packages/models`, `packages/core`, `packages/protocol`, `packages/sdk`,
`packages/storage`, `packages/events`, `packages/permissions`, `packages/tools`,
`packages/shell`, `packages/diff`, `packages/tokens`, `packages/cache`,
`packages/planner`, `packages/config`, `packages/ui`, `apps/server`,
`apps/tui`, `apps/cli` — **zero runtime changes.**

## 5. Implementation Order

1. Create `tests/helpers/` with shared mock server + provider setup.
2. Create `tests/e2e/fullstack.test.ts` — full-stack lifecycle test.
3. Create `tests/e2e/streaming.test.ts` — streaming path E2E test.
4. Add `"test:e2e"` to `package.json` scripts.
5. Create `.github/workflows/ci.yml` — CI pipeline.
6. Update `scripts/test-health.sh` if needed for E2E static checks.
7. Run full suite locally to verify.
8. Push and verify CI triggers on first commit.

## 6. Non-Goals (Deferred)

- Slack/Discord/email notifications on CI status.
- Docker containerization or reproducible build environments.
- Deployment automation (brew, npm, Docker image).
- Load testing or performance benchmarks.
- Code coverage thresholds or coverage reporting.
- Cross-platform CI (macOS, Windows).
- CI caching (bun.lock, node_modules) — defer if runtime stays under 5 min.

## 7. Safety & Boundaries

- CI must not require real API keys, network access, or external services.
- CI must not expose secrets in logs or artifacts.
- E2E tests must use temp databases — no persistent state.
- E2E tests must bind to random ports — no port conflicts.
- E2E tests must clean up server processes on failure.
- E2E tests must not execute shell commands or mutate real file systems.
- TUI rendering is never tested by E2E — the SDK client is the test driver.

## 8. Open Questions

- `Provisional` — Should CI run on every push to any branch, or only `main`?
  Propose: push + PR targeting `main`. Feature branches benefit from CI but
  we don't spam on every branch push.
- `Unresolved` — Should the E2E test server be the same Hono app used in
  production, or a thin test wrapper? Propose: production `apps/server` with
  mock provider injected via environment config.
- `Provisional` — Should the streaming E2E test use real `setTimeout` delays or
  mock the async generator? Propose: real async generator — the test validates
  real async behaviour, not mocked timing.

## 9. Verification

```text
bun test                                    # all existing tests still pass
bash scripts/test-health.sh                 # all static checks pass
bun run test:e2e                            # new E2E tests pass
# CI workflow file is valid YAML
# GitHub shows green checkmark on push
```
