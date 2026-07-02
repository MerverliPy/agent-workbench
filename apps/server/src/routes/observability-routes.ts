import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";

/**
 * Phase 25 observability routes: /metrics (Prometheus), /health/detailed,
 * /observability/spans, /observability/errors, /observability/audit-log.
 */
export function registerObservabilityRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { tracer, metricsExporter, errorReporter, requestLogger, providerHealthMonitor } = services;

  // ── Prometheus metrics endpoint ──────────────────────────────────────────

  app.get("/metrics", (ctx) => {
    const prometheus = metricsExporter.toPrometheus();
    return ctx.newResponse(prometheus, 200, {
      "Content-Type": "text/plain; charset=utf-8",
    });
  });

  // ── Detailed health check with provider status ───────────────────────────

  app.get("/health/detailed", (ctx) => {
    const providerStatus = providerHealthMonitor.getAllStatus();
    const healthStatus = providerStatus.every(
      (p) => p.status === "healthy" || p.status === "unknown",
    )
      ? "healthy"
      : "degraded";

    return ctx.json({
      status: healthStatus,
      uptime: process.uptime(),
      providers: providerStatus.map((p) => ({
        id: p.providerId,
        status: p.status,
        errorRate: p.errorRate,
        p50LatencyMs: p.p50LatencyMs,
        p95LatencyMs: p.p95LatencyMs,
      })),
    });
  });

  // ── Recent spans (for dashboard) ──────────────────────────────────────────

  app.get("/observability/spans", (ctx) => {
    const limit = Number(ctx.req.query("limit") ?? "100");
    const name = ctx.req.query("name");
    const spans = name
      ? tracer.getRecentSpans(limit, name)
      : tracer.getRecentSpans(limit);

    return ctx.json({
      items: spans.map((s) => ({
        spanId: s.spanId,
        traceId: s.traceId,
        name: s.name,
        status: s.status,
        durationMs: tracer.getDuration(s),
        startTime: s.startTime,
      })),
    });
  });

  // ── Recent errors ─────────────────────────────────────────────────────────

  app.get("/observability/errors", (ctx) => {
    const limit = Number(ctx.req.query("limit") ?? "50");
    return ctx.json({ items: errorReporter.getRecentErrors(limit) });
  });

  // ── Tracer info ──────────────────────────────────────────────────────────

  app.get("/observability/tracer", (ctx) => {
    return ctx.json({
      spanCount: tracer.size,
      recentSpans: tracer.getRecentSpans(20).map((s) => ({
        name: s.name,
        status: s.status,
        durationMs: tracer.getDuration(s),
      })),
    });
  });
}
