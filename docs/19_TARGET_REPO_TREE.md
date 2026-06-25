# 19 — Target Repo Tree

Status: Phase 0 — Planning Docs  
Document type: agent-ready target repository tree  
Scope: Phase 0 actual tree, Phase 1 scaffold tree, full target tree, package ownership

## 1. Purpose

This document defines the target repository tree for `agent-workbench`.

Important:

```text
This file describes future structure.
Do not create implementation folders during Phase 0.
```

## 2. Phase 0 Actual Tree

During Phase 0, only this tree is allowed:

```text
agent-workbench/
├─ README.md
├─ docs/
│  ├─ 00_PROJECT_INTENT.md
│  ├─ 01_TECH_STACK_DECISION.md
│  ├─ 02_ARCHITECTURE.md
│  ├─ 03_BACKEND_FRONTEND_BOUNDARY.md
│  ├─ 04_IMPLEMENTATION_PHASE_CHECKLIST.md
│  ├─ 05_PERMISSION_MODEL.md
│  ├─ 06_SECURITY_MODEL.md
│  ├─ 07_API_CONTRACT_PLAN.md
│  ├─ 08_DATA_MODEL_PLAN.md
│  ├─ 09_AGENT_MODEL.md
│  ├─ 10_TOOL_RUNTIME_MODEL.md
│  ├─ 11_TOKEN_HEALTH_MODEL.md
│  ├─ 12_TUI_UX_MODEL.md
│  ├─ 13_RUN_LEDGER_MODEL.md
│  ├─ 14_DRY_RUN_MODEL.md
│  ├─ 15_CACHE_MODEL.md
│  ├─ 16_TESTING_STRATEGY.md
│  ├─ 17_RISK_REGISTER.md
│  ├─ 18_PHASE_EXIT_GATES.md
│  └─ 19_TARGET_REPO_TREE.md
└─ decisions/
   ├─ 0001-stack-typescript-bun-opentui.md
   ├─ 0002-tui-is-thin-client.md
   ├─ 0003-schema-first-zod-contract.md
   ├─ 0004-localhost-only-server-default.md
   ├─ 0005-permission-engine-allow-ask-deny.md
   ├─ 0006-sqlite-full-run-ledger.md
   ├─ 0007-read-only-tools-first.md
   ├─ 0008-patch-first-file-mutations.md
   ├─ 0009-simple-shell-runner-before-pty.md
   ├─ 0010-build-plan-agents-first.md
   ├─ 0011-token-health-required.md
   ├─ 0012-run-ledger-panel.md
   ├─ 0013-pre-run-planner-before-mutation.md
   ├─ 0014-read-search-cache.md
   └─ 0015-dry-run-risky-operations.md
```

## 3. Phase 0 Forbidden Tree Items

Do not create:

```text
package.json
bun.lock
apps/
packages/
src/
tests/
scripts/
drizzle.config.ts
tsconfig.json
generated files
runtime placeholders
```

## 4. Phase 1 Scaffold Tree

After Phase 0 exits, Phase 1 may create:

```text
agent-workbench/
├─ README.md
├─ package.json
├─ bun.lock
├─ tsconfig.base.json
├─ biome.json
├─ .gitignore
├─ .env.example
├─ apps/
│  ├─ cli/
│  ├─ server/
│  └─ tui/
├─ packages/
│  ├─ protocol/
│  ├─ sdk/
│  ├─ core/
│  ├─ events/
│  ├─ storage/
│  ├─ config/
│  ├─ permissions/
│  ├─ tools/
│  ├─ models/
│  ├─ shell/
│  ├─ diff/
│  ├─ tokens/
│  ├─ cache/
│  ├─ planner/
│  └─ ui/
├─ docs/
└─ decisions/
```

## 5. Full Target Tree

Target tree after later phases:

```text
agent-workbench/
├─ README.md
├─ package.json
├─ bun.lock
├─ tsconfig.base.json
├─ biome.json
├─ .gitignore
├─ .env.example
├─ apps/
│  ├─ cli/
│  ├─ server/
│  └─ tui/
├─ packages/
│  ├─ protocol/
│  ├─ sdk/
│  ├─ core/
│  ├─ events/
│  ├─ storage/
│  ├─ config/
│  ├─ permissions/
│  ├─ tools/
│  ├─ models/
│  ├─ shell/
│  ├─ diff/
│  ├─ tokens/
│  ├─ cache/
│  ├─ planner/
│  └─ ui/
├─ docs/
├─ decisions/
├─ scripts/
└─ tests/
```

## 6. apps/cli Target

```text
apps/cli/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ commands/
   │  ├─ dev.ts
   │  ├─ tui.ts
   │  ├─ serve.ts
   │  ├─ run.ts
   │  ├─ session.ts
   │  ├─ config.ts
   │  ├─ provider.ts
   │  ├─ doctor.ts
   │  └─ version.ts
   ├─ lifecycle/
   │  ├─ start-local-server.ts
   │  ├─ start-tui.ts
   │  ├─ attach-to-server.ts
   │  └─ graceful-shutdown.ts
   └─ util/
      ├─ resolve-project-root.ts
      ├─ resolve-config-paths.ts
      ├─ print-error.ts
      ├─ print-json.ts
      └─ exit-codes.ts
```

## 7. apps/server Target

```text
apps/server/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ app.ts
   ├─ server/
   │  ├─ create-server.ts
   │  ├─ bind-address.ts
   │  ├─ shutdown.ts
   │  └─ server-context.ts
   ├─ routes/
   │  ├─ health.routes.ts
   │  ├─ event.routes.ts
   │  ├─ session.routes.ts
   │  ├─ message.routes.ts
   │  ├─ config.routes.ts
   │  ├─ provider.routes.ts
   │  ├─ file.routes.ts
   │  ├─ permission.routes.ts
   │  ├─ tool.routes.ts
   │  ├─ tui.routes.ts
   │  └─ auth.routes.ts
   ├─ handlers/
   ├─ middleware/
   └─ errors/
```

## 8. apps/tui Target

```text
apps/tui/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.tsx
   ├─ app.tsx
   ├─ runtime/
   ├─ routes/
   ├─ components/
   │  ├─ layout/
   │  ├─ timeline/
   │  ├─ input/
   │  ├─ sessions/
   │  ├─ command-palette/
   │  ├─ permissions/
   │  ├─ diff/
   │  ├─ ledger/
   │  ├─ token-health/
   │  ├─ agents/
   │  └─ providers/
   ├─ state/
   ├─ commands/
   ├─ keybindings/
   ├─ theme/
   └─ util/
```

## 9. packages/protocol Target

```text
packages/protocol/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ schemas/
   ├─ routes/
   ├─ openapi/
   └─ types/
```

Owns Zod schemas, route contracts, event/error envelopes, and OpenAPI metadata.

## 10. packages/sdk Target

```text
packages/sdk/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ client.ts
   ├─ transport/
   ├─ resources/
   └─ generated/
```

Owns typed client transport.

## 11. packages/core Target

```text
packages/core/
├─ package.json
├─ tsconfig.json
└─ src/
   ├─ index.ts
   ├─ runtime/
   ├─ session/
   ├─ message/
   ├─ context/
   ├─ agent/
   ├─ tools/
   ├─ planning/
   ├─ ledger/
   └─ errors/
```

Owns agent runtime orchestration.

## 12. Other Package Targets

```text
packages/events      event bus and SSE event definitions
packages/storage     SQLite/Drizzle schema and repositories
packages/config      layered config and secret references
packages/permissions allow/ask/deny engine and risk rules
packages/tools       tool registry and tool implementations
packages/models      provider adapters and model router
packages/shell       simple command runner and later PTY design
packages/diff        patch preview/apply/revert and file dry-run
packages/tokens      token-health and compaction
packages/cache       read/search cache and invalidation
packages/planner     pre-run/mutation planning gates
packages/ui          shared formatting/theme primitives
```

## 13. Package Ownership Matrix

| Package | Owns | Must Not Own |
|---|---|---|
| apps/cli | commands, process startup | agent logic |
| apps/server | HTTP/SSE, middleware, route handlers | tool internals |
| apps/tui | terminal rendering, input, panels | file writes, shell, model calls |
| packages/protocol | schemas, route contracts | business logic |
| packages/sdk | typed client, HTTP/SSE transport | runtime execution |
| packages/core | agent loop, orchestration | TUI rendering |
| packages/events | event bus and event format | session persistence |
| packages/storage | SQLite schema/repositories | agent policy |
| packages/config | config loading/resolution | UI state |
| packages/permissions | allow/ask/deny decisions | modal rendering |
| packages/tools | tool definitions/executors | UI approval |
| packages/models | provider routing/calls | tool permissions |
| packages/shell | command runner | permission UI |
| packages/diff | patch preview/apply/revert | chat rendering |
| packages/tokens | context budgets/compaction | provider auth |
| packages/cache | read/search cache | file mutation |
| packages/planner | execution/mutation plans | actual shell execution |
| packages/ui | shared display formatting | application state |

## 14. Import Boundary Rules

TUI may import:

```text
packages/sdk
packages/protocol
packages/events
packages/ui
```

TUI must not import:

```text
packages/tools
packages/shell
packages/storage
packages/permissions/internal
packages/models/internal
packages/core/internal
```

## 15. Phase-to-Folder Mapping

| Phase | Primary folders |
|---:|---|
| 0 | README.md, docs/, decisions/ |
| 1 | root config, apps/*, packages/* |
| 2 | packages/protocol, packages/sdk |
| 3 | apps/server, packages/events |
| 4 | apps/tui, packages/ui, packages/sdk |
| 5 | packages/storage |
| 6 | packages/core, packages/models, packages/events |
| 7 | packages/tools/read, grep, glob, packages/cache |
| 8 | packages/permissions |
| 9 | packages/diff, tools/edit/write/apply-patch |
| 10 | packages/shell, tools/bash |
| 11 | packages/core/src/agent |
| 12 | packages/tokens, apps/tui token-health components |

## 16. Acceptance Criteria

This target tree is valid when:

```text
[ ] Phase 0 allowed tree is clear.
[ ] Phase 0 forbidden items are clear.
[ ] Phase 1 scaffold tree is clear.
[ ] Full target tree is clear.
[ ] Package ownership matrix is present.
[ ] Import boundaries are documented.
[ ] Phase-to-folder mapping is documented.
```

## 17. Anti-Patterns

Do not:

- Create apps/ during Phase 0.
- Create packages/ during Phase 0.
- Add placeholder source files during Phase 0.
- Put core runtime inside apps/tui.
- Put tool execution inside apps/server handlers directly.
- Let packages/protocol own business logic.
- Let packages/storage define API shapes.
- Ignore package ownership matrix.

## 18. Open Questions

| ID | Question | Status |
|---|---|---|
| TREE-001 | Final CLI binary name | Unresolved |
| TREE-002 | Exact root config files | Provisional |
| TREE-003 | Exact package export strategy | Unresolved |
| TREE-004 | Exact boundary enforcement mechanism | Unresolved |
| TREE-005 | Whether scripts/ appears before tests/ | Unresolved |

## 19. Agent Instructions

Future agents must:

1. During Phase 0, create only documented Phase 0 files.
2. During Phase 1, scaffold only after Phase 0 exit gate passes.
3. Preserve package ownership.
4. Preserve import boundaries.
5. Do not create implementation files early.
6. Mark unresolved tree choices before finalizing scaffolding.

## 20. Validation Checklist

```text
[ ] Phase 0 tree is documented.
[ ] Future trees are documented.
[ ] Package matrix is documented.
[ ] Boundary rules are documented.
[ ] Open questions are marked.
```
