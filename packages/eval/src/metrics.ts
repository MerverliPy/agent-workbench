// Metrics collector — accuracy, latency, cost, percentiles per model per task type

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface EvalMetrics {
  /** Mean accuracy across all items (0-1) */
  accuracy: number;
  /** Total items evaluated */
  totalItems: number;
  /** Items that passed the evaluation criteria */
  itemsPassed: number;
  /** Total wall-clock duration in ms */
  durationMs: number;
  /** Estimated cost in USD */
  costUsd: number;
  /** Tokens used (input + output) */
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  /** Latency percentiles */
  latencyMs: LatencyPercentiles;
  /** Error rate (rate limit, timeout, etc.) */
  errorRate: number;
}

/**
 * Collects and aggregates evaluation metrics.
 *
 * Metrics are computed from individual eval item results and cached
 * for comparison across runs and models.
 */
export class MetricsCollector {
  private metrics: Map<string, EvalMetrics> = new Map();

  /** Record metrics for a run */
  record(runId: string, metrics: EvalMetrics): void {
    // TODO Phase 29: persist to SQLite via @agent-workbench/storage
    this.metrics.set(runId, metrics);
  }

  /** Retrieve metrics for a run */
  get(runId: string): EvalMetrics | undefined {
    return this.metrics.get(runId);
  }

  /** Compare metrics across two or more runs */
  compare(runIds: string[]): Array<{ runId: string; metrics: EvalMetrics }> {
    // TODO Phase 29: implement comparison logic
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  /** Compute cost-per-eval for a model */
  computeCostPerEval(model: string, promptTokens: number, completionTokens: number): number {
    // TODO Phase 29: look up model pricing from provider config
    // Use @agent-workbench/protocol ProviderProfile pricing info
    void model;
    void promptTokens;
    void completionTokens;
    return 0;
  }
}
