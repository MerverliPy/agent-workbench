/**
 * SSO middleware — validates OIDC bearer tokens and maps claims to RBAC roles.
 *
 * Phase 30: When SSO mode is enabled, this middleware runs before the auth
 * middleware and checks incoming Bearer tokens against the configured OIDC
 * provider. If the token validates, the user's identity and role are set
 * on the request context for downstream handlers.
 *
 * Works alongside the existing auth middleware:
 * - SSO-validated tokens are treated as authenticated
 * - The user's role is set from OIDC groups claim (or SSO default role)
 * - Falls through silently if SSO is disabled or token isn't a JWT
 */

import type { Context } from "hono";
import type { SsoManager } from "@agent-workbench/auth";

export interface SsoMiddlewareOptions {
  readonly sso: SsoManager;
}

export function ssoMiddleware(options: SsoMiddlewareOptions) {
  const { sso } = options;

  return async (c: Context, next: () => Promise<void>) => {
    // Skip if SSO is not enabled
    if (!sso.enabled) {
      await next();
      return;
    }

    // Extract bearer token
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      await next();
      return;
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      await next();
      return;
    }

    // Attempt SSO validation
    try {
      const result = await sso.validateToken(token);
      if (result.valid && result.user) {
        // Set auth context for downstream middleware/handlers
        c.set("auth" as never, {
          authenticated: true,
          subject: result.user.sub,
          method: "sso:oidc",
          email: result.user.email,
          name: result.user.name,
          role: result.role,
          groups: result.user.groups,
        });

        // Also set RBAC context
        c.set("rbac" as never, {
          role: result.role,
          source: "sso",
        });
      }
    } catch {
      // If SSO validation fails (network error, etc.), continue silently
      // The auth middleware will handle it if auth is enabled
    }

    await next();
  };
}
