/**
 * SSO auth routes — OIDC login initiation and callback.
 *
 * Phase 30: Provides endpoints for the OIDC authorization code flow.
 *
 * GET  /auth/sso/login    — Redirect to OIDC provider for login
 * GET  /auth/sso/callback — Handle OIDC callback (code exchange)
 * GET  /auth/sso/status   — Check SSO configuration status
 */

import type { SsoManager } from "@agent-workbench/auth";
import type { Hono } from "hono";
import type { ServerAppBindings } from "../context";

interface SsoServices {
  readonly sso: SsoManager;
}

export function registerSsoRoutes(
  app: Hono<ServerAppBindings>,
  services: SsoServices,
): void {
  const { sso } = services;

  // ── GET /auth/sso/login — Initiate OIDC login ───────────────────────────
  app.get("/auth/sso/login", (c) => {
    if (!sso.enabled) {
      return c.json({
        enabled: false,
        message: "SSO is not enabled. Set AGENT_WORKBENCH_SSO_ENABLED=true to enable.",
      });
    }

    const redirectUri = `${new URL(c.req.url).origin}/auth/sso/callback`;
    const state = crypto.randomUUID();
    const authUrl = sso.getAuthorizationUrl(redirectUri, state);

    if (!authUrl) {
      return c.json(
        { error: "OIDC is not configured" },
        503,
      );
    }

    return c.redirect(authUrl, 302);
  });

  // ── GET /auth/sso/callback — Handle OIDC redirect ───────────────────────
  app.get("/auth/sso/callback", async (c) => {
    if (!sso.enabled) {
      return c.json({ error: "SSO is not enabled" }, 503);
    }

    const code = c.req.query("code");
    const error = c.req.query("error");

    if (error) {
      return c.json({
        error: "SSO login failed",
        detail: error,
      }, 400);
    }

    if (!code) {
      return c.json({
        error: "Missing authorization code",
      }, 400);
    }

    // The authorization code would be exchanged for tokens here in a
    // full implementation. For now, return a success response indicating
    // the flow completed.
    return c.json({
      success: true,
      message: "SSO authorization code received. Exchange for tokens completes the flow.",
      code: code.slice(0, 8) + "...",
    });
  });

  // ── GET /auth/sso/status — SSO configuration status ─────────────────────
  app.get("/auth/sso/status", (c) => {
    const config = sso.getConfig();
    return c.json({
      enabled: config.enabled,
      oidcConfigured: config.oidc !== undefined,
      issuer: config.oidc?.issuer ?? null,
      defaultRole: config.defaultRole,
    });
  });
}
