import type { Context } from "hono";
import type { ServerAppBindings } from "../context";

/**
 * Compliance security headers middleware.
 *
 * Adds security headers required for enterprise compliance:
 * - Content-Security-Policy: restricts script/style sources
 * - Strict-Transport-Security: enforces HTTPS
 * - X-Content-Type-Options: prevents MIME sniffing
 * - X-Frame-Options: prevents clickjacking
 * - Referrer-Policy: controls referrer information
 * - Permissions-Policy: restricts browser API access
 * - Cross-Origin-Embedder-Policy: enables cross-origin isolation
 *
 * Configure via environment variables:
 * - AGENT_WORKBENCH_CSP_ENABLED: set to "true" to enable CSP (default: false)
 * - AGENT_WORKBENCH_HSTS_MAX_AGE: max-age in seconds (default: 31536000 = 1 year)
 * - AGENT_WORKBENCH_COMPLIANCE_HEADERS: set to "true" to enable all headers (default: false)
 */
export function complianceHeadersMiddleware() {
  const enabled =
    process.env.AGENT_WORKBENCH_COMPLIANCE_HEADERS === "true";
  const cspEnabled =
    process.env.AGENT_WORKBENCH_CSP_ENABLED === "true";
  const hstsMaxAge =
    process.env.AGENT_WORKBENCH_HSTS_MAX_AGE || "31536000";

  return async (ctx: Context<ServerAppBindings>, next: () => Promise<void>) => {
    if (!enabled) {
      // Still set minimal headers even when compliance mode is off
      ctx.header("X-Content-Type-Options", "nosniff");
      ctx.header("X-Frame-Options", "DENY");
      ctx.header("Referrer-Policy", "strict-origin-when-cross-origin");
      await next();
      return;
    }

    // Full compliance mode
    ctx.header("X-Content-Type-Options", "nosniff");
    ctx.header("X-Frame-Options", "DENY");
    ctx.header("Referrer-Policy", "strict-origin-when-cross-origin");
    ctx.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    ctx.header("Cross-Origin-Embedder-Policy", "require-corp");
    ctx.header(
      "Strict-Transport-Security",
      `max-age=${hstsMaxAge}; includeSubDomains; preload`,
    );

    if (cspEnabled) {
      ctx.header(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self' ws: wss:",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "base-uri 'self'",
          "object-src 'none'",
        ].join("; "),
      );
    }

    await next();
  };
}
