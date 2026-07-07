# Scope of Work — Rewrite `docs/dev/02_ARCHITECTURE.md`

**Date:** 2026-07-07  
**Source documents:** AGENTS.md (canonical), ARCHITECTURE_INTEGRITY_AUDIT.md (July 7 audit), actual monorepo structure  
**Audience:** This is a planning artifact for the rewrite effort — not a replacement for ARCHITECTURE.md itself.

---

## 1. Executive Summary

`docs/dev/02_ARCHITECTURE.md` (569 lines) was last meaningfully updated during Phase 0 planning. The header was patched to say "Phase 30 complete" but **every substantive section** still reflects the Phase 0 target architecture, not the shipped codebase. The audit (ARCHITECTURE_INTEGRITY_AUDIT.md, H5) confirms it's the highest-severity doc debt.

AGENTS.md is the current source of truth for package boundaries and architectural rules. The rewrite should reference AGENTS.md authoritatively and avoid duplicating its content — ARCHITECTURE.md should describe *what was built, why, and how the pieces connect*, not repeat the rules that AGENTS.md already nails.

---

## 2. Delta Analysis: What's Wrong

### 2.1 Missing Packages (8 packages not covered in text)

AGENTS.md lists 22 packages + 5 apps. ARCHITECTURE.md's Section 5 (Application Layers) has dedicated subsections for only 11 packages. **11 packages are missing dedicated coverage:**

| Package | In AGENTS.md? | In ARCH. Diagram? | In ARCH. Section 5? | Status |
|---------|:---:|:---:|:---:|--------|
| `packages/models` | ✅ | ✅ | ❌ | Built, consumed by core |
| `packages/shell` | ✅ | ✅ | ❌ | Built, consumed by tools |
| `packages/diff` | ✅ | ✅ | ❌ | Built, consumed by tools |
| `packages/cache` | ✅ | ✅ | ❌ | Built, consumed by tools |
| `packages/planner` | ✅ | ✅ | ❌ | Built, consumed by core |
| `packages/auth` | ✅ | ✅ | ❌ | Built, consumed by server |
| `packages/collab` | ✅ | ✅ | ❌ | Built, consumed by server |
| `packages/eval` | ✅ | ✅ | ❌ | Built, consumed by TUI |
| `packages/telemetry` | ✅ | ✅ | ❌ | Built, consumed by server |
| `packages/plugin-sdk` | ✅ | ✅ | ❌ | Built, consumed by CLI/tools |
| `packages/config` | ✅ | ✅ (diagram) | ❌ | **Dead shell** — no implementation |
| `packages/compliance` | ✅ | ❌ | ❌ | Built, but not in diagram or text |
| `packages/ui` | ✅ | ❌ | ❌ | **Dead shell** — no implementation |

**Key problem:** The mermaid diagram (Section 2) is *mostly* up-to-date — it includes models, auth, collab, eval, telemetry, plugin-sdk, config. But the text (Section 5) doesn't describe any of them. The diagram is also missing `compliance`.

### 2.2 Stale Sections

| Section | Lines | Problem |
|---------|-------|---------|
| **§2 High-Level Architecture** (diagram) | 15-64 | Missing `compliance`. Has strange `CLASSES --> SDK` edge (line 50) that looks vestigial. Otherwise surprisingly good — includes most packages. |
| **§4 Target Package Model** | 82-112 | Lists 19 packages but missing `compliance`. Lists `config` and `ui` which are dead shells. Uses `Future folder:` language for packages that exist now. |
| **§5 Application Layers** | 114-394 | Covers only 11/22 packages. Missing models, shell, diff, cache, planner, auth, collab, eval, telemetry, plugin-sdk, config, compliance, ui. Every subsection uses "Future folder:" for packages that exist NOW. |
| **§10 Phase Dependencies** | 478-493 | Only goes to Phase 12. Missing Phases 13-30 entirely — that's 18 phases of unrepresented architecture evolution. |
| **§11 Architecture Acceptance Criteria** | 496-509 | 8 items, all unchecked `[ ]`. Several are verifiable as PASS (TUI boundary test exists, server validation exists, core owns agent loop). |
| **§12 Hard Constraints** | 511-522 | Several are Phase-0 era planning artifacts (e.g., "Do not create implementation folders during Phase 0"). Should be updated to reflect actual constraints of a Phase-30 codebase. |
| **§13 Open Questions** | 524-532 | 5 items all "Unresolved"/"Deferred" to docs that have since been written and implemented. No longer open. |
| **§15 Agent Instructions** | 549-558 | Generic advice that belongs in AGENTS.md. Creates duplication risk. |

### 2.3 Stale Language Throughout

Every "Future folder:" reference in §5 — 11 instances — is stale. Every folder already exists.

The flow diagrams (§6-9: Prompt Execution Flow, File Mutation Flow, Shell Execution Flow, Run Ledger) are conceptually still valid but describe an idealized flow, not the actual implementation trace. They lack references to actual packages, events, and route contracts.

---

## 3. What Should Be Removed

| Item | Reason |
|------|--------|
| **§4 Target Package Model** (lines 82-112) | Redundant with AGENTS.md. ARCHITECTURE.md should not maintain a parallel package list — it will drift again. |
| **§10 Phase Dependencies** (lines 478-493) | Purely historical planning artifact. Phase ordering is irrelevant now that all phases are complete. Defer to `docs/27_PROJECT_ROADMAP.md` if anyone needs the history. |
| **§13 Open Questions** (lines 524-532) | All resolved or documented elsewhere. Remove entirely. |
| **§15 Agent Instructions** (lines 549-558) | Duplicates AGENTS.md. Remove to prevent drift. |
| **§16 Validation Checklist** (lines 560-569) | Generic meta-checklist. Redundant with acceptance criteria in §11. |
| **"Future folder:" text** (11 instances in §5) | All folders exist. Use present tense. |
| **§12 item "Don't create implementation folders during Phase 0"** (line 522) | Phase 0 is 30 phases ago. Remove this constraint. |
| **All Phase-0 era status markers** | Every "Future folder:", "Not yet", "Eventually" language throughout. |

---

## 4. What AGENTS.md Already Covers Well (Don't Duplicate)

AGENTS.md is the concise authority for:

- Mission statement
- Stack decisions
- **Package boundaries** (one-liner per package, TUI import rules)
- Protocol rules (Zod-first, route contracts, SSE)
- Safety model (permission posture, defaults)
- Agent behavior rules
- Code standards
- Verification commands
- Git discipline

ARCHITECTURE.md should **reference AGENTS.md for these** rather than duplicate them. The rewrite should be *complementary*, not redundant.

---

## 5. Proposed Structure for the Rewrite

```
# 02 — Architecture (rewrite)
  Status: Phase 30 complete — AGENTS.md is canonical for boundaries

  ## 1. Purpose
    (keep, tighten — this doc describes shipped architecture, not target)

  ## 2. System Overview
    (replace the diagram with an updated one; add compliance)

  ## 3. Core Architectural Rule
    (keep TUI-thin-client rule, tighten wording)

  ## 4. Package Landscape
    (replaces old §4 + §5 — compact table of all 22 packages + 5 apps,
     referencing AGENTS.md for ownership rules. One short paragraph per
     package describing what it actually does in the shipped system,
     not what it will do.)

  ## 5. Key Data Flows
    (rewrite §6-9 flows to reference actual packages, events, and
     route contracts. Include compliance audit-trail flow. Include
     plugin loading flow.)

  ## 6. Architecture Acceptance Criteria
    (re-evaluate all 8 items, check off verified ones, add proof
     references — e.g., "TUI cannot execute tools directly → PASS
     (verified by tests/e2e/boundary-tui-imports.test.ts)")

  ## 7. Hard Constraints
    (prune Phase-0 entries, add Phase-30 constraints like compliance
     audit immutability, plugin isolation, auth requirements)

  ## 8. Diagrams
    (mermaid — add compliance, remove CLASSES artifact)
```

---

## 6. Diagram Assessment

### Current State
The existing mermaid diagram (§2, lines 15-64) is surprisingly the *least* stale part of the document. It includes most Phase-30 packages. Issues:
- Missing `compliance` — should be in "Services" subgraph
- `CLASSES --> SDK` edge (line 50) — what is this? Vestigial reference, remove
- No `config` or `ui` shown (acceptable — they're dead, but they ARE in the tree; consistency matters)

### Recommendation
**Regenerate the diagram** rather than patching. The diagram is complex (30+ nodes, 20+ edges). A full mermaid rewrite from scratch ensures correctness. Estimated effort: 30-45 min.

Diagram should:
- Include `compliance` in the Services subgraph
- Remove `CLASSES` node
- Optionally show dead packages (`config`, `ui`) with a `%%` dashed border or footnote noting they're scaffolds
- Add edges for: core→planner (already there), tools→compliance (audit trail), server→auth (already there), server→telemetry

---

## 7. Effort Estimates

### 7.1 Complete Rewrite
**Estimated: 3-4 hours**

| Task | Hours | Notes |
|------|-------|-------|
| Read all source-of-truth docs (AGENTS.md, key decisions, actual code paths) | 0.5 | |
| Rewrite §1-3 (purpose, overview, core rule) | 0.5 | Mostly tighten existing text |
| Build §4 Package Landscape table + paragraphs | 1.0 | 22 packages × 2-3 sentences each + import table |
| Rewrite §5 Key Data Flows | 0.75 | 4 flows, reference real events/contracts |
| Rebuild §6 Acceptance Criteria | 0.25 | Check off verified, add test references |
| Prune §7 Hard Constraints | 0.25 | Remove Phase-0 entries, add Phase-30 constraints |
| Regenerate mermaid diagram | 0.5 | |
| Final review + cross-reference check | 0.25 | |

### 7.2 Targeted Update
**Estimated: 1.5-2 hours**

| Task | Hours | Notes |
|------|-------|-------|
| Add missing 12 packages to §5 | 1.0 | 12 new subsections following existing pattern |
| Update phase dependencies to cover Phase 13-30 | 0.25 | Quick addition, no detail needed |
| Prune §13 Open Questions (delete section) | 0.1 | |
| Prune §15 Agent Instructions (delete section) | 0.1 | |
| Prune §16 Validation Checklist (delete section) | 0.1 | |
| Check off §11 acceptance criteria | 0.15 | |
| Patch mermaid diagram | 0.25 | Add compliance, remove CLASSES |
| Remove "Future folder:" language | 0.1 | Global find-and-replace + manual review |
| Fix §12 Hard Constraints | 0.1 | Remove Phase-0-era constraints |

### Recommendation
**Do the complete rewrite.** The targeted update still leaves the document with a fundamentally Phase-0-era structure and tone — just with more subsections bolted on. The package-landscape-as-§5-subsections pattern is itself stale (it was designed when there were 11 packages; now there are 22). A table/summary approach (§4 in the proposed structure) scales better and is less likely to drift.

The complete rewrite doesn't require deep code analysis — most of the package descriptions exist in AGENTS.md and just need to be expanded with implementation details. The real cost is the 12 new package descriptions, which account for ~50% of the effort either way.

---

## 8. Risks

| Risk | Mitigation |
|------|------------|
| **Rewrite introduces new inaccuracies** | Cross-reference every package claim against actual exports/consumers. Use the ARCHITECTURE_INTEGRITY_AUDIT.md findings as a checklist. |
| **Diagram becomes stale again** | Move diagram to a mermaid file or auto-generation script. At minimum, add a "Last diagram refresh" date comment in the mermaid block. |
| **Duplication with AGENTS.md** | Explicitly reference AGENTS.md as authority. Avoid re-stating boundaries, rules, or standards that AGENTS.md already covers. ARCHITECTURE.md should describe *how the architecture works*, AGENTS.md defines *how to build it*. |
| **Phase dependencies replaced, not removed** | Don't rewrite phase history — remove it. Anyone who needs phase ordering can read the roadmap. The architecture document should describe the system *as it is*. |

---

## 9. Acceptance Criteria for the Rewrite

The rewrite is complete when:

1. [ ] All 22 packages + 5 apps are described (even dead ones like config/ui, marked as such)
2. [ ] AGENTS.md is explicitly referenced as canonical for boundaries and rules
3. [ ] No "Future folder:", "Phase 0", "Eventually", or "will" language for already-shipped capabilities
4. [ ] §11 (Architecture Acceptance Criteria) are all verified and checked off with proof references
5. [ ] §13 Open Questions and §15 Agent Instructions are removed (content absorbed into AGENTS.md or resolved)
6. [ ] Mermaid diagram includes `compliance`, excludes `CLASSES`, and has a refresh date
7. [ ] At least one flow diagram references a concrete package or route contract by name
8. [ ] Dead packages (config, ui) are honestly described as empty scaffolds, not as "providing X"
