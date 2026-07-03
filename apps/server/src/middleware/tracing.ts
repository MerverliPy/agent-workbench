import type { Tracer } from "@agent-workbench/telemetry";
import type { MiddlewareHandler } from "hono";
import type { ServerAppBindings } from "../context";

/**
 * Middleware that creates an OpenTelemetry-style span for every request.
 * Uses the existing requestId as the traceId.
 */
export function tracingMiddleware(
  tracer: Tracer,
): MiddlewareHandler<ServerAppBindings> {
  return async (context, next) => {
    const span = tracer.startSpan({
      name: `${context.req.method} ${context.req.routePath || context.req.path}`,
      attributes: {
        method: context.req.method,
        path: context.req.path,
        route: context.req.routePath,
      },
    });

    try {
      await next();
      tracer.endSpan(span, context.res.status >= 500 ? "error" : "ok");
    } catch (err) {
      span.error = err instanceof Error ? err.message : String(err);
      tracer.endSpan(span, "error");
      throw err;
    }
  };
}
