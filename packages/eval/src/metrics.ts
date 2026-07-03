// Metrics collector — accuracy, latency, cost, percentiles per model per task type
//
// Aggregates evaluation metrics and stores them in SQLite via the eval repository.
// Provides comparison and analysis functions.

import type { EvalRepository } from "./storage/eval-repository";

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

/** Per-token cost estimates for common models (USD per 1K tokens) */
const MODEL_COST_MAP: Record<
  string,
  { inputPer1K: number; outputPer1K: number }
> = {
  // GPT-4o family
  "gpt-4o": { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-4o-mini": { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  // Claude family
  "claude-sonnet-4": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-sonnet-4-20250514": { inputPer1K: 0.003, outputPer1K: 0.015 },
  "claude-haiku-3-5": { inputPer1K: 0.0008, outputPer1K: 0.004 },
  "claude-opus-4": { inputPer1K: 0.015, outputPer1K: 0.075 },
  // DeepSeek
  "deepseek-v4": { inputPer1K: 0.0005, outputPer1K: 0.002 },
  "deepseek-v4-flash": { inputPer1K: 0.0001, outputPer1K: 0.0005 },
  // Gemini
  "gemini-2.5-pro": { inputPer1K: 0.00125, outputPer1K: 0.005 },
  "gemini-2.5-flash": { inputPer1K: 0.000075, outputPer1K: 0.0003 },
};

/**
 * Collects and aggregates evaluation metrics.
 *
 * Metrics are computed from individual eval item results and persisted
 * to SQLite for comparison across runs and models.
 */
export class MetricsCollector {
  constructor(
    private readonly repo: {
      upsertMetrics: EvalRepository["upsertMetrics"];
      findMetricsByRun: EvalRepository["findMetricsByRun"];
    },
  ) {}

  /** Record metrics for a run (persists to SQLite) */
  record(runId: string, metrics: EvalMetrics): void {
    this.repo.upsertMetrics({
      runId,
      accuracy: metrics.accuracy,
      totalItems: metrics.totalItems,
      itemsPassed: metrics.itemsPassed,
      durationMs: metrics.durationMs,
      costUsd: metrics.costUsd,
      tokensInput: metrics.tokensUsed.input,
      tokensOutput: metrics.tokensUsed.output,
      latencyP50Ms: metrics.latencyMs.p50,
      latencyP95Ms: metrics.latencyMs.p95,
      latencyP99Ms: metrics.latencyMs.p99,
      errorRate: metrics.errorRate,
    });
  }

  /** Retrieve metrics for a run */
  get(runId: string): EvalMetrics | undefined {
    const row = this.repo.findMetricsByRun(runId);
    if (!row) return undefined;
    return {
      accuracy: row.accuracy ?? 0,
      totalItems: row.totalItems,
      itemsPassed: row.itemsPassed,
      durationMs: row.durationMs ?? 0,
      costUsd: row.costUsd ?? 0,
      tokensUsed: {
        input: row.tokensInput ?? 0,
        output: row.tokensOutput ?? 0,
        total: (row.tokensInput ?? 0) + (row.tokensOutput ?? 0),
      },
      latencyMs: {
        p50: row.latencyP50Ms ?? 0,
        p95: row.latencyP95Ms ?? 0,
        p99: row.latencyP99Ms ?? 0,
      },
      errorRate: row.errorRate ?? 0,
    };
  }

  /** Compute cost-per-eval for a given model */
  computeCostPerEval(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Find by exact match, then prefix match, then default to GPT-4o pricing
    const pricing = MODEL_COST_MAP[model] ??
      Object.entries(MODEL_COST_MAP).find(([key]) =>
        model.startsWith(key),
      )?.[1] ?? { inputPer1K: 0.0025, outputPer1K: 0.01 };

    const inputCost = (promptTokens / 1000) * pricing.inputPer1K;
    const outputCost = (completionTokens / 1000) * pricing.outputPer1K;
    return inputCost + outputCost;
  }

  /** Compute latency percentiles from raw latency array */
  computePercentiles(latenciesMs: number[]): LatencyPercentiles {
    if (latenciesMs.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...latenciesMs].sort((a, b) => a - b);

    const getPercentile = (p: number): number => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)] ?? 0;
    };

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  /** Compare metrics across multiple runs */
  compare(runIds: string[]): Array<{ runId: string; metrics: EvalMetrics }> {
    return runIds
      .map((id) => {
        const m = this.get(id);
        return m ? { runId: id, metrics: m } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  /** Format latency for display */
  static formatLatency(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.round(ms)}ms`;
  }

  /** Format cost for display */
  static formatCost(usd: number): string {
    if (usd < 0.0001) return "<$0.0001";
    return `$${usd.toFixed(4)}`;
  }

  /** Format accuracy for display */
  static formatAccuracy(acc: number): string {
    return `${(acc * 100).toFixed(1)}%`;
  }
}
