import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const LatencyStats = z.object({
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
  count: z.number(),
});
export type LatencyStats = z.infer<typeof LatencyStats>;

export const DashboardResponse = z.object({
  sessions: z.object({
    total: z.number(),
    byStatus: z.record(z.string(), z.number()),
  }),
  spans: z.object({
    total: z.number(),
    latencyByOperation: z.record(z.string(), LatencyStats),
  }),
  costs: z.object({
    daily: z.array(z.object({ date: z.string(), cost: z.number() })),
    todayTotal: z.number(),
  }),
  errors: z.object({
    total: z.number(),
  }),
});
export type DashboardResponse = z.infer<typeof DashboardResponse>;

export const DashboardRoute = {
  method: "GET" as const,
  path: "/observability/dashboard",
  response: DashboardResponse,
  errors: [ErrorEnvelope],
} as const;
