/**
 * Hono middleware for Role-Based Access Control.
 *
 * Phase 30: Protects routes by requiring specific RBAC permissions
 * based on the authenticated user's role. Designed to be layered
 * on top of the existing authMiddleware — it checks the bearer
 * token, looks up the user's role, and returns 403 if the role
 * doesn't have the required permissions.
 *
 * ## Usage
 *
 * ```ts
 * import { rbacMiddleware } from "@agent-workbench/auth";
 *
 * // Protect an admin-only route
 * app.get("/admin/settings", rbacMiddleware({
 *   auth: authManager,
 *   requiredScopes: ["admin"],
 * }), handler);
 *
 * // Or protect a group of routes
 * app.use("/admin/*", rbacMiddleware({
 *   auth: authManager,
 *   requiredScopes: ["admin"],
 * }));
 * ```
 *
 * When auth is globally disabled, the middleware passes through all requests.
 * When RBAC enforcement is disabled (via AGENT_WORKBENCH_RBAC_ENABLED env var),
 * the middleware also passes through.
 */

import type { Context, MiddlewareHandler } from "hono";
import type { AuthManager } from "./auth-manager";
import { ENV_RBAC_ENABLED, resolveRole, roleHasScope } from "./rbac";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RbacMiddlewareOptions {
  /** The AuthManager instance (from server context). */
  readonly auth: AuthManager;
  /** Scopes required to access the route. */
  readonly requiredScopes: readonly string[];
  /** Paths to exclude from RBAC checking (exact match or prefix). */
  readonly excludePaths?: readonly string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isRbacEnabled(): boolean {
  const val = process.env[ENV_RBAC_ENABLED];
  return val === "true" || val === "1";
}

function isPathExcluded(path: string, excludePaths: readonly string[]): boolean {
  for (const exempt of excludePaths) {
    if (path === exempt || path.startsWith(exempt)) {
      return true;
    }
  }
  return false;
}

// ── Middleware ──────────────────────────────────────────────────────────────

/**
 * Create Hono middleware that enforces RBAC permissions.
 *
 * The middleware extracts the bearer token from the Authorization header,
 * validates it via the AuthManager, resolves the user's role, and returns:
 * - 401 if no valid token is provided and auth is enabled
 * - 403 if the user's role lacks the required scopes
 *
 * The middleware passes through when:
 * - Auth is globally disabled
 * - RBAC enforcement is disabled (AGENT_WORKBENCH_RBAC_ENABLED != true)
 * - The request path matches an exclude pattern
 */
export function rbacMiddleware(
  options: RbacMiddlewareOptions,
): MiddlewareHandler {
  const { auth, requiredScopes, excludePaths = [] } = options;

  return async (c: Context, next) => {
    // Skip if auth is disabled
    if (!auth.isEnabled) {
      await next();
      return;
    }

    // Skip if RBAC enforcement is disabled
    if (!isRbacEnabled()) {
      await next();
      return;
    }

    // Skip exempt paths
    const path = new URL(c.req.url).pathname;
    if (isPathExcluded(path, excludePaths as readonly string[])) {
      await next();
      return;
    }

    // Extract bearer token
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      c.status(401);
      return c.json({
        error: "Unauthorized",
        message:
          "Missing or invalid Authorization header. Use: Authorization: Bearer ***",
        recoverable: true,
        status: 401 as const,
      });
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      c.status(401);
      return c.json({
        error: "Unauthorized",
        message: "Bearer token is empty.",
        recoverable: true,
        status: 401 as const,
      });
    }

    // Validate token
    const result = auth.validateToken(token);
    if (!result) {
      c.status(401);
      return c.json({
        error: "Unauthorized",
        message: "Invalid or expired token.",
        recoverable: true,
        status: 401 as const,
      });
    }

    // Resolve the user's role and check permissions
    const role = resolveRole(result.role ?? null);
    const authorized = (requiredScopes as readonly string[]).some((s) =>
      roleHasScope(role, [s]),
    );

    if (!authorized) {
      c.status(403);
      return c.json({
        error: "Forbidden",
        message: `Insufficient permissions. Role "${role}" is not authorised for this action. Required scopes: ${requiredScopes.join(", ")}`,
        recoverable: false,
        status: 403 as const,
      });
    }

    // Set role context for downstream handlers
    c.set("rbac" as never, {
      role,
      requiredScopes,
    });

    await next();
  };
}
