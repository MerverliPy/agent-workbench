/**
 * Hono middleware for bearer token authentication.
 *
 * Phase 27: Protects routes by requiring a valid bearer token in the
 * Authorization header. Exempt paths can be configured for endpoints
 * like /health, /auth/token, and public assets.
 *
 * ## Usage
 *
 * ```ts
 * import { authMiddleware } from "@agent-workbench/auth";
 *
 * app.use("*", authMiddleware({
 *   auth: authManager,
 *   excludePaths: ["/health", "/auth/token"],
 * }));
 * ```
 *
 * When auth is disabled, the middleware passes through all requests.
 */

import type { Context, MiddlewareHandler } from "hono";
import type { AuthManager } from "./auth-manager";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuthMiddlewareOptions {
  /** The AuthManager instance (from server context). */
  readonly auth: AuthManager;
  /** Paths to exclude from authentication (exact match or prefix). */
  readonly excludePaths?: readonly string[];
}

export interface AuthContext {
  /** Whether the request is authenticated. */
  readonly authenticated: boolean;
  /** The token subject/label if authenticated. */
  readonly subject?: string;
  /** The token scopes if authenticated. */
  readonly scopes?: readonly string[];
}

// ── Middleware ──────────────────────────────────────────────────────────────

/**
 * Create Hono middleware that validates bearer tokens from the
 * Authorization header. Sets `c.set("auth", authContext)` on success.
 *
 * Exempt paths bypass validation entirely (e.g. /health, /auth/token).
 * When auth is globally disabled, all requests pass through.
 */
export function authMiddleware(options: AuthMiddlewareOptions): MiddlewareHandler {
  const { auth, excludePaths = [] } = options;

  return async (c: Context, next) => {
    // Skip auth if disabled
    if (!auth.isEnabled) {
      await next();
      return;
    }

    // Skip exempt paths
    const path = new URL(c.req.url).pathname;
    for (const exempt of excludePaths) {
      if (path === exempt || path.startsWith(exempt)) {
        await next();
        return;
      }
    }

    // Extract bearer token
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      c.status(401);
      return c.json({
        error: "Unauthorized",
        message: "Missing or invalid Authorization header. Use: Authorization: Bearer <token>",
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
        message: "Invalid or expired token. Generate a new one via POST /auth/token.",
        recoverable: true,
        status: 401 as const,
      });
    }

    // Set auth context for downstream handlers
    c.set("auth" as never, {
      authenticated: true,
      subject: result.label,
      scopes: result.scopes,
    } satisfies AuthContext);

    await next();
  };
}
