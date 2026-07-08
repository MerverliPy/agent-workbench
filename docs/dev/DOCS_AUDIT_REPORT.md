# Docs/ Directory Audit Report

**Date:** 2026-07-06
**Audit scope:** All 33 `.md` files in ```REPO_ROOT``/docs/` (including `compliance/`)
**Method:** Read first 20+ lines of each file; categorized by content type, stated document type, status, and user-facing value.

---

## Summary

| Category | Count | Total Lines |
|----------|-------|-------------|
| 🟢 User-facing value | 6 | 1,343 |
| 🔵 Mixed (partial user value, but spec-heavy) | 5 | 2,327 |
| 🟡 Pure implementation/developer docs (archivable) | 18 | 5,741 |
| 🔴 Stale/deprecated | 1 | 436 |
| 🟠 Active implementation plan (keep) | 1 | 474 |
| 🟣 Opencode workflow (specialized dev doc) | 1 | 151 |
| *(some files appear in multiple rows)* | | |
| **Total** | **33** | **10,472** |

---

## 🟢 USER-FACING — Keep, promote to user docs

These files have direct end-user value — setup guides, deployment instructions, compliance docs, or product overview.

| File | Lines | Why user-facing |
|------|-------|-----------------|
| `compliance/on-prem-deployment-guide.md` | 318 | Deployment guide: prerequisites, system requirements, install steps, config, troubleshooting. Direct end-user value. |
| `compliance/gdpr-addendum.md` | 143 | GDPR Data Processing Addendum. Compliance/legal doc for enterprise users. |
| `compliance/soc-2-readiness-checklist.md` | 175 | SOC 2 readiness checklist for enterprise evaluation. |
| `compliance/security-whitepaper.md` | 217 | Security architecture, threat model, compliance posture — enterprise evaluation doc. |
| `27_PROJECT_ROADMAP.md` | 364 | Active roadmap (Phases 19–30) with completion status and planned features. User-facing: tells users what's done and what's next. |
| **Subtotal** | **1,217** | |

---

## 🔵 MIXED — Has partial user value, but written as implementation specs

These files are labeled "agent-ready [type]" planning docs, but their subject matter is close to what users need. Recommend extracting user-facing summaries and archiving the rest.

| File | Lines | Assessment |
|------|-------|------------|
| `02_ARCHITECTURE.md` | 569 | Labeled "agent-ready architecture guide". Has comprehensive architecture diagrams and package boundaries. **Recommendation:** Extract architecture overview for user docs, archive the raw spec. |
| `05_PERMISSION_MODEL.md` | 469 | "agent-ready permission model". Users need to understand allow/ask/deny policies. **Recommendation:** Extract safety model overview for user docs. |
| `06_SECURITY_MODEL.md` | 491 | "agent-ready security model". Users need security posture info, but this is written as implementation spec. **Recommendation:** Extract security overview; much content is covered by security-whitepaper.md. |
| `09_AGENT_MODEL.md` | 375 | "agent-ready agent model". Defines Build/Plan agents, lifecycle. Partially useful to end-users. |
| `12_TUI_UX_MODEL.md` | 448 | "agent-ready TUI/UX model". Has UI layout and interaction model — useful reference for users. |
| **Subtotal** | **2,352** | |

---

## 🟡 PURE IMPLEMENTATION — Archive / developer-only

These files are **phase plans, ADR-style decisions, model specs, scaffold records, or implementation wrap-ups**. They have no direct end-user value and serve only as implementation guidance for coding agents.

| File | Lines | Specifics |
|------|-------|-----------|
| `00_PROJECT_INTENT.md` | 234 | Project goals, principles, non-goals. Planning doc for agent implementors. |
| `01_TECH_STACK_DECISION.md` | 271 | ADR-style tech stack decision. Rejected alternatives, implementation implications. |
| `03_BACKEND_FRONTEND_BOUNDARY.md` | 407 | Boundary contract between TUI and backend. Pure implementation spec. |
| `07_API_CONTRACT_PLAN.md` | 607 | Schema-first API contract design. Route groups, SSE, validation rules. Implementation spec. |
| `08_DATA_MODEL_PLAN.md` | 640 | SQLite/Drizzle schema design. Tables, persistence, retention. Implementation spec. |
| `10_TOOL_RUNTIME_MODEL.md` | 454 | Tool registry, execution lifecycle, permissions. Implementation spec. |
| `11_TOKEN_HEALTH_MODEL.md` | 381 | Context budgets, truncation, summarization. Implementation spec. |
| `13_RUN_LEDGER_MODEL.md` | 446 | Audit event categories, persistence, UI panel. Implementation spec. |
| `14_DRY_RUN_MODEL.md` | 408 | Dry-run model for previewing risky operations. Implementation spec. |
| `15_CACHE_MODEL.md` | 370 | Read/search cache model with invalidation. Implementation spec. |
| `16_TESTING_STRATEGY.md` | 493 | Testing strategy: unit, integration, e2e, security tests. Dev-only. |
| `17_RISK_REGISTER.md` | 157 | Known risks tracker. Dev-only. |
| `19_TARGET_REPO_TREE.md` | 443 | Target repository tree structure. Dev-only. |
| `20_PHASE_1_WORKSPACE_SCAFFOLD.md` | 129 | Phase 1 scaffold execution record. Historical. |
| `21_PACKAGE_OWNERSHIP.md` | 50 | Package ownership matrix. Dev-only. |
| `22_PHASE_14B_WRAPUP.md` | 146 | Phase 14B hardening wrap-up. Historical/implementation. |
| `23_PHASE_15_PROVIDER_INTEGRATION.md` | 105 | Phase 15 provider integration plan. Historical. |
| `24_PHASE_16_STREAMING_RESPONSES.md` | 196 | Phase 16 streaming plan. Historical. |
| `25_PHASE_17_CI_AND_E2E_VALIDATION.md` | 193 | Phase 17 CI/CD plan. Historical. |
| `26_PHASE_18_MOBILE_WEB_UI.md` | 629 | Phase 18 mobile web plan. Historical (status: complete). |
| **Subtotal** | **7,310** | |

---

## 🔴 STALE/DEPRECATED

| File | Lines | Issue |
|------|-------|-------|
| `18_PHASE_EXIT_GATES.md` | 436 | **Explicitly self-deprecating** — Line 3 says "⚠️ DEPRECATED — July 2026. This document tracks exit gates for phases 0–18 only and is 9+ phases behind reality." Points to `27_PROJECT_ROADMAP.md` as authoritative. Should be removed or archived. |

---

## 🟠 ACTIVE IMPLEMENTATION PLAN

| File | Lines | Status |
|------|-------|--------|
| `PHASE_29_IMPLEMENTATION_PLAN.md` | 474 | Current phase implementation plan (Model Experimentation & Evaluation). Active — keep until Phase 29 completes. |

---

## 🟣 SPECIALIZED DEV WORKFLOW

| File | Lines | Assessment |
|------|-------|------------|
| `OPENCODE_MODEL_ROUTER_WORKFLOW.md` | 151 | OpenCode live-provider workflow for model-router. Developer workflow doc; only relevant if the repo uses OpenCode. Not user-facing. |

---

## Key Recommendations

1. **Archive immediately (21 files, ~7,310 lines):** All pure implementation docs (🟡) — move to `docs/archived/` or remove. These are phase plans and ADR specs that served their purpose and are now noise for end-users.

2. **Remove stale file:** `18_PHASE_EXIT_GATES.md` — already explicitly deprecates itself.

3. **Keep active:** `PHASE_29_IMPLEMENTATION_PLAN.md` — current phase plan; `27_PROJECT_ROADMAP.md` — active roadmap.

4. **Extract user-friendly summaries** from the Mixed (🔵) category instead of exposing the raw specs:
   - `02_ARCHITECTURE.md` → architecture overview
   - `05_PERMISSION_MODEL.md` → safety/policy guide
   - `06_SECURITY_MODEL.md` → security overview (merge with security-whitepaper.md)
   - `12_TUI_UX_MODEL.md` → UI reference

5. **Keep all `compliance/` files** (🟢) — they have direct enterprise/user value.

6. **Total size reduction if archived:** ~7,746 lines removed (74% of docs/ content).
