/**
 * RBAC Hono middleware — checks authenticated user's role against
 * route requirements.
 *
 * Must be used AFTER the auth middleware so that `c.get("auth")` is set.
 *
 * ## Usage
 *
 * ```ts
 * import { requireRole, requireScopes } from "@agent-workbench/auth/middleware";
 *
 * // Protect an entire route group
 * app.use("/admin/*", requireRole("admin"));
 *
 * // Protect a specific route
 * app.get("/api/sessions", requireScopes(["session:read"]), handler);
 * ```
 */

import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { hasScope } from "./scopes";
import { hasRole } from "./roles";
import type { Role } from "./roles";
import type { AuthContext } from "./auth-middleware";

/**
 * Require a specific role to access the route.
 * Returns 403 if the user is not authenticated or has insufficient role.
 */
export function requireRole(role: Role): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const auth = c.get("auth") as AuthContext | undefined;

    if (!auth?.authenticated) {
      c.status(401);
      return c.json({
        error: "Unauthorized",
        message: "Authentication required",
        recoverable: true,
        status: 401 as const,
      });
    }

    if (!hasRole(role, auth.scopes)) {
      c.status(403);
      return c.json({
        error: "Forbidden",
        message: `Role '${role}' or higher is required`,
        recoverable: false,
        status: 403 as const,
      });
    }

    await next();
  });
}

/**
 * Require specific scopes to access the route.
 * Returns 403 if the user's token scopes don't include any of the required scopes.
 */
export function requireScopes(requiredScopes: string[]): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const auth = c.get("auth") as AuthContext | undefined;

    if (!auth?.authenticated) {
      c.status(401);
      return c.json({
        error: "Unauthorized",
        message: "Authentication required",
        recoverable: true,
        status: 401 as const,
      });
    }

    if (!hasScope(requiredScopes, auth.scopes)) {
      c.status(403);
      return c.json({
        error: "Forbidden",
        message: `Required scopes: ${requiredScopes.join(", ")}`,
        recoverable: false,
        status: 403 as const,
      });
    }

    await next();
  });
}
