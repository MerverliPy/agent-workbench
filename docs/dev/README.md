# Developer Documentation

This directory contains internal development documentation, architecture decisions, phase plans, and agent rules for contributors building and maintaining agent-workbench.

## Contents

| File | Description |
|------|-------------|
| [`AGENTS.md`](AGENTS.md) | AI agent rules and workflows for building the project |
| [`decisions/`](decisions/) | Architecture Decision Records (ADRs) — 0017 recorded decisions |
| [`00_PROJECT_INTENT.md`](00_PROJECT_INTENT.md) | Original project intent and product goals |
| [`01_TECH_STACK_DECISION.md`](01_TECH_STACK_DECISION.md) | Technology stack: TypeScript + Bun + OpenTUI |
| [`02_ARCHITECTURE.md`](02_ARCHITECTURE.md) | System architecture documentation |
| [`03_BACKEND_FRONTEND_BOUNDARY.md`](03_BACKEND_FRONTEND_BOUNDARY.md) | Backend/frontend boundary rules |
| [`05_PERMISSION_MODEL.md`](05_PERMISSION_MODEL.md) | Permission model design (doc moved to `docs/05_PERMISSION_MODEL.md`) |
| [`07_API_CONTRACT_PLAN.md`](07_API_CONTRACT_PLAN.md) | API contract and route planning |
| [`08_DATA_MODEL_PLAN.md`](08_DATA_MODEL_PLAN.md) | Data model and schema plans |
| [`09_AGENT_MODEL.md`](09_AGENT_MODEL.md) | Agent behavior model specification |
| [`10_TOOL_RUNTIME_MODEL.md`](10_TOOL_RUNTIME_MODEL.md) | Tool execution runtime model |
| [`11_TOKEN_HEALTH_MODEL.md`](11_TOKEN_HEALTH_MODEL.md) | Token health, budgets, compaction |
| [`12_TUI_UX_MODEL.md`](12_TUI_UX_MODEL.md) | TUI user experience model |
| [`13_RUN_LEDGER_MODEL.md`](13_RUN_LEDGER_MODEL.md) | Run ledger and audit trail model |
| [`14_DRY_RUN_MODEL.md`](14_DRY_RUN_MODEL.md) | Dry-run mode specification |
| [`15_CACHE_MODEL.md`](15_CACHE_MODEL.md) | Read/search cache model |
| [`16_TESTING_STRATEGY.md`](16_TESTING_STRATEGY.md) | Testing strategy and coverage |
| [`17_RISK_REGISTER.md`](17_RISK_REGISTER.md) | Project risk register |
| [`18_PHASE_EXIT_GATES.md`](18_PHASE_EXIT_GATES.md) | Phase-by-phase exit criteria |
| [`19_TARGET_REPO_TREE.md`](19_TARGET_REPO_TREE.md) | Target repository structure |
| [`20_PHASE_1_WORKSPACE_SCAFFOLD.md`](20_PHASE_1_WORKSPACE_SCAFFOLD.md) | Phase 1: workspace scaffold |
| [`21_PACKAGE_OWNERSHIP.md`](21_PACKAGE_OWNERSHIP.md) | Package ownership and boundaries |
| [`22_PHASE_14B_WRAPUP.md`](22_PHASE_14B_WRAPUP.md) | Phase 14B wrap-up and hardening |
| [`23_PHASE_15_PROVIDER_INTEGRATION.md`](23_PHASE_15_PROVIDER_INTEGRATION.md) | Phase 15: provider integration |
| [`24_PHASE_16_STREAMING_RESPONSES.md`](24_PHASE_16_STREAMING_RESPONSES.md) | Phase 16: streaming responses |
| [`25_PHASE_17_CI_AND_E2E_VALIDATION.md`](25_PHASE_17_CI_AND_E2E_VALIDATION.md) | Phase 17: CI/CD and E2E |
| [`26_PHASE_18_MOBILE_WEB_UI.md`](26_PHASE_18_MOBILE_WEB_UI.md) | Phase 18: mobile web UI |
| [`PHASE_29_IMPLEMENTATION_PLAN.md`](PHASE_29_IMPLEMENTATION_PLAN.md) | Phase 29: model eval plan |
| [`OPENCODE_MODEL_ROUTER_WORKFLOW.md`](OPENCODE_MODEL_ROUTER_WORKFLOW.md) | OpenCode model router workflow |
| [`MANIFEST.md`](MANIFEST.md) | Original project manifest |
| [`MANIFEST_PHASE_1.md`](MANIFEST_PHASE_1.md) | Phase 1 manifest |
| [`PHASE_0_VALIDATION.md`](PHASE_0_VALIDATION.md) | Phase 0 validation |
| [`PHASE_1_VALIDATION.md`](PHASE_1_VALIDATION.md) | Phase 1 validation |
| [`AUDIT_REPORT.md`](AUDIT_REPORT.md) | Codebase audit report |

## User-Facing Docs

The following docs are in `docs/` and are intended for users:

| Doc | Description |
|-----|-------------|
| [`docs/27_PROJECT_ROADMAP.md`](../27_PROJECT_ROADMAP.md) | Project roadmap and phase history |
| [`docs/05_PERMISSION_MODEL.md`](../05_PERMISSION_MODEL.md) | Permission and safety model |
| [`docs/06_SECURITY_MODEL.md`](../06_SECURITY_MODEL.md) | Security architecture |
| [`docs/compliance/`](../compliance/) | Compliance documentation (SOC 2, GDPR, SBOM, deployment) |

---

*Last updated: 2026-07-06*
