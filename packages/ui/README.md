# `@agent-workbench/ui`

**Status: ⏳ Stub — planned, not yet implemented.**

This package is declared in AGENTS.md as providing shared UI primitives
(formatting, color tokens, path helpers) for use across `apps/tui`,
`apps/mobile-web`, and `apps/dashboard`.

Current behavior: `export {};` (empty barrel). The package has a `typecheck`
script but no runtime implementation yet.

## Planned Exports

| Module | Export | Description |
|--------|--------|-------------|
| `formatTimestamp` | `relative()`, `absolute()`, `short()` | Human-readable relative/absolute timestamps |
| `truncatePath` | `truncatePath()` | Path shortening for narrow display panels |
| `colors` | palette tokens | Shared color/theme primitives for consistent theming |

## Design Principles

- **No business logic** — pure formatting and display helpers only
- **No state** — all exports are pure functions or constant token maps
- **Framework-agnostic** — usable from SolidJS (TUI, dashboard, mobile-web) and
  potentially React/Vue in the future

## When to Implement

Priority: Low. The TUI currently handles formatting inline. Extract shared
utilities when a second consumer (mobile-web, dashboard) needs the same
formatting logic — or when the codebase reaches 3+ duplicate format helpers.

## Consumers

| Consumer | Status |
|----------|--------|
| `apps/tui` | Inline formatting (not yet consuming this package) |
| `apps/mobile-web` | Not yet consuming |
| `apps/dashboard` | Not yet consuming |
