# 🔌 @agent-workbench/sdk

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-2..16-blue)]()

Typed client transport for HTTP/SSE communication with the local server.

## Status

**Complete** — Phase 2 (base) through Phase 16 (streaming). Provides a fully typed client wrapping all server routes.

## Purpose

Provides the typed client interface that the TUI and future clients use to communicate with the agent-workbench server. Wraps HTTP and SSE transports, validates requests/responses against protocol schemas.

## Key Modules

| Resource | Purpose |
|----------|---------|
| `WorkbenchClient` | Main client — configures transports, exposes all resource modules |
| `HttpTransport` | HTTP request transport with error handling |
| `SseTransport` | SSE event stream transport with reconnection |
| `HealthResource` | `GET /health` |
| `SessionResource` | Session CRUD |
| `MessageResource` | Message submit and stream |
| `EventResource` | SSE event subscription |
| `ProviderResource` | Provider metadata |
| `FileResource` | File operations |
| `ToolResource` | Tool invocation |
| `PermissionResource` | Permission request/response |
| `AgentResource` | Agent mode selection |
| `TokenHealthResource` | Token health queries |
| `PlanResource` | Plan gates |
| `ConfigResource` | Configuration |
| `AuthResource` | Authentication |
| `TuiResource` | TUI-specific bindings |

## Usage

```typescript
import { WorkbenchClient } from "@agent-workbench/sdk";

const client = new WorkbenchClient({
  baseUrl: "http://localhost:3000",
});

// Health check
const health = await client.health.check();

// Subscribe to events
const unsubscribe = client.events.on("message", (event) => {
  console.log("New message:", event.data);
});

// Submit a prompt
const response = await client.messages.submit({
  sessionId: "01J...",
  content: "Read the README",
});
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: server routes, runtime orchestration, storage, tools, permissions.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md)
