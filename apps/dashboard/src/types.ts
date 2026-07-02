/** Dashboard API response shape from GET /observability/dashboard */
export interface DashboardData {
  sessions: {
    total: number;
    byStatus: Record<string, number>;
  };
  spans: {
    total: number;
    latencyByOperation: Record<string, LatencyStats>;
  };
  costs: {
    daily: { date: string; cost: number }[];
    todayTotal: number;
  };
  errors: {
    total: number;
  };
}

export interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  count: number;
}
