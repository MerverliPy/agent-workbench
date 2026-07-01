# 0017 — CI/CD Pipeline & End-to-End Validation

Status: Draft
Phase: Phase 17 — CI/CD Pipeline & End-to-End Validation
Decision type: Architecture Decision Record

## Context

The agent-workbench project has 346 automated tests, a static health-check
harness (`test-health.sh`), and thorough per-package type-checking — but no
automated CI pipeline. Every commit is unverified until someone pulls the
branch and runs tests locally. Regressions in the integration layer (server ↔
SDK ↔ core ↔ events ↔ storage) can go undetected for days.

The project also lacks end-to-end validation tests. Unit and integration tests
cover individual packages and specific interaction paths, but there is no
single test that starts the server, connects via the SDK, exercises a session
lifecycle with mock providers, and verifies the full event chain works.

Two recent phases (Phase 15 — provider integration, Phase 16 — streaming
responses) added complex cross-cutting features whose integration correctness
can only be fully validated by a running server through the SDK.

## Decision

Add both a CI pipeline and end-to-end validation tests in a single phase:

### CI Pipeline

GitHub Actions workflow triggered on `push` and `pull_request` targeting `main`:

- **Static check** (fast-fail): `test-health.sh` + `git diff --check`
- **Typecheck**: `bun run typecheck` in every workspace package
- **Test suite**: `bun test` (346+ tests, must pass)
- **E2E suite**: `bun run test:e2e` (full-stack + streaming validation)
- **Runner**: `ubuntu-latest`, `oven-sh/setup-bun`, no Docker
- **Security**: No secrets, no real API keys, no network access

### End-to-End Validation

Two new E2E tests using mock providers, temp databases, and random ports:

1. **Full-stack lifecycle test**: server start → health check → provider route
   → SDK session → model response → event stream → permission gate → shutdown.

2. **Streaming E2E test**: server start → SDK SSE subscription → session with
   streaming mock provider → verify `stream_delta`/`stream_complete` events →
   verify non-streaming fallback → verify persistence of final message only.

## Rationale

1. **CI is the biggest operational gap.** The project has strong testing
   discipline (346 tests, static health checks, type-checking per package) but
   no automation to run them on changes. Every commit since the first push has
   been manually verified.

2. **E2E tests verify integration, not just units.** Unit tests prove that
   `ModelRouter.routeStream()` works. An E2E test proves that `server → SDK →
   SessionRunner → ModelRouter → EventPublisher → server SSE → SDK callback`
   works — a multi-package integration path that no single unit test covers.

3. **Combining them avoids churn.** CI is the natural home for E2E tests.
   Adding CI first without E2E tests means revisiting CI config when E2E tests
   arrive. Adding E2E tests without CI means they never run automatically.

4. **Zero runtime changes.** All work is in `.github/workflows/` and
   `tests/e2e/`. No source package is touched. The risk of introducing
   regressions is effectively zero.

5. **Mock-only, no secrets.** The existing test discipline of fake
   fetch/mock HTTP/temp databases carries over directly. The CI pipeline
   requires zero secrets.

## Consequences

### Positive

```text
[+] Every commit on main is verified — no silent regressions.
[+] PRs show green/red status before merge.
[+] Streaming path (Phase 16) gets validated end-to-end.
[+] Full-stack integration is validated end-to-end.
[+] No source packages touched — low risk, high confidence.
[+] CI completes in < 5 minutes for full suite.
```

### Negative / Tradeoffs

```text
[-] CI setup requires GitHub repo admin to enable Actions.
[-] E2E tests add ~15-30s to CI runtime (acceptable within 5-min target).
[-] Streaming E2E tests require careful async timeouts to avoid flakiness.
[-] CI workflow YAML is new territory for this project — may need iteration.
```

## Implementation Rules

```text
[ ] E2E tests must use mock providers only — no real API calls.
[ ] E2E tests must use temp databases — no persistent state.
[ ] E2E tests must bind to random ports — no port conflicts.
[ ] E2E tests must clean up server processes on test failure.
[ ] E2E tests must not execute shell commands or mutate real files.
[ ] CI must not require secrets, API keys, or network access.
[ ] CI workflow must fast-fail on static check failure (< 30s).
[ ] CI workflow must complete full suite within 5 minutes.
```

## Boundaries

| Layer | Owns |
|-------|------|
| `.github/workflows/ci.yml` | CI pipeline definition |
| `tests/e2e/fullstack.test.ts` | Full-stack lifecycle E2E test |
| `tests/e2e/streaming.test.ts` | Streaming path E2E test |
| `tests/helpers/` | Shared mock server + provider test helpers |
| `package.json` | `"test:e2e"` script entry |

## Risks

```text
[ ] CI flake from port conflicts — mitigated by random port binding.
[ ] CI flake from async timing in streaming tests — mitigated by
    generous timeouts (30s per test).
[ ] E2E tests become slow — mitigated by keeping each test focused
    (single session cycle, not multi-session).
[ ] GitHub Actions runner clock skew — mitigated by bun
    test-timeout rather than wall-clock assertions.
```

## Validation Checklist

```text
[ ] GitHub Actions CI pipeline configured and triggers on push to main.
[ ] Pipeline runs bun test — all tests pass.
[ ] Pipeline runs bash scripts/test-health.sh — all checks pass.
[ ] Pipeline runs bun run typecheck in every workspace package.
[ ] Pipeline runs git diff --check — no whitespace errors.
[ ] Pipeline reports pass/fail status on PRs.
[ ] Full-stack E2E test covers: server start → health → provider route → SDK session → model response → shutdown.
[ ] Streaming E2E test validates: SSE subscription → stream_delta events → stream_complete → final persistence.
[ ] All E2E tests use mock providers, temp databases, random ports.
[ ] CI completes within 5 minutes for the full suite.
[ ] CI requires no secrets, API keys, or network access.
```

## Notes for Future Agents

Phase 17 is the first phase that adds zero source-package changes — all new
files are in `.github/` and `tests/e2e/`. This is intentional: CI and E2E
validation are quality infrastructure, not runtime features.

The E2E tests serve as regression detectors for future phases. When Phase 18
adds a new feature, the E2E tests should be extended to cover the new path
but should not be rewritten — the basic lifecycle and streaming tests should
continue to pass unchanged.
