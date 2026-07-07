# `@agent-workbench/config`

**Status: ⏳ Stub — planned, not yet implemented.**

This package is declared in AGENTS.md as responsible for layered config loading
from env, files, and CLI args. No runtime implementation exists yet.

Current behavior: `export {};` (empty barrel).

## Plan

- Load config from environment variables (priority: lowest)
- Load config from YAML/JSON files in `~/.agent-workbench/config/`
- Load config from CLI arguments (priority: highest)
- Secret references: `${{ secrets.MY_SECRET }}` interpolation
- Schema validation with Zod

## Consumers

Currently: none. When implemented, consumers include:
- `apps/server` — server config
- `apps/cli` — CLI settings
- `packages/core` — runtime configuration
