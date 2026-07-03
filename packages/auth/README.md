# @agent-workbench/auth

Authentication and authorization for the agent-workbench server. Provides TLS certificate management, API key generation, and user identity verification for remote access.

## Usage

```typescript
import { AuthService } from "@agent-workbench/auth";

const auth = new AuthService({ storage });
await auth.initialize();
const token = await auth.generateApiKey("my-device");
```

## Scope

- Self-signed TLS certificate generation
- API key / token management
- User identity verification
- Part of Phase 27 (remote access & collaboration)
