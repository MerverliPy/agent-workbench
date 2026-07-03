# @agent-workbench/collab

Real-time collaboration primitives for the agent-workbench server. Provides shared session management, user presence tracking, share links, and review queue functionality.

## Usage

```typescript
import { SharedSessionManager, PresenceManager, ShareLinkManager, ReviewQueue } from "@agent-workbench/collab";

// Share a session with another user
const sessions = new SharedSessionManager({ eventBus });
const presence = new PresenceManager({ eventBus, sharedSessionManager: sessions });

await sessions.share("session-123", ["user-bob"]);

// Track presence
presence.heartbeat("user-alice", { sessionId: "session-123" });
const online = presence.getOnlineUsers("session-123");
```

## API

| Module | Description |
|--------|-------------|
| `SharedSessionManager` | Session sharing lifecycle (sharing, joining, leaving) |
| `PresenceManager` | Per-user presence with TTL-based heartbeats |
| `ShareLinkManager` | Generate and validate share links |
| `ReviewQueue` | Collaborative code review queue |

## Scope

- Shared session lifecycle management
- Per-user presence tracking with TTL
- Share link generation and access control
- Review queue for collaborative code review

Part of **Phase 27** (remote access & collaboration).
