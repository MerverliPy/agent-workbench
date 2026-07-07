# Architecture & Design Integrity Audit — agent-workbench

**Date:** 2026-07-07
**Audit Scope:** Architecture boundaries, package dependency integrity, dead code detection, protocol adherence, design debt, structural risks
**Method:** Full static analysis of 5 apps, 20 packages, 21 package.json files, documentation, Dockerfile, build scripts, and source code imports

---

## EXECUTIVE SUMMARY

agent-workbench is a **well-structured** TypeScript/Bun monorepo with clear architecture boundaries, a strong DI pattern (CoreDependencies), and a solid protocol-first design (Zod schemas → route contracts → SDK consumption). The prior audit's HIGH findings (Dockerfile package omissions) have been **fixed** — the Dockerfile now uses `COPY packages/ packages/` wildcard + `scripts/build-all.sh`.

However, **5 new HIGH-severity issues** emerged: two dead packages (`packages/config`, `packages/ui`) that are listed as full citizens in architecture docs but have zero implementation and zero consumers; the dashboard app that doesn't actually connect via SDK (contradicting AGENTS.md); and a boundary test that's inconsistent with AGENTS.md. Two architectural docs are stale — one still claiming "Phase 0" status, another using future tense for already-shipped capabilities.

| Area | Score | Key Issues |
|------|-------|------------|
| Architecture Boundaries | 🟡 B | Clear layering, but 2 dead packages listed as full citizens |
| Package Dependency Integrity | 🟡 B+ | Version drift in `drizzle-orm` (^0.45.0 vs ^0.45.2), `zod` (^4.0.0 vs ^4.4.3) |
| Protocol Adherence | 🟢 A- | Zod-first route contracts consistent, 15 route files, excellent pattern |
| Documentation Freshness | 🟡 C+ | Multiple stale docs, unchecked acceptance criteria, Phase 0 status header |
| Docker/Deploy | 🟡 B | Dockerfile fixed, but now breaks on mobile-web build (not copied) |
| Dead Code / Shell Packages | 🔴 D | 2 dead packages, 1 empty-shell dashboard, 1 unused dependency |
| Design Debt | 🟡 B | Clean DI, good separation, minor structural risks |
| **Overall** | **🟡 B-** | **16 findings: 5 HIGH, 7 MEDIUM, 4 LOW** |

---

## HIGH SEVERITY FINDINGS

### H1 — `packages/config` is a dead shell with zero consumers  🔴

**Files:**
- `/home/calvin/agent-workbench/packages/config/src/index.ts` (line 1-2): `// Scaffold-only — no runtime implementation yet.` / `export {};`
- `/home/calvin/agent-workbench/packages/config/package.json`: Has `typecheck` script, no build script, no dependencies
- `/home/calvin/agent-workbench/packages/config/src/.gitkeep`: Empty marker file

**Evidence:**
- Zero `import ... from "@agent-workbench/config"` occurrences in any `.ts` file across the entire repo
- The only reference to `@agent-workbench/config` is in its own `README.md`
- The `src/index.ts` is an empty barrel export (`export {};`)
- AGENTS.md (line 49) lists it with a full responsibility description: "Layered config loading from env, files, and CLI args."
- `scripts/build-all.sh` does NOT build it (line 10: Level 0 lists protocol, models, storage, tokens, diff, telemetry, plugin-sdk, auth, compliance — no `config`)

**Impact:** Architecture doc declares a package that doesn't exist functionally. Any new developer reading AGENTS.md will expect layered config resolution that hasn't been implemented. The `src/.gitkeep` suggests the intent was to eventually fill it.

**Recommendation:** Either (a) implement the promised config loading, (b) remove from AGENTS.md and ARCHITECTURE.md and delete the package, or (c) clearly mark as "planned, not implemented" in all docs.

---

### H2 — `packages/ui` is a dead shell with zero consumers  🔴

**Files:**
- `/home/calvin/agent-workbench/packages/ui/src/index.ts` (line 1-2): `// Scaffold-only — no runtime implementation yet.` / `export {};`
- `/home/calvin/agent-workbench/packages/ui/package.json`: Only has `typecheck`, no dependencies

**Evidence:**
- Zero `import ... from "@agent-workbench/ui"` occurrences in any `.ts` file across the entire repo (the only hit is in `tests/e2e/boundary-tui-imports.test.ts` line 18 which lists it in an allowed-packages array — not an actual import)
- AGENTS.md (line 42): "packages/ui: shared UI primitives only."
- `scripts/build-all.sh` does NOT build it
- The TUI app (`apps/tui`) does NOT import from `@agent-workbench/ui` — it imports directly from `@agent-workbench/eval`, `@agent-workbench/sdk`, `@agent-workbench/protocol`
- The README at `/home/calvin/agent-workbench/packages/ui/README.md` shows hypothetical usage (`import { formatTimestamp, truncatePath } from "@agent-workbench/ui"`) that doesn't exist

**Impact:** Same as H1 — documentation promises shared UI primitives that don't exist. The TUI app had to implement its own UI rendering without shared abstractions.

**Recommendation:** Either (a) implement shared UI primitives and migrate TUI to use them, (b) remove from AGENTS.md/ARCHITECTURE.md and delete the dead package.

---

### H3 — `apps/dashboard` does NOT connect via SDK (contradicts AGENTS.md)  🔴

**File:** `/home/calvin/agent-workbench/apps/dashboard/package.json` (lines 13-14)
```
"dependencies": {
    "solid-js": "^1.9.12"
}
```

**Evidence:**
- Zero imports from any `@agent-workbench/*` package in `apps/dashboard/src/` (confirmed via search: `import.*@agent-workbench` returns 0 results)
- Dashboard has its own local `./types.ts` with `DashboardData` type — no protocol schema consumption
- The `package.json` only depends on `solid-js` — no SDK, no protocol, no connection to the agent-workbench server
- AGENTS.md (line 28): "apps/dashboard: observability dashboard (SolidJS + Tailwind, connects via SDK)."

**Impact:** The dashboard as described in AGENTS.md is a connected observability dashboard that displays session/performance data from the server via the SDK. The actual implementation is a disconnected standalone SolidJS app. Either the documentation is wrong, or the implementation is incomplete.

**Recommendation:** Either (a) implement SDK connectivity so the dashboard actually connects to the server for live data, or (b) update AGENTS.md to describe the dashboard as a standalone static app.

---

### H4 — Boundary TUI import test disagrees with AGENTS.md (`eval` not allowed)  🔴

**File:** `/home/calvin/agent-workbench/tests/e2e/boundary-tui-imports.test.ts` (lines 14-19)
```typescript
const _ALLOWED_PACKAGES = [
  "@agent-workbench/protocol",
  "@agent-workbench/sdk",
  "@agent-workbench/events",
  "@agent-workbench/ui",
];
```

**Evidence:**
- AGENTS.md (line 52): "TUI may import packages/sdk, packages/protocol, packages/events, packages/ui, and **packages/eval**."
- The test's allowed list is missing `@agent-workbench/eval` — this is a stale allowlist that hasn't been updated since eval was added as a permitted import
- The test only checks restricted packages (core, tools, shell, storage, permissions) — but the allowed list is out of sync with AGENTS.md as the architectural authority
- The TUI already imports from eval: `apps/tui/src/components/panels/PlaygroundPanel.tsx` (line 1: `import { ModelPlayground } from "@agent-workbench/eval"`), `apps/tui/src/components/panels/ComparisonPanel.tsx` (line 1: `import { ModelComparer } from "@agent-workbench/eval"`)

**Impact:** The test passes (it only checks restricted packages), but the semantics are wrong — the `_ALLOWED_PACKAGES` constant is a stale fiction that doesn't match the architecture doc. This erodes trust in the test as an architectural boundary enforcement mechanism.

**Recommendation:** Update `_ALLOWED_PACKAGES` in `tests/e2e/boundary-tui-imports.test.ts` to include `@agent-workbench/eval` and potentially add a positive assertion that TUI only imports from the allowed set.

---

### H5 — `docs/02_ARCHITECTURE.md` is stale (Phase 0 header, missing Phase 29/30 details)  🔴

**File:** `/home/calvin/agent-workbench/docs/dev/02_ARCHITECTURE.md`

**Evidence:**
- Line 3: `Status: Phase 0 — Planning Docs` — **Incorrect.** Phases 0–30 are complete.
- Phase dependency section (lines 480-493) only goes up to Phase 12 — completely missing Phases 13-30
- Section 3 "Core Architectural Rule" doesn't mention the enterprise packages (compliance, telemetry, plugin-sdk) that are now core parts of the architecture
- The mermaid diagram (lines 15-64) does include the newer packages (compliance, telemetry, etc.), but the text below doesn't describe their boundaries
- Architecture Acceptance Criteria (lines 499-509) are entirely unchecked (`[ ]`)
- Open Questions (lines 526-532) include 5 items marked Unresolved/Deferred that should have been resolved by Phase 30

**Impact:** The primary architecture reference document is misleading. A new developer reading it gets a Phase 0 picture of the system, missing 18+ phases of architectural evolution.

**Recommendation:** Update `docs/02_ARCHITECTURE.md`: set Status to "Phase 30 complete", update phase dependencies through Phase 30, describe boundary responsibilities for `compliance`, `telemetry`, `plugin-sdk`, `auth`, `collab`, and `eval` in dedicated subsections. Resolve or remove the Open Questions.

---

## MEDIUM SEVERITY FINDINGS

### M1 — Dockerfile doesn't copy `apps/mobile-web/` but `build-all.sh` tries to build it  🟡

**File:** `/home/calvin/agent-workbench/Dockerfile` (lines 4-7)
```
COPY packages/ packages/
COPY apps/server/ apps/server/
COPY apps/cli/ apps/cli/
COPY scripts/ scripts/
```

**File:** `/home/calvin/agent-workbench/scripts/build-all.sh` (lines 46-47)
```
echo "  [build] apps/mobile-web"
(cd "$ROOT/apps/mobile-web" && bun run build 2>&1) || exit 1
```

**Evidence:**
- Dockerfile does NOT copy `apps/mobile-web/` or `apps/dashboard/` or `apps/tui/`
- build-all.sh attempts to build `apps/mobile-web` (line 47)
- `apps/mobile-web` requires `@agent-workbench/protocol` and `@agent-workbench/sdk` as dependencies (from its `package.json`) — but these are packages, which ARE copied, so the issue is the source code not being present
- The pre-existing Dockerfile only needed server + cli, but build-all.sh unconditionally tries to build mobile-web

**Impact:** `docker build` will fail at the `apps/mobile-web` build step because the source directory doesn't exist in the build context. The Docker build is broken.

**Recommendation:** Either (a) add `COPY apps/mobile-web/ apps/mobile-web/` to Dockerfile, (b) or skip mobile-web build in Docker context by making build-all.sh check directory existence, (c) or split build-all.sh into a focused `DOCKER_BUILD=1` mode.

---

### M2 — `drizzle-orm` version drift across workspace  🟡

| File | Version |
|------|---------|
| `package.json` (root, line 69) | `^0.45.2` |
| `package.json` (root override, line 53) | `^0.45.2` |
| `packages/eval/package.json` (line 23) | `^0.45.2` |
| `packages/storage/package.json` (line 22) | `^0.45.0` |

**Evidence:**
- `packages/storage` uses `^0.45.0` while the root override mandates `^0.45.2`
- Since the root override exists, `bun install` should resolve to `0.45.2` for storage too via the override mechanism — but the explicit `^0.45.0` is confusing and implies the developer intended a specific version

**Impact:** Low runtime risk due to the root override catching it, but adds confusion. If the override is ever removed, storage could install a different version than eval.

**Recommendation:** Normalize storage to `^0.45.2` to match root and eval.

---

### M3 — `plugin-sdk` uses `zod "^4.0.0"` while other packages use `"^4.4.3"`  🟡

**File:** `/home/calvin/agent-workbench/packages/plugin-sdk/package.json` (line 20)
```json
"zod": "^4.0.0"
```

**Evidence:**
- All other packages using zod (`protocol`, `sdk`, `tools`, `server`, `tests`) use `"^4.4.3"`
- The `^4.0.0` constraint is much looser — it would accept any zod 4.x version
- Since this is a monorepo, bun should resolve to a single version via hoisting, but the loose constraint risks accidental breaking changes if a newer zod 4.x is resolved

**Impact:** Low risk in practice (hoisting), but inconsistent version constraints suggest a lack of coordinated dependency management.

**Recommendation:** Update `packages/plugin-sdk/package.json` zod to `"^4.4.3"` to match the rest of the workspace.

---

### M4 — `scripts/build-all.sh` doesn't build `config` or `ui` (still missing from prior audit)  🟡

**File:** `/home/calvin/agent-workbench/scripts/build-all.sh` (lines 10-13)
```
# Level 0: no @agent-workbench dependencies
for pkg in protocol models storage tokens diff telemetry plugin-sdk auth compliance; do
```

**Evidence:**
- `config` and `ui` are not in the Level 0 build list
- Both have `typecheck` scripts but no `build` script in their `package.json`
- They are dead shells (see H1, H2) so this has no runtime impact
- But AGENTS.md and ARCHITECTURE.md list them as full packages

**Impact:** If `config` or `ui` ever get actual implementation, build-all.sh will not build them. New developers may assume they're intentionally excluded.

**Recommendation:** Add `config` and `ui` to Level 0 in build-all.sh (they're dependency-free), and add `"build": "tsc"` scripts to their `package.json` files even if the source is empty.

---

### M5 — `packages/compliance` has no README.md  🟡

**Evidence:**
- Every other package has a README.md (protocol, sdk, core, events, storage, permissions, tools, shell, diff, tokens, cache, planner, models, auth, collab, eval, telemetry, plugin-sdk, config, ui)
- `packages/compliance` has no README.md — `stat` confirms file not found
- It has 10 source files, 3 test files, and 4 exported modules (audit, pii-scanner, fips, airgap) — it's a fully functional package, just undocumented at the package level
- The compliance docs live in `docs/compliance/` (4 documents) rather than in-package

**Impact:** Inconsistent. Developers exploring the monorepo at the package level won't find package-local docs for compliance.

**Recommendation:** Add a minimal `packages/compliance/README.md` describing the package's exports and purpose, or update files to ensure discoverability.

---

### M6 — `apps/dashboard` has no `@agent-workbench` dependencies despite AGENTS.md claiming SDK connectivity  🟡

**File:** `/home/calvin/agent-workbench/apps/dashboard/package.json` (lines 13-15)

**Evidence:**
- Dashboard's `package.json` only depends on `solid-js`
- Zero imports from any `@agent-workbench/*` package
- AGENTS.md (line 28): "apps/dashboard: observability dashboard (SolidJS + Tailwind, connects via SDK)."
- The docs claim the dashboard connects via SDK, but the actual implementation does not

**Impact:** Combined with H3, this reinforces that the dashboard is either incomplete or the docs are wrong. If a developer adds SDK connectivity later, they'll need to add the dependency.

**Recommendation:** Same as H3 — either implement SDK connectivity or update architecture docs.

---

### M7 — `docs/06_SECURITY_MODEL.md` uses future tense for already-shipped capabilities  🟡

**File:** `/home/calvin/agent-workbench/docs/06_SECURITY_MODEL.md` (lines 5-8)
```
The system executes in a local developer environment and may eventually read files,
edit files, run shell commands, and call model providers. These capabilities are
powerful and must be constrained by default.
```

**Evidence:**
- "may eventually read files" — file reading is implemented in `packages/tools`
- "edit files" — file mutation is implemented in `packages/diff` and `packages/tools`
- "run shell commands" — shell execution is implemented in `packages/shell`
- "call model providers" — model provider integration is implemented in `packages/models`
- All of these capabilities are fully implemented and shipped through Phase 30

**Impact:** The security model document reads like a planning document, not a descriptive architecture doc. A new developer won't know which parts are implemented vs. aspirational.

**Recommendation:** Update to present tense: "The system reads files, edits files, runs shell commands, and calls model providers. These capabilities are constrained by default."

---

## LOW SEVERITY FINDINGS

### L1 — `docs/27_PROJECT_ROADMAP.md` says "Phase 30 next" but Phase 30 is complete  🟢

**File:** `/home/calvin/agent-workbench/docs/27_PROJECT_ROADMAP.md` (line 3)
```
Status: Phase 29 complete — Phase 30 (enterprise readiness) next
```

**Evidence:**
- Line 25: `Phase 30 ✅ complete ██████████████████████  enterprise readiness & compliance`
- Line 35: `| **Long-term** | 29–30 | 3–4 months |` — Phase 30 is complete in 1-2 days, not 3-4 months

**Impact:** Minor inconsistency. The header says "Phase 30 next" while the progress bar says "complete." The timeline estimate is also stale.

**Recommendation:** Update header to `Phase 30 complete`. Consider updating the timeline estimate.

---

### L2 — Architecture Acceptance Criteria in `docs/02_ARCHITECTURE.md` are entirely unchecked  🟢

**File:** `/home/calvin/agent-workbench/docs/dev/02_ARCHITECTURE.md` (lines 499-509)
```
[ ] TUI cannot execute tools directly.
[ ] TUI cannot write files directly.
[ ] TUI cannot run shell commands directly.
...
```

**Evidence:**
- All 8 checklist items are unchecked `[ ]`
- Items like "TUI cannot execute tools directly" should be verifiable as PASS since the boundary test exists
- Items like "Server validates all requests" and "Core owns the agent loop" are verifiable from the code

**Impact:** The acceptance criteria don't serve their purpose. A reader can't tell which criteria have been met.

**Recommendation:** Check the items that are verified by existing tests and code structure. Add explicit test references.

---

### L3 — `apps/cli` import depth suggests potential design debt (heavy Node.js `fs` usage vs. plugin-sdk)  🟢

**File:** `/home/calvin/agent-workbench/apps/cli/src/index.ts`

**Evidence:**
- CLI imports `PluginManifest` type and `PluginRegistry` from `@agent-workbench/plugin-sdk`
- But most CLI functionality (scaffolding, `init`, file operations) uses raw Node.js `fs` calls (`cpSync`, `existsSync`, `mkdirSync`, `rmSync`)
- The CLI's `plugin` commands delegate to `PluginRegistry`, but `init` and scaffolding are entirely standalone
- AGENTS.md (line 27) says the CLI owns "plugin lifecycle management, project scaffolding" — but scaffolding doesn't use any shared utilities from the packages

**Impact:** Minor design debt. If scaffolding needs evolve (e.g., template rendering, variable substitution), the CLI would need to reimplement or extract shared scaffolding utilities.

**Recommendation:** Minor — consider extracting scaffold/template utilities into a shared package if they grow beyond basic `cpSync` operations.

---

### L4 — `packages/telemetry` has empty `exports` section despite being a built package  🟢

**File:** `/home/calvin/agent-workbench/packages/telemetry/package.json` (lines 7-11)
```json
"exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
},
```

**Evidence:**
- telemetry is listed in Level 0 of build-all.sh and IS built
- It's imported by the server (apps/server/package.json line 37)
- But unlike the dead packages (config, ui), telemetry has actual source files
- The only documentation concern is that there's no README.md describing OpenTelemetry tracing, Prometheus metrics, etc.
- Actually, it does have source — it's not dead. Let me verify...

Actually wait — I confirmed telemetry exists in Level 0 of build-all.sh and is imported by apps/server. It has a proper package.json with exports. So this isn't a finding. Let me remove this item.

**Revised:** Actually let me keep this as a minor concern — telemetry could still use a README.md for discoverability, but that's cosmetic.

**Deleted — telemetry is properly built and consumed.**

---

## DESIGN QUALITY ASSESSMENT

### DI Pattern (CoreDependencies) — 🟢 Excellent

**File:** `/home/calvin/agent-workbench/packages/core/src/types.ts` (lines 88-112)

The `CoreDependencies` interface defines a clean dependency injection contract:
- 11 dependencies injected: 7 storage repositories, event bus, tool registry, model provider, permission engine/gate, shell runner, and internal services
- Uses inline `import()` type references to avoid circular imports
- All dependencies are interfaces/types, not concrete implementations
- `SessionRunner` (line 76) accepts `CoreDependencies` in constructor
- Clear phase annotations comment which phase added each dependency

**Assessment:** This is a textbook DI pattern for a TypeScript monorepo. It makes testing trivial and prevents core from importing concrete implementations.

### Protocol Route Contracts — 🟢 Excellent

**File:** `/home/calvin/agent-workbench/packages/protocol/src/routes/` (15 route files)

The single-source-of-truth pattern is holding up well:
- 15 route contract files under `packages/protocol/src/routes/`
- Every route has: `method`, `path`, `response`, `errors` as required fields
- Where applicable: `body`, `query`, `pathParams`
- Consistent use of `as const` for type inference
- 10 schema files under `packages/protocol/src/schemas/`
- OpenAPI generation at `packages/protocol/src/openapi/`

**Assessment:** The protocol-first architecture is a standout strength. Routes are discoverable, types are inferred, and the pattern prevents server-SDK DTO drift.

### TUI Import Boundaries — 🟢 Acceptable (with M4 caveat)

- TUI imports are limited to: `@agent-workbench/sdk`, `@agent-workbench/protocol`, `@agent-workbench/eval`
- Zero restricted imports (core, tools, shell, storage, permissions, models/internal)
- The boundary test at `tests/e2e/boundary-tui-imports.test.ts` enforces the restrictions
- The only issue is the stale allowed-list (H4/M4)

### Compliance Package — 🟢 Solid Implementation

- `audit.ts`: Immutable hash-chain audit trail with `computeHash`, `AuditTrail.append/verify/query` — all functional
- `pii-scanner.ts`: Full PII scanner with 10 built-in patterns, configurable thresholds, redact/mask/hash modes
- `fips.ts`: FIPS 140-2 compliance helpers with KAT self-tests and CSPRNG wrappers
- `airgap.ts`: Air-gapped mode controls
- 4 test files (audit, pii-scanner, fips, airgap) — decent coverage

---

## STRUCTURAL RISK ANALYSIS

| Risk | Level | Description |
|------|-------|-------------|
| Dead package rot | HIGH | Two packages (config, ui) are empty scaffolds. They add maintenance overhead (tsconfig, package.json, CI typecheck) without delivering value. |
| Doc-code drift | HIGH | Architecture docs describe a system that doesn't match reality in several important ways (dashboard connectivity, Phase 0 header, unchecked criteria). |
| Docker build broken | MEDIUM | Dockerfile doesn't copy mobile-web but build-all.sh tries to build it. CI won't catch this if Docker builds aren't tested. |
| Version fragmentation | MEDIUM | 3 different zod range specs, 2 different drizzle-orm specs. The root override masks this but it's still a hygiene issue. |
| Dashboard isolation | MEDIUM | A declared observability app that doesn't observe anything from the system. If it's meant to be disconnected, the docs should say so. |
| Boundary test erosion | MEDIUM | The TUI boundary test's allowed list is already out of sync with AGENTS.md. More allowed imports will widen the gap. |
| Compliance packaging | LOW | compliance has excellent source code but no README and no in-package documentation. Discoverability gap. |

---

## PRIORITIZED ACTION PLAN

### 🚨 Immediate (Fix within 1 sprint)

| # | Finding | Action | Owner |
|---|---------|--------|-------|
| 1 | H1 — `packages/config` dead | Delete or implement. Update AGENTS.md and ARCHITECTURE.md either way. | Architecture |
| 2 | H2 — `packages/ui` dead | Delete or implement. Update all doc references. | Architecture/TUI |
| 3 | H5 — `docs/02_ARCHITECTURE.md` stale | Update status to Phase 30, add all phase dependencies, resolve/remove open questions. | Architecture |
| 4 | M1 — Docker missing mobile-web | Add `COPY apps/mobile-web/` or make build-all.sh path-aware in Docker. | DevOps |

### ⚠️ Must Fix (Next 2 sprints)

| # | Finding | Action | Owner |
|---|---------|--------|-------|
| 5 | H3 — Dashboard doesn't connect via SDK | Either add SDK integration or update AGENTS.md to describe reality. | Dashboard/Architecture |
| 6 | H4 — Boundary test missing `eval` | Add `@agent-workbench/eval` to `_ALLOWED_PACKAGES` in test. | TUI |
| 7 | M2 — drizzle-orm version drift | Normalize all packages to `^0.45.2`. | Storage |
| 8 | M3 — plugin-sdk zod version drift | Update to `^4.4.3`. | Plugin-SDK |
| 9 | M7 — Security model uses future tense | Update `docs/06_SECURITY_MODEL.md` to present tense. | Security |

### 📋 Should Fix (Next 3 sprints)

| # | Finding | Action | Owner |
|---|---------|--------|-------|
| 10 | M4 — build-all.sh missing config/ui | Add them to Level 0 with `"build": "tsc"` scripts. | Build |
| 11 | M5 — compliance missing README | Add package-level README. | Compliance |
| 12 | M6 — Dashboard missing SDK dependency | Add `@agent-workbench/sdk` if dashboard should connect. | Dashboard |
| 13 | L1 — Roadmap header stale | Update to "Phase 30 complete". | Docs |
| 14 | L2 — Unchecked acceptance criteria | Verify and check off architecture criteria. | Architecture |
| 15 | L3 — CLI design debt | Minor — consider extracting scaffold utilities if scope grows. | CLI |

---

## PREVIOUS AUDIT STATUS (July 3, 2026)

| Prior Finding | Status | Notes |
|---------------|--------|-------|
| TUI→eval H1 boundary violation | ✅ **RESOLVED** | AGENTS.md line 52 now explicitly allows eval imports. Not a violation. |
| Stale AGENTS.md missing apps/packages | ✅ **RESOLVED** | AGENTS.md now lists all 5 apps and all packages. |
| Dead packages/ui and packages/config | ❌ **STILL OPEN (H1/H2)** | Both still empty scaffolds. |
| Stale docs/02_ARCHITECTURE.md | ❌ **STILL OPEN (H5)** | Still shows Phase 0 status, missing Phase 29/30. |
| Dockerfile missing 7 packages | ✅ **RESOLVED** | Now uses `COPY packages/ packages/` wildcard + build-all.sh. |
| build-all.sh missing eval/auth/collab/config/ui/telemetry/plugin-sdk | ⚠️ **PARTIALLY RESOLVED** | Now includes auth, collab, eval, telemetry, plugin-sdk, compliance. Still missing config, ui. |

---

*Generated by Hermes Agent Architecture Integrity Audit — July 7, 2026*
