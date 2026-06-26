import { Hono } from "hono";
import type { ServerConfig } from "./config";
import type { ServerAppBindings, ServerServices } from "./context";
import { ApiError } from "./errors";
import { handleAppError } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { registerGlobalRoutes } from "./routes/global";
import { registerSessionRoutes } from "./routes/session-routes";
import { registerMessageRoutes } from "./routes/message-routes";
import { registerPermissionRoutes } from "./routes/permission-routes";
import { registerAgentRoutes } from "./routes/agent-routes";
import { registerTokenHealthRoutes } from "./routes/token-health-routes";
import { registerPlanRoutes } from "./routes/plan-routes";
import { registerPlaceholderRoutes } from "./routes/placeholders";

export interface CreateAppOptions {
  readonly config: ServerConfig;
  readonly services: ServerServices;
  readonly startedAt?: number;
}

export function createApp(options: CreateAppOptions) {
  const app = new Hono<ServerAppBindings>();
  const startedAt = options.startedAt ?? Date.now();

  app.use("*", requestIdMiddleware);

  registerGlobalRoutes(app, {
    config: options.config,
    startedAt,
    eventBus: options.services.eventBus,
  });

  registerSessionRoutes(app, options.services);
  registerMessageRoutes(app, options.services);
  registerPermissionRoutes(app, options.services);
  registerAgentRoutes(app, options.services);
  registerTokenHealthRoutes(app, options.services);
  registerPlanRoutes(app, options.services);
  registerPlaceholderRoutes(app);

  app.notFound((context) => {
    return handleAppError(
      new ApiError({
        status: 404,
        code: "NOT_FOUND",
        message: "Route not found",
        recoverable: true,
      }),
      context
    );
  });

  app.onError((error, context) => handleAppError(error, context));

  return app;
}
