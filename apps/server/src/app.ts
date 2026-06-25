import { Hono } from "hono";
import type { ServerConfig } from "./config";
import type { ServerAppBindings } from "./context";
import { ApiError } from "./errors";
import { handleAppError } from "./middleware/error-handler";
import { requestIdMiddleware } from "./middleware/request-id";
import { registerGlobalRoutes } from "./routes/global";
import { registerPlaceholderRoutes } from "./routes/placeholders";

export interface CreateAppOptions {
  readonly config: ServerConfig;
  readonly startedAt?: number;
}

export function createApp(options: CreateAppOptions) {
  const app = new Hono<ServerAppBindings>();
  const startedAt = options.startedAt ?? Date.now();

  app.use("*", requestIdMiddleware);

  registerGlobalRoutes(app, {
    config: options.config,
    startedAt,
  });

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
