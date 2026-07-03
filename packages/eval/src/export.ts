// Eval results export — CSV and JSON output for external analysis
//
// Exports evaluation results from the SQLite storage to portable formats
// that can be loaded into spreadsheets, notebooks, or CI reporting tools.

import type { EvalRepository } from "./storage/eval-repository";

export type ExportFormat = "csv" | "json";

export interface ExportOptions {
  /** Output format */
  format: ExportFormat;
  /** Maximum number of runs to export (0 = all) */
  maxRuns?: number;
  /** Filter to specific model(s) */
  models?: string[];
  /** Filter to specific benchmark(s) */
  benchmarks?: string[];
  /** Include raw output in JSON export */
  includeRawOutput?: boolean;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: "json",
  maxRuns: 100,
  includeRawOutput: false,
};

/**
 * Export evaluation results from the repository to CSV or JSON strings.
 *
 * CSV format:
 *   run_id,benchmark,model,provider,status,created_at,accuracy,total_items,
 *   items_passed,duration_ms,cost_usd,tokens_input,tokens_output,latency_p50,
 *   latency_p95,latency_p99,error_rate
 *
 * JSON format:
 *   { runs: [...], exportedAt: "ISO date" }
 */
export class ResultsExporter {
  constructor(private readonly repo: EvalRepository) {}

  /**
   * Export evaluation results as a string in the requested format.
   */
  exportToString(options?: Partial<ExportOptions>): string {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const runs = this.queryRuns(opts);

    if (opts.format === "csv") {
      return this.toCsv(runs);
    }
    return this.toJson(runs, opts);
  }

  /**
   * Export directly to a file path using Bun's file I/O.
   * Returns the absolute path to the written file.
   */
  exportToFile(filePath: string, options?: Partial<ExportOptions>): string {
    const content = this.exportToString(options);
    Bun.write(filePath, content);
    return filePath;
  }

  /** Query runs from the repository with optional filters */
  private queryRuns(opts: ExportOptions): Array<
    ReturnType<EvalRepository["listRuns"]>[number] & {
      metrics?: ReturnType<EvalRepository["findMetricsByRun"]>;
    }
  > {
    let runs = this.repo.listRuns(opts.maxRuns ?? 100, 0);

    // Apply model filter
    if (opts.models && opts.models.length > 0) {
      runs = runs.filter((r) => opts.models?.includes(r.model));
    }

    // Apply benchmark filter
    if (opts.benchmarks && opts.benchmarks.length > 0) {
      runs = runs.filter((r) => opts.benchmarks?.includes(r.benchmarkId));
    }

    // Attach metrics for each run
    return runs.map((run) => ({
      ...run,
      metrics: this.repo.findMetricsByRun(run.id) ?? undefined,
    }));
  }

  /** Format as CSV */
  private toCsv(
    runs: Array<
      ReturnType<EvalRepository["listRuns"]>[number] & {
        metrics?: ReturnType<EvalRepository["findMetricsByRun"]>;
      }
    >,
  ): string {
    const header = [
      "run_id",
      "benchmark",
      "model",
      "provider",
      "status",
      "created_at",
      "completed_at",
      "accuracy",
      "total_items",
      "items_passed",
      "duration_ms",
      "cost_usd",
      "tokens_input",
      "tokens_output",
      "latency_p50_ms",
      "latency_p95_ms",
      "latency_p99_ms",
      "error_rate",
    ].join(",");

    const rows = runs.map((run) => {
      const m = run.metrics;
      return [
        csvEscape(run.id),
        csvEscape(run.benchmarkId),
        csvEscape(run.model),
        csvEscape(run.provider),
        csvEscape(run.status),
        csvEscape(run.createdAt),
        csvEscape(run.completedAt ?? ""),
        m ? String(m.accuracy ?? "") : "",
        m ? String(m.totalItems) : "",
        m ? String(m.itemsPassed) : "",
        m ? String(m.durationMs ?? "") : "",
        m ? String(m.costUsd ?? "") : "",
        m ? String(m.tokensInput ?? "") : "",
        m ? String(m.tokensOutput ?? "") : "",
        m ? String(m.latencyP50Ms ?? "") : "",
        m ? String(m.latencyP95Ms ?? "") : "",
        m ? String(m.latencyP99Ms ?? "") : "",
        m ? String(m.errorRate ?? "") : "",
      ].join(",");
    });

    return `${[header, ...rows].join("\n")}\n`;
  }

  /** Format as JSON */
  private toJson(
    runs: Array<
      ReturnType<EvalRepository["listRuns"]>[number] & {
        metrics?: ReturnType<EvalRepository["findMetricsByRun"]>;
      }
    >,
    opts: ExportOptions,
  ): string {
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      runCount: runs.length,
      runs: runs.map((run) => {
        const m = run.metrics;
        const out: Record<string, unknown> = {
          id: run.id,
          benchmark: run.benchmarkId,
          model: run.model,
          provider: run.provider,
          status: run.status,
          createdAt: run.createdAt,
          completedAt: run.completedAt,
          config: tryParseJson(run.configJson),
        };

        if (opts.includeRawOutput && run.rawOutput) {
          out.rawOutput = run.rawOutput;
        }

        if (m) {
          out.metrics = {
            accuracy: m.accuracy,
            totalItems: m.totalItems,
            itemsPassed: m.itemsPassed,
            durationMs: m.durationMs,
            costUsd: m.costUsd,
            tokensInput: m.tokensInput,
            tokensOutput: m.tokensOutput,
            latencyP50Ms: m.latencyP50Ms,
            latencyP95Ms: m.latencyP95Ms,
            latencyP99Ms: m.latencyP99Ms,
            errorRate: m.errorRate,
          };
        }

        return out;
      }),
    };

    return JSON.stringify(payload, null, 2);
  }
}

/** CSV-escape a string value */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Safely parse JSON, returning undefined on failure */
function tryParseJson(str: string | null): unknown {
  if (!str) return undefined;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
