# ⚙️ @agent-workbench/config

[![Status](https://img.shields.io/badge/status-stable-blue)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

Layered configuration loading, resolution, validation, and environment variable management for agent-workbench.

## Status

**Stable** — Provides configuration primitives used across the monorepo for server, client, and plugin configuration.

## What's Here

### Layered Config Resolution

Configuration is resolved in priority order (highest wins):

1. **Defaults** — Built-in default values for every option
2. **Environment variables** — Override via `AGENT_WORKBENCH_*` and provider-specific env vars
3. **Config file** — YAML/JSON config file from `~/.agent-workbench/config.yaml`
4. **CLI flags** — Command-line arguments (highest priority)

### Key Functions

| Export | Signature | Description |
|--------|-----------|-------------|
| `loadConfig` | `(overrides?: Partial<Config>) => Config` | Load and resolve full configuration |
| `loadConfigFile` | `(path?: string) => ConfigFile \| null` | Load config from file path |
| `resolveEnv` | `(key: string, prefix?: string) => string \| undefined` | Read env var with prefix resolution |
| `watchConfig` | `(onChange: (config: Config) => void) => () => void` | Watch config file for changes |

### Schema Validation

All configuration is validated at load time using Zod schemas:

```ts
const ConfigSchema = z.object({
  server: z.object({
    host: z.string().default("localhost"),
    port: z.coerce.number().int().min(1024).max(65535).default(4096),
  }),
  storage: z.object({
    path: z.string().default("~/.agent-workbench/data"),
    provider: z.enum(["sqlite"]).default("sqlite"),
  }),
  providers: z.record(z.object({
    apiKey: z.string().optional(),
    model: z.string().optional(),
    baseUrl: z.string().url().optional(),
  })).optional(),
});
```

### Secret Reference Resolution

Config values can reference secrets from environment variables using `${{ secrets.ENV_NAME }}` syntax:

```yaml
providers:
  openai:
    apiKey: "${{ secrets.OPENAI_API_KEY }}"
```

The resolver looks up the referenced env var and substitutes its value at load time. Unresolved references throw a `ConfigError`.

### Config Reload / Change Detection

`watchConfig()` uses `fs.watch` to monitor the config file for changes and emits a callback when the file is modified. The returned disposer function stops watching:

```ts
const stop = watchConfig((newConfig) => {
  console.log("Config updated:", newConfig);
});
// Later:
stop();
```

## Usage

```ts
import { loadConfig, watchConfig } from "@agent-workbench/config";

const config = loadConfig();
console.log(config.server.port); // 4096

// Watch for hot-reload
const stop = watchConfig((updated) => {
  applyNewConfig(updated);
});
```

## Boundary

Does **not** own: model provider configuration (packages/models), server-specific config, storage config, or runtime orchestration.
