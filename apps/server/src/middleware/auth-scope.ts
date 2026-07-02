/**
 * Auth-scope middleware — route-level authorization checks.
 *
 * Phase 27: Checks that the authenticated user's bearer token includes
 * the required scope for the route. Must be used AFTER the auth middleware
 * (which sets `c.get("auth")`).
 *
 * ## Usage
 *
 * ```ts
 * import { requireScope } from "../middleware/auth-scope";
 * import { Scope } from "@agent-workbench/auth";
 *
 * // Protect a specific route
 * app.post("/session/:sessionId/share", requireScope(Scope.SHARE_CREATE), async (c) => { ... });
 * ```
 */

import type { MiddlewareHandler } from "hono";
import { hasScope, Scope } from "@agent-workbench/auth";
import type { AuthContext } from "@agent-workbench/auth";

/**
 * Create a middleware that checks if the authenticated user has the
 * required scope. Returns 403 Forbidden if the scope check fails.
 *
 * When auth is globally disabled, scope checks pass through silently.
 */
export function requireScope(requiredScope: string): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get("auth" as never) as AuthContext | undefined;

    // If no auth context is set (auth disabled), allow all
    if (!auth) {
      await next();
      return;
    }

    // admin scope bypasses all checks
    if (auth.scopes?.includes(Scope.ADMIN)) {
      await next();
      return;
    }

    // Check if the token has the required scope
    if (!hasScope([requiredScope], auth.scopes)) {
      c.status(403);
      return c.json({
        error: "Forbidden",
        message: `Missing required scope: "${requiredScope}". Token scopes: ${(auth.scopes ?? []).join(", ") || "none"}`,
        code: "INSUFFICIENT_SCOPE",
        status: 403 as const,
        recoverable: true,
      });
    }

    await next();
  };
}

/**
 * Create a middleware that checks if the authenticated user has ANY of
 * the required scopes. Returns 403 Forbidden if none match.
 */
export function requireAnyScope(requiredScopes: string[]): MiddlewareHandler {
  return async (c, next) => {
    const auth = c.get("auth" as never) as AuthContext | undefined;

    if (!auth) {
      await next();
      return;
    }

    if (auth.scopes?.includes(Scope.ADMIN)) {
      await next();
      return;
    }

    if (!hasScope(requiredScopes, auth.scopes)) {
      c.status(403);
      return c.json({
        error: "Forbidden",
        message: `Missing required scope. Required one of: "${requiredScopes.join('", "')}". Token scopes: ${(auth.scopes ?? []).join(", ") || "none"}`,
        code: "INSUFFICIENT_SCOPE",
        status: 403 as const,
        recoverable: true,
      });
    }

    await next();
  };
}
