# 🌐 @agent-workbench/server

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-3..27-blue)]()

Local HTTP/SSE control plane. Owns routes, middleware, and server lifecycle.

## Status

**Complete** — Phases 3–27 (base server, provider routes, streaming, CI pipeline, auth, SSO, compliance headers, air-gapped mode). Full Hono app with all route modules.

## Purpose

Provides the local HTTP and SSE server that the TUI and SDK connect to. Routes requests to the core runtime, manages server lifecycle, and enforces localhost-only binding by default.

## Current Scope

- Hono app and server startup with configurable host/port
- Request validation using `@agent-workbench/protocol` route contracts
- Structured `ErrorEnvelope` responses
- Localhost-only default binding (`127.0.0.1`)
- SSE transport for streaming model responses
- Provider metadata routes (no secrets exposed)
- Permission, session, message, tool, agent, plan, and token-health routes

## Key Routes

| Module | Routes | Purpose |
|--------|--------|---------|
| `global` | `GET /health` | Health check |
| `session-routes` | `POST/GET /session` | Session lifecycle |
| `message-routes` | `POST /session/:id/message` | Message submission & streaming |
| `provider-routes` | `GET /provider`, `/provider/:id`, `/provider/:id/model` | Provider metadata |
| `permission-routes` | `POST /permission` | Permission request/response |
| `plan-routes` | `POST /plan` | Plan creation & validation |
| `agent-routes` | `GET /agent` | Agent mode listing |
| `token-health-routes` | `GET /token-health` | Token health queries |
| `placeholders` | Various | 501 not implemented stubs for future routes |

## Current Boundaries

- Do not import `@agent-workbench/sdk`.
- Do not implement core runtime, storage, tools, permissions, shell, models, diff, cache, planner, or token-health runtime behavior here.
- Consume protocol contracts and schemas instead of hand-writing duplicate DTOs.
- Non-global routes may remain validated placeholders until later phases own their backing behavior.

## How to Run

```bash
# Start the server
bun run start

# Development with auto-reload
bun run dev

# Typecheck
bun run typecheck
```

The server binds to `http://localhost:3000` by default. Configure via `HOST` and `PORT` env vars.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md), [`docs/18_PHASE_EXIT_GATES.md`](../docs/18_PHASE_EXIT_GATES.md), [`docs/19_TARGET_REPO_TREE.md`](../docs/19_TARGET_REPO_TREE.md)
