/**
 * @agent-workbench/auth — Phase 27: Remote access & collaboration
 *
 * Provides bearer token authentication middleware for Hono,
 * TLS certificate generation, and time-limited session tokens.
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
 */
export { AuthManager } from "./auth-manager";
export {
  type AuthContext,
  type AuthMiddlewareOptions,
  authMiddleware,
} from "./auth-middleware";
export type { ScopeValue } from "./scopes";
export { defaultScopes, hasScope, Scope, scopeMatches } from "./scopes";
export { SessionToken, type SessionTokenConfig } from "./session-tokens";
export { TlsConfig, type TlsConfigOptions } from "./tls-config";
export { InMemoryTokenStore, type TokenRecord } from "./token-store";
// Phase 30: RBAC
export type { Role } from "./rbac";
export {
  ENV_DEFAULT_ROLE,
  ENV_RBAC_ENABLED,
  ROLES,
  getRoleScopes,
  isValidRole,
  resolveRole,
  roleHasScope,
} from "./rbac";
export {
  rbacMiddleware,
  type RbacMiddlewareOptions,
} from "./rbac-middleware";
// Phase 30: SSO
export { SsoManager } from "./sso";
export type {
  SsoConfig,
  OidcConfig,
  SamlConfig,
  SsoUser,
  SsoValidationResult,
} from "./sso";
