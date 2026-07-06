import type { MiddlewareHandler } from "hono";

export type ComplianceHeaderMode = "strict" | "report-only" | "disabled";

export interface ComplianceHeadersConfig {
  /** Strictness mode (default: "strict"). */
  mode?: ComplianceHeaderMode;
  /** Whether the server is behind HTTPS (enables HSTS). */
  isHttps?: boolean;
  /** Additional custom headers to add. */
  extraHeaders?: Record<string, string>;
  /** Endpoints to exempt from CSP (e.g. SSE streaming endpoints). */
  cspExemptPaths?: string[];
  /** Allowed connect-src origins (extending the default set). */
  extraConnectSrc?: string[];
  /** Allowed script-src origins (extending the default set). */
  extraScriptSrc?: string[];
}

const DEFAULT_CSP_CONNECT_SRC = [
  "'self'",
  "http://localhost:*",
  "ws://localhost:*",
  "https://api.github.com",
];

const DEFAULT_CSP_FRAME_SRC = ["'none'"];
const DEFAULT_CSP_IMG_SRC = ["'self'", "data:", "https:"];
const DEFAULT_CSP_SCRIPT_SRC = ["'self'", "'unsafe-inline'"]; // unsafe-inline needed for inline theme init script
const DEFAULT_CSP_STYLE_SRC = ["'self'", "'unsafe-inline'"];

/**
 * Build the Content-Security-Policy string from the config.
 */
function buildCsp(config: ComplianceHeadersConfig): string {
  const connectSrc = [
    ...DEFAULT_CSP_CONNECT_SRC,
    ...(config.extraConnectSrc ?? []),
  ];
  const scriptSrc = [
    ...DEFAULT_CSP_SCRIPT_SRC,
    ...(config.extraScriptSrc ?? []),
  ];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "connect-src": connectSrc,
    "frame-src": DEFAULT_CSP_FRAME_SRC,
    "img-src": DEFAULT_CSP_IMG_SRC,
    "script-src": scriptSrc,
    "style-src": DEFAULT_CSP_STYLE_SRC,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "upgrade-insecure-requests": [],
  };

  return Object.entries(directives)
    .filter(([_, values]) => values.length > 0)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Compliance headers middleware.
 *
 * Adds security headers to every response:
 * - Content-Security-Policy (configurable)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy
 * - Permissions-Policy
 * - Strict-Transport-Security (if HTTPS)
 */
export function complianceHeaders(
  config: ComplianceHeadersConfig = {},
): MiddlewareHandler {
  const mode = config.mode ?? "strict";
  const isHttps = config.isHttps ?? false;
  const cspExemptPaths = new Set(config.cspExemptPaths ?? []);

  // Build CSP header once
  const cspValue = buildCsp(config);
  const cspHeaderName =
    mode === "report-only"
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

  return async (context, next) => {
    const path = context.req.path;

    // Set X-Content-Type-Options
    context.header("X-Content-Type-Options", "nosniff");

    // Set X-Frame-Options
    context.header("X-Frame-Options", "DENY");

    // Set Referrer-Policy
    context.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Set Permissions-Policy (block sensitive APIs)
    context.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), display-capture=(), fullscreen=(self)",
    );

    // Set HSTS only when behind HTTPS
    if (isHttps) {
      context.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }

    // CSP — skip for SSE streaming endpoints
    if (mode !== "disabled" && !cspExemptPaths.has(path)) {
      context.header(cspHeaderName, cspValue);
    }

    // Extra custom headers
    if (config.extraHeaders) {
      for (const [key, value] of Object.entries(config.extraHeaders)) {
        context.header(key, value);
      }
    }

    await next();
  };
}
