import { metrics } from "../utils/metrics";
import type { Context } from "hono";
import type { ServerAppBindings } from "../context";

export async function metricsMiddleware(
  ctx: Context<ServerAppBindings>,
  next: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await next();
  } finally {
    metrics.inc("http_requests_total", {
      method: ctx.req.method,
      path: ctx.req.routePath || ctx.req.path,
      status: String(ctx.res.status),
    });
  }
}
