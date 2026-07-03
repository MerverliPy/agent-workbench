# @agent-workbench/auth

Authentication and authorization for the agent-workbench server. Provides TLS certificate management, API key generation, and user identity verification for remote access.

## Usage

```typescript
import { AuthService } from "@agent-workbench/auth";

const auth = new AuthService({ storage });
await auth.initialize();

// Generate an API key for remote access
const token = await auth.generateApiKey("my-device");
console.log(token); // "aw_abc123..."

// Verify a request token
const identity = await auth.verifyRequest(token);
console.log(identity.deviceId, identity.roles);
```

## API

| Method | Description |
|--------|-------------|
| `generateApiKey(label)` | Create a new API key with optional label |
| `verifyRequest(token)` | Validate and decode a bearer token |
| `revokeKey(id)` | Revoke an existing API key |
| `listKeys()` | List all active API keys |
| `initializeTLS()` | Generate self-signed TLS certificates |

## Scope

- Self-signed TLS certificate generation
- API key / token management
- User identity verification
- Bearer token authentication for SDK clients

Part of **Phase 27** (remote access & collaboration).
