# 21 — Package Ownership

Status: Phase 1 — Workspace Scaffold  
Document type: ownership map  
Scope: generated app/package shell responsibilities

## Ownership Matrix

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

## Import Boundary Reminder

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
