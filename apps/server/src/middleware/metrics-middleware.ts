import type { MiddlewareHandler } from "hono";
import type { MetricsExporter } from "@agent-workbench/telemetry";
import type { ServerAppBindings } from "../context";

/**
 * Middleware that records HTTP request metrics (counters + latency histograms).
 */
export function metricsMiddleware(
  metricsExporter?: MetricsExporter,
): MiddlewareHandler<ServerAppBindings> {
  return async (ctx, next) => {
    const start = Date.now();

    try {
      await next();
      const durationMs = Date.now() - start;

      if (metricsExporter) {
        metricsExporter.incrementCounter("http_requests_total", {
          method: ctx.req.method as string,
          path: ctx.req.path as string,
          status: String(ctx.res.status),
        });
        metricsExporter.observeLatency("http_request_duration_ms", durationMs, {
          method: ctx.req.method as string,
        });
      }
    } catch (err) {
      if (metricsExporter) {
        metricsExporter.incrementCounter("http_requests_total", {
          method: ctx.req.method as string,
          path: ctx.req.path as string,
          status: "500",
        });
      }
      throw err;
    }
  };
}
