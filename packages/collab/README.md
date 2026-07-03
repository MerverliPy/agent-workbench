# @agent-workbench/collab

Real-time collaboration primitives for the agent-workbench server. Provides shared session management, user presence tracking, share links, and review queue functionality.

## Usage

```typescript
import { SharedSessionManager, PresenceManager } from "@agent-workbench/collab";

const sessions = new SharedSessionManager({ eventBus });
const presence = new PresenceManager({ eventBus, sharedSessionManager: sessions });
```

## Scope

- Shared session lifecycle management
- Per-user presence tracking with TTL
- Share link generation and access control
- Review queue for collaborative code review
- Part of Phase 27 (remote access & collaboration)
