import { authMiddleware } from "@agent-workbench/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ServerConfig } from "./config";
import type { ServerAppBindings, ServerServices } from "./context";
import { ApiError } from "./errors";
import { auditLogMiddleware } from "./middleware/audit-log";
import { complianceHeaders } from "./middleware/compliance-headers";
import { handleAppError } from "./middleware/error-handler";
import { metricsMiddleware } from "./middleware/metrics-middleware";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestIdMiddleware } from "./middleware/request-id";
import { ssoMiddleware } from "./middleware/sso-middleware";
import { tracingMiddleware } from "./middleware/tracing";
import { registerAgentRoutes } from "./routes/agent-routes";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerCollabRoutes } from "./routes/collab-routes";
import { registerDataRoutes } from "./routes/data-routes";
import { registerFileRoutes } from "./routes/file-routes";
import { registerGitRoutes } from "./routes/git-routes";
import { registerGlobalRoutes } from "./routes/global";
import { registerMarketplaceRoutes } from "./routes/marketplace-routes";
import { registerMessageRoutes } from "./routes/message-routes";
import { registerObservabilityRoutes } from "./routes/observability-routes";
import { registerPermissionRoutes } from "./routes/permission-routes";
import { registerPlaceholderRoutes } from "./routes/placeholders";
import { registerPlanRoutes } from "./routes/plan-routes";
import { registerPluginRoutes } from "./routes/plugin-routes";
import { registerProviderRoutes } from "./routes/provider-routes";
import { registerReviewRoutes } from "./routes/review-routes";
import { registerSessionRoutes } from "./routes/session-routes";
import { registerShareRoutes } from "./routes/share-routes";
import { registerTokenHealthRoutes } from "./routes/token-health-routes";
import { registerWorkspaceRoutes } from "./routes/workspace-routes";

export interface CreateAppOptions {
  readonly config: ServerConfig;
  readonly services: ServerServices;
  readonly startedAt?: number;
}

export function createApp(options: CreateAppOptions) {
  const app = new Hono<ServerAppBindings>();
  const startedAt = options.startedAt ?? Date.now();
  const { tracer, metricsExporter } = options.services;

  app.use("*", requestIdMiddleware);
  app.use("*", auditLogMiddleware(5000));
  app.use("*", complianceHeaders());
  app.use("*", rateLimitMiddleware());
  app.use("*", metricsMiddleware(metricsExporter));
  app.use("*", tracingMiddleware(tracer));
  app.use(
    "*",
    cors({
      // ADR-0004: localhost-only by default. Allow loopback and explicit
      // environment overrides so mobile-web and TUI can connect.
      origin: (origin) => {
        const allowedOrigins = [
          /^https?:\/\/localhost(:\d+)?$/,
          /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
          /^https?:\/\/\[::1\](:\d+)?$/,
          // Tailscale IPs (100.x.x.x)
          /^https?:\/\/100\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
          // WSL / Docker bridge
          /^https?:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
          // Local network
          /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
        ];
        const envOverride = process.env.AGENT_WORKBENCH_CORS_ORIGINS;
        if (envOverride) {
          const patterns = envOverride
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          for (const pat of patterns) {
            allowedOrigins.push(new RegExp(pat));
          }
        }
        if (!origin) return "*"; // same-origin requests; allow
        const ok = allowedOrigins.some((r) => r.test(origin));
        return ok ? origin : null;
      },
    }),
  );

  // Phase 27: Authentication middleware — protects all routes except
  // exempt paths (/health, /auth/token, /info).
  if (options.services.auth.isEnabled) {
    app.use(
      "*",
      authMiddleware({
        auth: options.services.auth,
        excludePaths: [
          "/global/health",
          "/global/info",
          "/auth/token",
          "/auth/status",
          "/auth/sso/login",
          "/auth/sso/callback",
          "/metrics",
        ],
      }),
    );
  }

  // Phase 30: SSO middleware — conditionally enabled when env vars are set
  const ssoIssuer = process.env.AGENT_WORKBENCH_SSO_ISSUER;
  const ssoClientId = process.env.AGENT_WORKBENCH_SSO_CLIENT_ID;
  const ssoClientSecret = process.env.AGENT_WORKBENCH_SSO_CLIENT_SECRET;
  const ssoRedirectUri = process.env.AGENT_WORKBENCH_SSO_REDIRECT_URI;
  const ssoSessionSecret = process.env.AGENT_WORKBENCH_AUTH_SECRET;
  if (
    ssoIssuer &&
    ssoClientId &&
    ssoClientSecret &&
    ssoRedirectUri &&
    ssoSessionSecret
  ) {
    app.use(
      "/auth/sso/*",
      ssoMiddleware({
        issuer: ssoIssuer,
        clientId: ssoClientId,
        clientSecret: ssoClientSecret,
        redirectUri: ssoRedirectUri,
        sessionSecret: ssoSessionSecret,
      }),
    );
    console.log(`[sso] OIDC SSO enabled — issuer: ${ssoIssuer}`);
  }

  registerAuthRoutes(app, { auth: options.services.auth });
  registerCollabRoutes(app, options.services);
  registerShareRoutes(app, options.services);
  registerReviewRoutes(app, options.services);
  registerDataRoutes(app, options.services);
  registerGlobalRoutes(app, {
    config: options.config,
    startedAt,
    eventBus: options.services.eventBus,
    sessionRepository: options.services.sessionRepository,
  });

  registerSessionRoutes(app, options.services);
  registerMessageRoutes(app, options.services);
  registerPermissionRoutes(app, options.services);
  registerAgentRoutes(app, options.services);
  registerTokenHealthRoutes(app, options.services);
  registerPlanRoutes(app, options.services);
  registerProviderRoutes(app, options.services);
  registerFileRoutes(app);
  registerGitRoutes(app);
  registerWorkspaceRoutes(app, options.services);
  registerMarketplaceRoutes(app, options.services);
  registerObservabilityRoutes(app, options.services);
  registerPluginRoutes(app, options.services);
  registerPlaceholderRoutes(app);

  app.notFound((context) => {
    return handleAppError(
      new ApiError({
        status: 404,
        code: "NOT_FOUND",
        message: "Route not found",
        recoverable: true,
      }),
      context,
    );
  });

  app.onError((error, context) => handleAppError(error, context));

  return app;
}
