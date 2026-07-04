# 🔍 agent-workbench — Comprehensive Multi-Perspective Audit

**Date:** 2026-07-03  
**Methodology:** Mixture of Agents (3 parallel subagents)  
**GitHub:** [MerverliPy/agent-workbench](https://github.com/MerverliPy/agent-workbench)  
**Local Path:** `/home/calvin/agent-workbench`  

---

## Executive Summary

| Dimension | Grade | Verdict |
|-----------|-------|---------|
| 🛡️ **Security & Dependencies** | 🟢 **A-** | Good posture, no HIGH findings. Fixed CVE-2026-39356. MEDIUM gaps in Dependabot coverage and CODEOWNERS. |
| 🏗️ **Architecture & Design Integrity** | 🟡 **B** | Strong protocol adherence but a HIGH boundary violation (TUI→eval) and stale docs missing 5 apps + 5 packages. |
| 📊 **Code Quality & Maintainability** | 🟡 **B+** | Excellent test infrastructure but broken pre-commit, stale doc references, Dockerfile bitrot. |

**Overall: B+ (good with actionable gaps)** — 6 HIGHs, 11 MEDIUMs, 6 LOWs. No critical security vulnerabilities. The repo is actively developed and well-structured; the issues found are largely documentation drift and configuration gaps from rapid iteration.

---

## CROSS-CUTTING FINDINGS

These findings appear in multiple audit perspectives:

| # | Issue | Affects | Severity |
|---|-------|---------|----------|
| C1 | **Stale `AGENTS.md`** — missing 5 apps (cli, dashboard, mobile-web) + 5 packages (auth, collab, eval, telemetry, plugin-sdk) | Architecture doc drift, unclear boundaries for new contributors | **HIGH** |
| C2 | **Stale `docs/02_ARCHITECTURE.md`** — same missing apps/packages, dead diagram | Architecture doc drift | **MEDIUM** |
| C3 | **`repo-health.yml` uses npm** on a Bun project — will fail | CI reliability | **MEDIUM** |
| C4 | **`actions/checkout` version drift** — `@v4` in 4 workflows vs `@v7` in CI | CI consistency | **MEDIUM** |
| C5 | **`scripts/build-all.sh` missing packages** — no `eval`, `auth`, `collab`, `config`, `ui`, `telemetry`, `plugin-sdk` | Build reliability | **HIGH** |

---

## 🔴 HIGH SEVERITY FINDINGS (6 total)

| # | Finding | Category | File(s) | Recommendation |
|---|---------|----------|---------|---------------|
| H1 | **TUI imports `@agent-workbench/eval`** violating declared AGENTS.md boundary. TUI should only import sdk/protocol/events/ui per docs, but `PlaygroundPanel.tsx` and `ComparisonPanel.tsx` import directly from eval. | Architecture | `apps/tui/package.json`, `apps/tui/src/components/panels/PlaygroundPanel.tsx`, `ComparisonPanel.tsx` | Either update AGENTS.md to allow eval in TUI, or refactor eval panels to communicate through the SDK/server |
| H2 | **Lint-staged pre-commit hook broken** — `bun run typecheck --noEmit` configured in `lint-staged` but no `typecheck` script exists at root level | Code Quality | `package.json` lines 56-62 | Add `"typecheck"` script to root `package.json` or restructure pre-commit hook |
| H3 | **Stale test counts** — README.md and CONTRIBUTING.md reference "523 tests" in 5 places (badge says 602) | Documentation | `README.md` lines 257, 322; `CONTRIBUTING.md` lines 118, 136 | Update all stale "523" → "602" references |
| H4 | **CHANGELOG stale** — Missing Phase 29.4 (prompt library + ModelComparer), 29.5 (TUI playground + comparison panels), CVE fix, mobile command center, DESIGN.md additions | Documentation | `CHANGELOG.md` | Add [Phase 29.4], [Phase 29.5] entries + CVE fix |
| H5 | **Dockerfile missing 7 packages** — telemetry, plugin-sdk, auth, collab, eval, config, ui not in build chain. Docker build will fail. | Build/Deploy | `Dockerfile` | Replace hardcoded list with `RUN bash scripts/build-all.sh` or update to include all packages |
| H6 | **`scripts/build-all.sh` missing `eval` package** — 4 test files exist but package never built. Also missing: auth, collab, config, ui, telemetry, plugin-sdk | Build | `scripts/build-all.sh` | Add `eval` (and other missing packages) to the build chain |

---

## 🟡 MEDIUM SEVERITY FINDINGS (11 total)

| # | Finding | Category | File(s) | Recommendation |
|---|---------|----------|---------|---------------|
| M1 | **Dependabot only scans root `package.json`** — 25+ workspace package.json files never scanned for vulnerabilities | Security | `.github/dependabot.yml` | Add per-workspace npm entries or use Bun audit in CI |
| M2 | **CODEOWNERS references non-existent paths** — `src/auth/*` and `src/security/*` don't exist; actual paths are `packages/auth/` and `packages/permissions/` | Security | `.github/CODEOWNERS` | Fix paths to actual package locations |
| M3 | **`bun audit` reports 3 advisories** — esbuild (MODERATE, dev server forgery), opentelemetry (MODERATE, unbounded memory), babel (LOW, file read) | Dependencies | `bun.lock` (transitive) | Run `bun update` to pick up patched versions |
| M4 | **Biome has no security rules** — `suspicious/noExplicitAny` and `complexity/noBannedTypes` explicitly skipped; no security-specific linting | Code Quality | `biome.json`, `.github/workflows/ci.yml` | Audit and re-enable skipped rules; consider ESLint overlay for security rules |
| M5 | **AGENTS.md incomplete** — missing 5 apps (cli, dashboard, mobile-web) + 5 packages (auth, collab, eval, telemetry, plugin-sdk, config) from boundary documentation | Architecture | `AGENTS.md` | Update to list all 5 apps and 20 packages |
| M6 | **`docs/02_ARCHITECTURE.md` stale** — diagram and package model missing recent additions | Architecture | `docs/02_ARCHITECTURE.md` | Regenerate to match actual codebase |
| M7 | **`packages/ui` is a dead package** — declared in docs but has zero deps, zero exports, zero consumers | Architecture | `packages/ui/` | Implement shared primitives or remove from doc |
| M8 | **`packages/config` has no source files** — empty workspace shell | Architecture | `packages/config/` | Implement or remove |
| M9 | **5 test files live outside `tests/` directory** — not covered by `cd tests && bun test` command | Testing | `packages/eval/src/__tests__/*`, `apps/cli/templates/bun/src/hello.test.ts` | Move into `tests/` or update test command |
| M10 | **`.dockerignore` is thin** — missing `.git/`, `docs/`, `tests/`, `benchmarks/`, `tools/`, `decisions/`, `*.md` | Build/Deploy | `.dockerignore` | Add common exclusions for faster builds |
| M11 | **CI cache disabled** — `setup-bun` has `no-cache: false` meaning dependencies reinstalled every run | CI | `.github/workflows/ci.yml` | Enable bun caching by removing `no-cache: false` |

---

## 🟢 LOW SEVERITY FINDINGS (6 total)

| # | Finding | Category | Recommendation |
|---|---------|----------|---------------|
| L1 | **No local pre-commit secret scanning** — `ai-safety.yml` scans on push but nothing catches secrets before commit | Security | Add lightweight `pre-commit` grep for API key patterns |
| L2 | **SECURITY.md marks CI as "out of scope"** for disclosure policy | Security | Consider acknowledging CI as in-scope |
| L3 | **`opencode.yml` grants broad write permissions** (contents/pull-requests/issues: write) | Security | Restrict to minimum needed when implementation is filled in |
| L4 | **`packages/plugin-sdk` uses zod `^4.0.0`** while rest of repo uses `^4.4.3` | Consistency | Normalize zod version |
| L5 | **README phase status says "Phase 29 next"** but it's actively in development | Documentation | Update to reflect current phase |
| L6 | **VERIFICATION.md baseline says "323 tests"** (Phase 15 era) | Documentation | Update to current test count |

---

## ✅ STRENGTHS & POSITIVE FINDINGS

### Security
- 🔒 **CVE-2026-39356 (drizzle-orm)**: Fixed to 0.45.2 with overrides across all workspaces
- 🔒 **No secrets in git history**: Only `.env.example` ever committed
- 🔒 **No live `.env` files**: Properly gitignored
- 🔒 **SECURITY.md**: Clear 48h/90-day disclosure policy
- 🔒 **Security model docs**: Thorough threat models in `docs/` (05/06)
- 🔒 **ai-safety.yml**: Excellent secret + destructive-pattern scanning on every push
- 🔒 **codeql.yml**: Weekly JS/TS + Python analysis
- 🔒 **Permission model**: read=allow, edit/bash=ask, destructive=deny — excellent defaults

### Architecture
- ✅ **Protocol contracts = single source of truth**: Route contracts defined in protocol, consumed by SDK + Server + OpenAPI
- ✅ **SDK validates responses**, not blind casts — `safeParse()` everywhere
- ✅ **SSE validates event envelopes** — malformed events never silently swallowed
- ✅ **No TUI imports from core/tools/shell/storage/permissions/models** (except eval, see H1)
- ✅ **OpenAPI generated from Zod schemas** — 17 route contracts registered
- ✅ **Permission engine**: Stateless, deterministic, no side effects per design
- ✅ **Decision 0013 (pre-run planner)**: Fully implemented with PlanGate
- ✅ **Decision 0015 (dry-run)**: Partially implemented with diff previews + shell previews
- ✅ **CoreDependencies**: Clean DI pattern, no global storage imports

### Code Quality
- ✅ **Excellent test infrastructure**: 45 test files (unit/integration/e2e), VERIFICATION.md with 13 intentional-break mutation tests
- ✅ **test-health.sh**: 5 static checks for boundary enforcement
- ✅ **test-repeat.sh**: Determinism validation (3 runs default)
- ✅ **TypeScript strict mode**: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- ✅ **Comprehensive CI**: 4-job pipeline (static → typecheck → test matrix → e2e) + cron
- ✅ **Active Dependabot**: Package + GitHub Actions updates
- ✅ **Biome linting + Husky pre-commit hooks**
- ✅ **Well-structured monorepo**: Clean package boundaries, consistent naming

---

## 🔷 PRIORITIZED ACTION PLAN

### 🚨 Immediate (First Sprint)
| # | Effort | Action | Repo |
|---|--------|--------|------|
| 1 | 2 min | Fix CODEOWNERS paths (`src/auth/*` → `packages/auth/*`) | Security |
| 2 | 5 min | Update stale test counts (README, CONTRIBUTING: 523→602) | Docs |
| 3 | 5 min | Update CHANGELOG with Phase 29.4/29.5, CVE fix | Docs |
| 4 | 10 min | Fix lint-staged — add `typecheck` script to root `package.json` | Build |
| 5 | 10 min | Fix Dockerfile — replace hardcoded list with `scripts/build-all.sh` | Build |
| 6 | 15 min | Expand Dependabot to cover workspace packages | CI |

### 📋 Second Sprint
| # | Effort | Action | Repo |
|---|--------|--------|------|
| 7 | 5 min | Run `bun update` — fix esbuild + opentelemetry advisories | Dependencies |
| 8 | 15 min | Update `AGENTS.md` — add all 5 apps + 20 packages with boundaries | Architecture |
| 9 | 15 min | Update `docs/02_ARCHITECTURE.md` — regenerate diagram | Architecture |
| 10 | 15 min | Update `scripts/build-all.sh` — add missing packages | Build |
| 11 | 15 min | Fix `repo-health.yml` — use bun not npm | CI |
| 12 | 15 min | Normalize `actions/checkout@v4` → `@v7` across workflows | CI |

### 🧹 Third Sprint
| # | Effort | Action | Repo |
|---|--------|--------|------|
| 13 | 30 min | Decide: refactor TUI-eval or update AGENTS.md | Architecture |
| 14 | 30 min | Add security Biome rules or ESLint overlay | Code Quality |
| 15 | 15 min | Expand `.dockerignore` | Build |
| 16 | 10 min | Enable bun caching in CI | CI |
| 17 | 15 min | Move eval tests into `tests/` directory | Testing |
| 18 | 10 min | Either implement `packages/ui` or remove from docs | Architecture |
| 19 | 10 min | Clean up stale branches | Git |

---

## METHODOLOGY

- **3 parallel subagents** — each had full repo context and independently examined all source files, docs, configs, and CI workflows
- **Total files examined**: 44 (arch), ~30 (security), ~50 (code quality)
- **Verification steps**: grep for cross-package imports, `bun audit`, git log analysis, file count comparisons, workflow YAML parsing
- **All reports saved to disk**:
  - `.ai/master-audit-report.md` ← this file (consolidated)
  - `.ai/architecture-audit-report.md` (architecture deep-dive)
  - `AUDIT_REPORT.md` (in repo root — code quality)
  - `AUDIT_REPORT.md` (in workspace — security)

---

*Generated by Hermes Agent — Mixture of Agents audit. 3 specialists, 246s total runtime.*
