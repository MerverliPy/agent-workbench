# ⚙️ @agent-workbench/config

[![Status](https://img.shields.io/badge/status-stable-blue)]()
[![Phase](https://img.shields.io/badge/Phase-1-lightgrey)]()

Layered configuration loading, resolution, validation, and environment variable management for agent-workbench.

## Status

**Stable** — Provides configuration primitives used across the monorepo for server, client, and plugin configuration.

## What's Here

- Layered config loading (defaults → env vars → config file → CLI flags)
- Schema validation via Zod
- Secret reference resolution
- Config reload/change detection

## Usage

```ts
import { loadConfig } from "@agent-workbench/config";
const config = loadConfig();
```

## Boundary

Does **not** own: model provider configuration (packages/models), server-specific config, storage config, or runtime orchestration.
