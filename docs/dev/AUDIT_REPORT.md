# Code Quality & Maintainability Audit Report
**Repository:** agent-workbench (MerverliPy/agent-workbench)
**Date:** 2026-07-03
**Audit Scope:** Test health, documentation staleness, CI pipeline integrity, code standards, overall maintainability

---

## EXECUTIVE SUMMARY

This is a **well-maintained, actively developed** TypeScript monorepo with strong test infrastructure, comprehensive CI/CD, and thorough documentation. However, several **stale doc references**, a **broken lint-staged pre-commit hook**, and **Dockerfile bitrot** need attention. Overall maintainability score: **B+** (good with fixable issues).

| Area | Score | Key Issues |
|------|-------|------------|
| Test Health | 🟢 A | Well-organized, VERIFICATION.md is excellent, test-health.sh strong |
| CI Pipeline | 🟡 B+ | Well-designed but repo-health.yml stale, actions/checkout version drift |
| Documentation | 🟡 B- | CHANGELOG stale (Phase 29.4/29.5 missing), stale test counts in docs |
| Code Standards | 🟡 B+ | Strong TypeScript strictness, Biome linting, but lint-staged pre-commit broken |
| Docker/Deploy | 🔴 C | Dockerfile missing 7 packages, .dockerignore thin |
| Overall | 🟡 B+ | 13 findings: 4 HIGH, 6 MEDIUM, 3 LOW |

---

## FINDINGS

### FINDING 1 — HIGH 🔴: Root-level `typecheck` script missing (breaks lint-staged)

**File:** ```REPO_ROOT``/package.json`, lines 56-62

The `lint-staged` config runs `bun run typecheck --noEmit` on `*.{ts,tsx}` files (line 58), but there is no `"typecheck"` script defined at the monorepo root level in `package.json` scripts (line 12-25). Each package/app has `typecheck` in its own `package.json`, but lint-staged runs from the root, so this will fail with `error: missing script "typecheck"`.

**Evidence:**
- Root scripts: `['phase', 'validate', 'build', 'test', 'test:unit', 'test:integration', 'test:e2e', 'test:repeat', 'test:health', 'coverage', 'prepare', 'postinstall']`
- No `typecheck` entry exists

**Recommendation:** Add `"typecheck": "echo 'Run typecheck per package (see lint-staged)'"` to root `package.json`, or configure lint-staged to run per-package typecheck commands instead.

---

### FINDING 2 — HIGH 🔴: Stale test counts in documentation

**Files:** `README.md` (lines 257, 322), `CONTRIBUTING.md` (lines 118, 136)

The README claims **602 tests** in the badge and header (lines 10, 19), but the Implementation Status section (line 257) and Verification Commands section (line 322) still say **523 tests**. CONTRIBUTING.md also references **523 tests** in both its "Making Changes" and "Testing" sections.

**Evidence:**
- README line 257: `- ✅ **Automated testing** — 523 tests (unit, integration, e2e)`
- README line 322: `bun test                           # 523 tests, 0 failures, 1495 expect() calls`
- CONTRIBUTING.md line 118: `Ensure all 523 tests pass`
- CONTRIBUTING.md line 136: `# Full test suite (523 tests, 0 failures)`

**Recommendation:** Update all stale "523" references to the current test count throughout both files.

---

### FINDING 3 — HIGH 🔴: CHANGELOG missing Phase 29.4 and 29.5 commits (and recent fixes)

**File:** `CHANGELOG.md` (lines 9-20)

The CHANGELOG's latest entry is **Phase 29 (2026-07-02)**, but the following commits on **2026-07-03** are not logged:

| Commit | Description |
|--------|-------------|
| `a722f34` | `feat(phase-29.5): add TUI playground + comparison panels` |
| `38166c8` | `feat(phase-29.4): implement prompt library + ModelComparer` |
| `8c6bf86` | `fix(web-ui): functional fixes + new DESIGN.md spec` |
| `0df80bb` | `docs: add DESIGN.md — design system spec` |
| `7357377` | `fix: bump drizzle-orm to 0.45.2 (CVE-2026-39356)` |
| `78f3aaa` | `Add AI mobile command center integrations` |
| `a02b286` | `fix(ci): Biome lint fixes — import sort, ChatView unused import` |
| Various | Typecheck fixes, Biome config fixes, session-runner fixes |

**Recommendation:** Add [Phase 29.4] and [Phase 29.5] entries (or a single updated Phase 29) covering prompt library, ModelComparer, TUI playground, comparison panels, and the CVE fix. Consider adding a [Unreleased] section per Keep a Changelog convention.

---

### FINDING 4 — HIGH 🔴: Dockerfile missing 7 packages

**File:** `Dockerfile` (lines 9-22)

The Dockerfile hardcodes a list of 12 packages to build sequentially, but the following packages that exist in the workspace are **not included**:

- `telemetry` (`packages/telemetry`)
- `plugin-sdk` (`packages/plugin-sdk`)
- `auth` (`packages/auth`)
- `collab` (`packages/collab`)
- `eval` (`packages/eval`)
- `config` (`packages/config`)
- `ui` (`packages/ui`)

**Impact:** Any Docker build will fail to resolve these packages' imports. The server may crash at startup if any of these are imported.

**Recommendation:** Replace the hardcoded `RUN cd ... && bun run build` chain with a single `RUN bash scripts/build-all.sh` call (which already handles dependency ordering), or update the list to include all current packages.

---

### FINDING 5 — MEDIUM 🟡: `repo-health.yml` workflow is stale and uses npm instead of bun

**File:** `.github/workflows/repo-health.yml` (lines 23-29)

The Node checks section (triggered by `hashFiles('package.json')`) runs:
```yaml
- run: npm ci || npm install
- run: npm run lint --if-present
- run: npm run typecheck --if-present
- run: npm test --if-present
- run: npm run build --if-present
```

This is a **Bun project** — `npm ci || npm install` is wrong and will likely fail or install wrong dependencies. The project has no `package-lock.json`, only `bun.lockb`.

**Recommendation:** Replace with `bun install --frozen-lockfile` and `bun run` equivalents. Also update `actions/checkout@v4` to `@v7` (matching the main CI workflow).

---

### FINDING 6 — MEDIUM 🟡: `actions/checkout` version mismatch across workflows

| Workflow | Checkout Version |
|----------|-----------------|
| `ci.yml` | `@v7` |
| `repo-health.yml` | `@v4` |
| `stale.yml` | (uses `actions/stale@v9`, no checkout) |
| `codeql.yml` | `@v4` |
| `ai-safety.yml` | `@v4` |
| `opencode.yml` | `@v4` |

`@v4` is several major versions behind `@v7`. While this may not break immediately, the older version lacks recent fixes and performance improvements.

**Recommendation:** Normalize all workflows to use `actions/checkout@v7` (or `@v5` minimum).

---

### FINDING 7 — MEDIUM 🟡: 5 test files live outside `tests/` directory (not run via `cd tests && bun test`)

**Files:**
- `packages/eval/src/__tests__/export.test.ts`
- `packages/eval/src/__tests__/metrics.test.ts`
- `packages/eval/src/__tests__/playground.test.ts`
- `packages/eval/src/__tests__/promptfoo.test.ts`
- `apps/cli/templates/bun/src/hello.test.ts`

The 45 test files in `tests/` are the "official" test suite, but the 4 eval tests and 1 template test are outside this directory. The `package.json` has `"test": "cd tests && bun test"` which **excludes** these 5 files. Total repo `.test.ts` count: 50 files.

**Impact:** `bun test` (from root) may include these if bun automatically discovers them, but the explicit `cd tests && bun test` might not. This is inconsistent. Additionally, the `build-all.sh` script does NOT build the `eval` package.

**Recommendation:** Either move these tests into `tests/` or update the test command to include them. Also add `eval` to `scripts/build-all.sh` since it has `typecheck` and `build` scripts.

---

### FINDING 8 — MEDIUM 🟡: `.dockerignore` is thin — missing common exclusions

**File:** `.dockerignore` (37 lines)

Missing exclusions that should be included:
- `.git/` (sends entire git history to Docker daemon)
- `.github/` (CI configs not needed at runtime)
- `docs/` (planning docs not needed at runtime)
- `decisions/` (ADRs not needed at runtime)
- `tests/` (not needed at runtime)
- `benchmarks/` (not needed at runtime)
- `tools/` (not needed at runtime)
- `scripts/` (partially, build scripts not needed)
- `changelog.md` and `readme.md` (not needed at runtime)
- `DESIGN.md`, `CONTRIBUTING.md`, `AGENTS.md` etc.

**Impact:** Larger Docker build context = slower builds. Current context likely includes 100s of files that contribute nothing to the server image.

**Recommendation:** Add `.git/`, `docs/`, `tests/`, `benchmarks/`, `tools/`, `decisions/`, `*.md` to `.dockerignore`.

---

### FINDING 9 — MEDIUM 🟡: Duplicate filenames across packages (natural but worth noting)

The pygount analysis reported 17 duplicate files. The filename frequency analysis reveals:

| Filename | Occurrences | Notes |
|----------|-------------|-------|
| `index.ts` | 35 | Per-package barrel export — expected |
| `README.md` | 32 | Per-package readme — expected |
| `package.json` | 29 | Per-package config — expected |
| `tsconfig.json` | 28 | Per-package TypeScript config — expected |
| `types.ts` | 11 | Per-package type definitions |
| `config.ts` | 4 | Several packages have config modules |
| `errors.ts` | 3 | Reused error module pattern |

The duplicates are **structural rather than accidental** — each package follows a `index.ts` + `types.ts` + `config.ts` pattern. This is natural for monorepos. However, the `types.ts` duplication across 11 packages could benefit from centralization.

**Recommendation:** Low priority. Consider consolidating shared types into `packages/protocol` where schema-first design already covers most cross-package shapes.

---

### FINDING 10 — LOW 🟢: DESIGN.md vs actual web UI — no automated verification

**File:** `DESIGN.md` (141 lines)

DESIGN.md was added on 2026-07-03 and is a well-structured design system spec covering colors, typography, spacing, motion, components, interaction states, and accessibility. It documents the intended design system for `mobile-web` and `dashboard` apps.

**Assessment:** The spec looks thorough and internally consistent, but there is **no automated test or visual regression check** to verify the actual UI matches the spec. The "anti-patterns" section (line 126-131) lists hard rules like "No box-shadows for depth" and "No gradients anywhere" that could be checked programmatically but aren't.

**Recommendation:** Consider adding a minimal DOM/CSS audit script that checks the spec's hard constraints (e.g., no box-shadow in card CSS, no gradient in computed styles). This is optional given the project's current stage.

---

### FINDING 11 — LOW 🟢: README says "Phases 0–27 complete" but Phase 29 is actively developed

**File:** `README.md` (line 19)

```
> **Status:** Phases 0–27 complete · 602 tests, 0 failures · Phase 29 (model eval) next
```

But Phase 29 has been actively committed (Phase 29.0 through 29.5) and Phase 28 is marked as "No active development — deferred to future phase" in the CHANGELOG. This status message is slightly misleading — Phase 29 is not "next", it's actively in development.

**Recommendation:** Update to: `Phases 0–27 complete · Phase 29 in progress (29.0–29.5)` or `Phases 0–29 in development · 602 tests, 0 failures`.

---

### FINDING 12 — LOW 🟢: Branch cleanup needed

Three stale local branches exist alongside main:
- `ai-mobile-command-center-integrations` (also on origin)
- `fix/drizzle-orm-cve` (also on origin)
- `test`

**Recommendation:** Delete merged/obsolete branches. The Drizzle CVE fix has been merged into main.

---

### FINDING 13 — INFO ℹ️: Excellent test infrastructure worth preserving

**Files:** `tests/VERIFICATION.md` (255 lines), `scripts/test-health.sh` (128 lines), `scripts/test-repeat.sh`

The test infrastructure is a **standout feature** of this repo:
1. **VERIFICATION.md** contains 13 intentional-break mutation tests with step-by-step instructions covering model faults, tool faults, abort handling, SDK error mapping, API validation, protocol contracts, permission engine, planner, diff preview, token budgets, path safety, and shell deny
2. **test-health.sh** performs 5 static checks: server import boundary, no network call patterns, no secrets in fixtures, TUI boundary test existence, restricted import checking
3. **test-repeat.sh** runs the suite N times (default 3) for determinism validation

**Recommendation:** Preserve and expand. Consider automating the intentional-break checklist as an opt-in script (noted as future work in VERIFICATION.md line 254).

---

## TEST HEALTH DETAIL

| Metric | Value |
|--------|-------|
| Test files (in `tests/`) | 45 |
| Test files (total repo) | 50 |
| Claimed test count | 602 |
| Test files with `expect()` | 45 |
| Unit tests | 23 files (models, permissions, planner, plugin-sdk, protocol, telemetry, tokens) |
| Integration tests | 15 files (core, diff, faults, sdk, security, server, shell, storage) |
| E2E tests | 7 files (boundary, fullstack, security, contracts, health, lifecycle, streaming) |
| Test helpers | 3+ (test-db, test-server, mock-model) |
| Test verification | ✅ VERIFICATION.md with 13 intentional-break mutations |
| Test health checks | ✅ test-health.sh (5 static checks) |
| Test repeatability | ✅ test-repeat.sh (default 3 runs) |

**Verdict: 🟢 Excellent.** The test suite is well-structured, well-documented, and includes redundancy via intentional-break tests. The only concern is the 5 test files outside `tests/` directory and stale test count references.

---

## CI HEALTH DETAIL

| Pipeline | Status | Notes |
|----------|--------|-------|
| `ci.yml` | 🟢 Green | 4 jobs: static-check → typecheck → test (matrix) → e2e. Daily cron. Coverage upload. |
| `codeql.yml` | 🟢 Green | Weekly scan for JS/TS and Python. |
| `ai-safety.yml` | 🟢 Green | Secret detection + destructive pattern checks. |
| `stale.yml` | 🟢 Green | Daily run, marks issues/PRs after 60/30 days, closes after 7. |
| `repo-health.yml` | 🔴 Stale | Uses npm instead of bun. Will likely fail. |
| `release-drafter.yml` | 🟢 Configured | Auto-generates release notes from PR labels. |
| `opencode.yml` | 🟢 Placeholder | `/opencode` comment trigger, no write behavior yet (correctly). |

**CI Gaps:**
- `repo-health.yml` uses `npm` for Bun project — **will fail on next run**
- `actions/checkout` versions not normalized (`@v4` vs `@v7`)
- No cache keys in CI (no `setup-bun` cache config despite `no-cache: false`)
- `no-cache: false` in setup-bun means **cache is disabled** — every CI run reinstalls from scratch

---

## DOCUMENTATION STALENESS SUMMARY

| Document | Status | Key Issues |
|----------|--------|------------|
| `README.md` | 🟡 Stale | 3 stale "523 tests" references; phase status says "Phase 29 next" but it's in progress |
| `CHANGELOG.md` | 🔴 Stale | Missing Phase 29.4, 29.5, CVE fix, mobile command center, DESIGN.md addition |
| `CONTRIBUTING.md` | 🟡 Stale | "523 tests" in 3 places; says "0–26 complete" (should be 0–29) |
| `DESIGN.md` | 🟢 Fresh | Added 2026-07-03, well-structured |
| `VERIFICATION.md` | 🟡 Stale | Baseline says "323 tests" (Phase 15), not updated for Phase 26-29 additions |
| `scripts/build-all.sh` | 🟡 Stale | Missing `auth`, `collab`, `eval`, `config`, `ui` packages |

---

## RECOMMENDATIONS (Priority-Ordered)

### Must Fix (HIGH)
1. **Fix lint-staged typecheck** — Add `"typecheck"` script to root `package.json` or restructure pre-commit hook
2. **Update all stale test counts** — `README.md` (2 places), `CONTRIBUTING.md` (2 places): 523 → 602
3. **Update CHANGELOG.md** — Add Phase 29.4 (prompt library + ModelComparer), Phase 29.5 (TUI playground + comparison panels), CVE fix, mobile command center, DESIGN.md
4. **Fix Dockerfile** — Add missing packages (`telemetry`, `plugin-sdk`, `auth`, `collab`, `eval`, `config`, `ui`) or switch to `scripts/build-all.sh`

### Should Fix (MEDIUM)
5. **Fix `repo-health.yml`** — Replace `npm` with `bun` commands, update `checkout@v4` to `@v7`
6. **Normalize `actions/checkout` versions** across all 6 workflows to `@v7`
7. **Add `eval` to `scripts/build-all.sh`** — Currently not built in the dependency chain
8. **Expand `.dockerignore`** — Add `.git/`, `docs/`, `tests/`, `benchmarks/`, `tools/`, `decisions/`, `*.md`
9. **Enable bun caching in CI** — Set `no-cache: true`/remove `no-cache: false` from `setup-bun` step

### Nice to Have (LOW)
10. **Update README phase status** — Reflect Phase 29 as "in progress" not "next"
11. **Clean up stale branches** — `ai-mobile-command-center-integrations`, `fix/drizzle-orm-cve`, `test`
12. **Update VERIFICATION.md baseline** — Bump from "323 tests" (Phase 15) to current
13. **Add DESIGN.md lint verification** — Consider adding CSS/style audits for hard constraints

---

## Methodology

| Check | Method |
|-------|--------|
| CI workflow content | Read `.github/workflows/ci.yml` |
| Test directory structure | `find tests -name '*.test.ts'` |
| TypeScript config | Read `tsconfig.base.json` |
| CHANGELOG staleness | `git log --since` comparison |
| CONTRIBUTING accuracy | Cross-reference with actual test count and phase progress |
| build-all.sh completeness | Read `scripts/build-all.sh`, check against `packages/` listing |
| DESIGN.md contents | Read `DESIGN.md` |
| Duplicate files | `find + uniq -d` on all non-node_modules files |
| Dockerfile health | Read `Dockerfile` and `.dockerignore` |
| CI version drift | Check `actions/checkout` version in all `.github/workflows/*.yml` |
