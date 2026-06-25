# 20 — Phase 1 Workspace Scaffold

Status: Phase 1 — Workspace Scaffold  
Document type: scaffold execution record  
Scope: files and folders created after Phase 0 validation

## 1. Purpose

This document records the Phase 1 scaffold generated from the accepted Phase 0 planning docs.

Phase 1 creates repository structure and package shells only. It does not implement runtime behavior.

## 2. Created Root Files

```text
package.json
tsconfig.base.json
biome.json
.gitignore
.env.example
```

## 3. Created App Shells

```text
apps/cli
apps/server
apps/tui
```

Each app shell contains:

```text
package.json
tsconfig.json
README.md
src/.gitkeep
```

## 4. Created Package Shells

```text
packages/protocol
packages/sdk
packages/core
packages/events
packages/storage
packages/config
packages/permissions
packages/tools
packages/models
packages/shell
packages/diff
packages/tokens
packages/cache
packages/planner
packages/ui
```

Each package shell contains:

```text
package.json
tsconfig.json
README.md
src/.gitkeep
```

## 5. Non-Implementation Guarantee

The scaffold intentionally does not include:

```text
runtime TypeScript implementation files
server route handlers
TUI components
tool implementations
database schemas
migrations
test files
scripts directory
generated SDK
generated OpenAPI output
```

## 6. Provisional Choices

The following are provisional and may require confirmation:

| Area | Provisional Choice |
|---|---|
| Package scope | `@agent-workbench/*` |
| CLI package name | `@agent-workbench/cli` |
| Formatter config | `biome.json` included as scaffold default |
| Bun lockfile | Not generated in this environment because Bun is unavailable |

## 7. Local Follow-Up

Run locally after installing Bun:

```text
bun install
```

This should generate the real Bun lockfile.

Do not hand-author a fake `bun.lock`.

## 8. Phase 1 Exit Gate Status

```text
[ ] Root package management files exist.
[ ] TypeScript config exists.
[ ] apps/cli exists.
[ ] apps/server exists.
[ ] apps/tui exists.
[ ] Required packages exist.
[ ] Package ownership is documented in each README.md.
[ ] No runtime implementation logic exists.
[ ] Bun lockfile still needs local generation.
```

## 9. Next Phase

After Phase 1 is accepted and the lockfile is generated locally, proceed to:

```text
Phase 2 — Protocol Contract
```
