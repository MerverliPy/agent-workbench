# 📡 @agent-workbench/events

[![Status](https://img.shields.io/badge/status-complete-brightgreen)]()
[![Phase](https://img.shields.io/badge/Phase-3-blue)]()

Internal event bus, event definitions, and SSE encoding support.

## Status

**Complete** — Phase 3. Event bus with typed event names and SSE-friendly event envelopes.

## Purpose

Provides the internal event infrastructure for communication between runtime components. Defines typed event names and an event bus that components use to publish and subscribe to runtime events.

## Key Modules

| Module | Export | Responsibility |
|--------|--------|---------------|
| `bus` | `EventBus`, `EventHandler` | Typed in-process event bus |
| `names` | `EventName`, `EventNameValue` | Centralized event name definitions |

## Re-exports

```typescript
// Re-exported from @agent-workbench/protocol for consumer convenience
export type { EventEnvelope } from "@agent-workbench/protocol";
```

## Usage

```typescript
import { EventBus, EventName } from "@agent-workbench/events";

const bus = new EventBus();

// Subscribe
const unsubscribe = bus.on(EventName.TOOL_CALL_START, (event) => {
  console.log("Tool started:", event.data);
});

// Publish
bus.emit({
  name: EventName.TOOL_CALL_START,
  sessionId: "session-1",
  data: { toolName: "read", args: { path: "./README.md" } },
});
```

## Commands

```bash
bun run typecheck
bun run build
```

## Boundary

Does **not** own: SSE server transport, SDK client, runtime orchestration, storage.

👉 See [`docs/03_BACKEND_FRONTEND_BOUNDARY.md`](../docs/03_BACKEND_FRONTEND_BOUNDARY.md)
