# `@agent-workbench/config`

**Status: ⏳ Stub — planned, not yet implemented.**

This package is declared in AGENTS.md as responsible for layered config loading
from environment variables, config files, and CLI arguments.

Current behavior: `export {};` (empty barrel). The package has a `typecheck`
script but no runtime implementation yet.

## Planned API

```
loadConfig(options?: ConfigOptions): AgentWorkbenchConfig
```

Layered resolution (highest priority wins):

1. **CLI arguments** — `--port=8080`, `--provider openai`
2. **Config files** — `~/.agent-workbench/config.yaml` / `config.json`
3. **Environment variables** — `AGENT_WORKBENCH_PORT`, `AGENT_WORKBENCH_PROVIDER`

### Features

- Schema validation with Zod (from `@agent-workbench/protocol`)
- Secret references: `${{ secrets.MY_SECRET }}` interpolation
- Auto-reload on config file change (optional, via watch mode)
- Profile merging: `base.yaml` + `profile.<name>.yaml` overlay

## Consumers (future)

| Consumer | What it configures |
|----------|-------------------|
| `apps/server` | Server port, TLS, auth, providers |
| `apps/cli` | CLI defaults, plugin paths |
| `packages/core` | Runtime behavior, token budgets |
| `packages/models` | Provider registry defaults |

## Related

- `@agent-workbench/protocol` — Zod schemas for config validation
- `docs/06_SECURITY_MODEL.md` — Secure config storage guidelines
