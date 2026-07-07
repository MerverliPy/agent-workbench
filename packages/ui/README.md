# `@agent-workbench/ui`

**Status: ⏳ Stub — planned, not yet implemented.**

This package is declared in AGENTS.md as providing shared UI primitives.
No runtime implementation exists yet.

Current behavior: `export {};` (empty barrel).

## Plan

- `formatTimestamp` — human-readable relative/absolute timestamps
- `truncatePath` — path shortening for display
- Color token utilities for consistent theming across TUI, mobile-web, and dashboard
- Non-authoritative UI helpers (no business logic, no state)

## Consumers

Currently: none. When implemented, primary consumer is `apps/tui` (and potentially
`apps/mobile-web` and `apps/dashboard`).
