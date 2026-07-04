import { authMiddleware, rbacMiddleware, ENV_RBAC_ENABLED, SsoManager } from "@agent-workbench/auth";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ServerConfig } from "./config";
import type { ServerAppBindings, ServerServices } from "./context";
import { ApiError } from "./errors";
import { complianceHeadersMiddleware } from "./middleware/compliance-headers";
import { handleAppError } from "./middleware/error-handler";
import { metricsMiddleware } from "./middleware/metrics-middleware";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { requestIdMiddleware } from "./middleware/request-id";
import { ssoMiddleware } from "./middleware/sso-middleware";
import { tracingMiddleware } from "./middleware/tracing";
import { registerAgentRoutes } from "./routes/agent-routes";
import { registerAuthRoutes } from "./routes/auth-routes";
import { registerCollabRoutes } from "./routes/collab-routes";
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
import { registerSsoRoutes } from "./routes/sso-routes";
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
  app.use("*", rateLimitMiddleware());
  app.use("*", complianceHeadersMiddleware());
  app.use("*", ssoMiddleware({ sso: options.services.sso }));
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
          "/metrics",
        ],
      }),
    );
  }

  // Phase 30: Role-Based Access Control — optional role enforcement
  // gated behind AGENT_WORKBENCH_RBAC_ENABLED env var.
  const rbacEnabled = process.env[ENV_RBAC_ENABLED] === "true" || process.env[ENV_RBAC_ENABLED] === "1";
  if (rbacEnabled && options.services.auth.isEnabled) {
    app.use(
      "/admin/*",
      rbacMiddleware({
        auth: options.services.auth,
        requiredScopes: ["admin"],
        excludePaths: [],
      }),
    );
  }

  registerAuthRoutes(app, { auth: options.services.auth });
  registerSsoRoutes(app, { sso: options.services.sso });
  registerCollabRoutes(app, options.services);
  registerShareRoutes(app, options.services);
  registerReviewRoutes(app, options.services);
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
