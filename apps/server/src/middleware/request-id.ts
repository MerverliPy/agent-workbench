import type { MiddlewareHandler } from "hono";
import type { ServerAppBindings } from "../context";

export const requestIdMiddleware: MiddlewareHandler<ServerAppBindings> = async (context, next) => {
  const requestId = crypto.randomUUID();
  context.set("requestId", requestId);
  await next();
  context.res.headers.set("x-request-id", requestId);
};
