/**
 * Auth routes — token issuance, status, and management.
 *
 * Phase 27: Provides endpoints for obtaining bearer tokens and
 * checking authentication status. These routes are exempt from
 * the auth middleware check.
 *
 * POST /auth/token   — Exchange shared secret for a bearer token
 * GET  /auth/status  — Check if the current request is authenticated
 * GET  /auth/tokens  — List active tokens (authenticated)
 * DELETE /auth/token — Revoke a token (authenticated)
 */

import { Hono } from "hono";
import type { AuthManager } from "@agent-workbench/auth";
import { Scope } from "@agent-workbench/auth";
import type { ServerAppBindings } from "../context";
import { requireScope } from "../middleware/auth-scope";
import { ApiError } from "../errors";
import { handleAppError } from "../middleware/error-handler";

interface AuthServices {
  readonly auth: AuthManager;
}

export function registerAuthRoutes(app: Hono<ServerAppBindings>, services: AuthServices): void {
  const { auth } = services;

  // ── POST /auth/token — Exchange shared secret for a bearer token ────────
  app.post("/auth/token", async (c) => {
    try {
      const body = await c.req.json<{ secret?: string; label?: string; scopes?: string[] }>();
      const providedSecret = body.secret;
      const label = body.label ?? "unnamed-client";
      const requestedScopes = body.scopes;

      if (!providedSecret) {
        return c.json(
          new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message: "Missing required field: 'secret'",
            recoverable: true,
          }),
          400,
        );
      }

      const expectedSecret = auth.getSharedSecret();
      if (!expectedSecret) {
        return c.json(
          new ApiError({
            status: 503,
            code: "AUTH_NOT_CONFIGURED",
            message: "Authentication is not configured. Set AGENT_WORKBENCH_AUTH_SECRET to enable.",
            recoverable: false,
          }),
          503,
        );
      }

      if (providedSecret !== expectedSecret) {
        return c.json(
          new ApiError({
            status: 403,
            code: "FORBIDDEN",
            message: "Invalid shared secret.",
            recoverable: true,
          }),
          403,
        );
      }

      const result = auth.generateToken(label, requestedScopes);
      if (!result) {
        return c.json(
          new ApiError({
            status: 503,
            code: "TOKEN_GENERATION_FAILED",
            message: "Token generation failed. Auth may be disabled.",
            recoverable: true,
          }),
          503,
        );
      }

      return c.json({
        token: result.token,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json(
          new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message: "Invalid JSON body.",
            recoverable: true,
          }),
          400,
        );
      }
      return handleAppError(
        err instanceof ApiError ? err : new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
          recoverable: false,
        }),
        c,
      );
    }
  });

  // ── GET /auth/status — Check auth status ────────────────────────────────
  app.get("/auth/status", (c) => {
    const authCtx = c.get("auth");

    return c.json({
      authenticated: authCtx?.authenticated ?? false,
      method: authCtx?.authenticated ? `bearer (${authCtx.subject ?? "unknown"})` : "none",
    });
  });

  // ── GET /auth/tokens — List active tokens (requires admin scope) ────────
  app.get("/auth/tokens", requireScope(Scope.ADMIN), (c) => {
    const tokens = auth.listTokens().map((t) => ({
      label: t.label,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
      scopes: t.scopes,
      // Never expose the actual token in list responses
    }));

    return c.json({ tokens });
  });

  // ── DELETE /auth/token/:token — Revoke a token (requires admin scope) ──
  app.delete("/auth/token/:token", requireScope(Scope.ADMIN), (c) => {
    const token = c.req.param("token");
    const revoked = auth.revokeToken(token);

    if (!revoked) {
      return c.json(
        new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: "Token not found.",
          recoverable: true,
        }),
        404,
      );
    }

    return c.json({ success: true, message: "Token revoked." });
  });
}
