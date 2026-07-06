/**
 * @agent-workbench/auth — Phase 27: Remote access & collaboration
 *
 * Provides bearer token authentication middleware for Hono,
 * TLS certificate generation, time-limited session tokens,
 * and role-based access control (RBAC).
 *
 * ## Usage
 *
 * ```ts
 * import { AuthManager, authMiddleware } from "@agent-workbench/auth";
 *
 * const auth = new AuthManager({ sharedSecret: "my-secret" });
 * app.use("/api/*", authMiddleware({ auth, excludePaths: ["/health", "/auth/token"] }));
 * ```
 *
 * ## Environment Variables
 *
 * | Variable | Default | Description |
 * |----------|---------|-------------|
 * | `AGENT_WORKBENCH_AUTH_SECRET` | (none) | Shared secret for token generation. If unset, auth is disabled. |
 * | `AGENT_WORKBENCH_AUTH_ENABLED` | `false` | Set to `true` to require authentication on all non-exempt routes. |
 * | `AGENT_WORKBENCH_TLS_ENABLED` | `false` | Set to `true` to serve HTTPS with auto-generated certs. |
 * | `AGENT_WORKBENCH_TLS_CERT` | (auto-gen) | Path to TLS certificate file. |
 * | `AGENT_WORKBENCH_TLS_KEY` | (auto-gen) | Path to TLS key file. |
 * | `AGENT_WORKBENCH_TOKEN_TTL_MS` | `3600000` | Session token time-to-live in milliseconds (default: 1 hour). |
 * | `AGENT_WORKBENCH_DEFAULT_ROLE` | `"admin"` | Default role assigned to tokens without explicit role mapping. |
 */
export { AuthManager } from "./auth-manager";
export {
  type AuthContext,
  type AuthMiddlewareOptions,
  authMiddleware,
} from "./auth-middleware";
export { Scope, defaultScopes, hasScope, scopeMatches } from "./scopes";
export type { ScopeValue } from "./scopes";
export {
  getRoleFromScopes,
  getScopesForRole,
  hasRole,
  listRoles,
} from "./roles";
export type { Role } from "./roles";
export { SessionToken, type SessionTokenConfig } from "./session-tokens";
export { TlsConfig, type TlsConfigOptions } from "./tls-config";
export { InMemoryTokenStore, type TokenRecord } from "./token-store";
