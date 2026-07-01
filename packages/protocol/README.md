# 📜 @agent-workbench/protocol

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-2-blue)]()

Zod schemas, route contracts, error envelopes, event envelopes, and OpenAPI metadata.

## Status

**Complete** — Phase 2. All route contracts and schemas are implemented.

## Purpose

Schema-first protocol layer that serves as the single source of truth for all data shapes in the system. Used by the server, SDK, TUI, and all packages to ensure type-safe communication.

## Route Contracts

| Module | Routes defined |
|--------|---------------|
| `session` | Session lifecycle (create, list, get) |
| `message` | Message submission, streaming |
| `provider` | Provider metadata (list, get, model) |
| `tool` | Tool invocation |
| `file` | File operations |
| `permission` | Permission request/response |
| `agent` | Agent mode listing |
| `plan` | Plan creation and validation |
| `token-health` | Token health queries |
| `health` | Server health check |
| `config` | Configuration endpoints |
| `auth` | Authentication |
| `event` | Event-streaming |
| `tui` | TUI-specific bindings |
| `info` | Server metadata |

## Schemas

| Module | Exports |
|--------|---------|
| `common` | Shared types, error envelopes |
| `session` | Session types |
| `provider` | Provider configuration types |
| `run` | Run record types |

## Exports

```typescript
// All schemas and route contracts
export * from "./schemas";
export * from "./routes";
export * from "./openapi";
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: server implementation, SDK client, runtime orchestration, storage, tool definitions.

👉 See [`docs/07_API_CONTRACT_PLAN.md`](../docs/07_API_CONTRACT_PLAN.md)
