import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";

/** Compute a percentile from a sorted array of numbers. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]!;
}

/**
 * Phase 25 observability routes: /metrics (Prometheus), /health/detailed,
 * /observability/spans, /observability/errors, /observability/audit-log.
 */
export function registerObservabilityRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const {
    tracer,
    metricsExporter,
    errorReporter,
    providerHealthMonitor,
    sessionRepository,
    costTracker,
  } = services;

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

  // ── Dashboard aggregation endpoint ────────────────────────────────────────

  app.get("/observability/dashboard", (_ctx) => {
    // Session statistics
    const allSessions = sessionRepository.list();
    const sessionCounts: Record<string, number> = {};
    let totalSessions = 0;
    for (const s of allSessions) {
      const status = s.status ?? "unknown";
      sessionCounts[status] = (sessionCounts[status] ?? 0) + 1;
      totalSessions += 1;
    }

    // Span latency data — collect durations per operation name
    const allSpans = tracer.getRecentSpans(200);
    const durationMap = new Map<string, number[]>();

    for (const span of allSpans) {
      const duration = tracer.getDuration(span);
      if (duration === undefined) continue;
      const existing = durationMap.get(span.name);
      if (existing) {
        existing.push(duration);
      } else {
        durationMap.set(span.name, [duration]);
      }
    }

    const latencyByOperation: Record<
      string,
      { p50: number; p95: number; p99: number; count: number }
    > = {};
    for (const [name, durations] of durationMap) {
      const sorted = durations.sort((a, b) => a - b);
      latencyByOperation[name] = {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        count: sorted.length,
      };
    }

    // Cost data
    const dailyTotals = costTracker.getDailyTotals();
    const costTrends = Array.from(dailyTotals.entries())
      .map(([date, cost]) => ({
        date,
        cost: Math.round(cost * 1000000) / 1000000,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Error count
    const errorCount = errorReporter.getReports().length;

    return _ctx.json({
      sessions: {
        total: totalSessions,
        byStatus: sessionCounts,
      },
      spans: {
        total: tracer.size,
        latencyByOperation,
      },
      costs: {
        daily: costTrends,
        todayTotal: Math.round(costTracker.getDailyTotal() * 1000000) / 1000000,
      },
      errors: {
        total: errorCount,
      },
    });
  });
}
