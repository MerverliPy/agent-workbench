// Eval runner — built-in benchmarks (MMLU, HumanEval, GSM8K) + custom eval pipelines
//
// Integrates with:
//   - promptfoo (npm: promptfoo) for prompt-level evaluation
//   - lm-evaluation-harness (subprocess/Python) for standard benchmarks
//
// Design: lightweight orchestration layer. Actual benchmark runs are delegated
// to external tools. This package manages the lifecycle, caching, and reporting.

import type { EvalBenchmark, EvalBenchmarkId, EvalScore } from "@agent-workbench/protocol";

export interface EvalRunOptions {
  /** Benchmark to run */
  benchmark: EvalBenchmarkId;
  /** Model configuration string (e.g. "anthropic/claude-sonnet-4") */
  model: string;
  /** Provider ID (matches @agent-workbench/protocol ProviderProfile) */
  provider: string;
  /** Optional subset of benchmark items to run (for quick smoke tests) */
  limit?: number;
  /** Additional custom parameters */
  params?: Record<string, unknown>;
}

export interface EvalResult {
  /** Unique run ID */
  id: string;
  /** Timestamp of the run */
  timestamp: string;
  /** The benchmark configuration used */
  options: EvalRunOptions;
  /** Overall scores */
  scores: EvalScore[];
  /** Aggregate metrics */
  summary: {
    accuracy: number;
    totalItems: number;
    itemsPassed: number;
    durationMs: number;
    costUsd: number;
  };
  /** Raw output for external analysis */
  rawOutput?: string;
}

/**
 * Evaluates a model against a benchmark.
 *
 * Delegates to:
 *   - promptfoo for prompt-level evaluation (npm package)
 *   - lm-evaluation-harness via subprocess for standard benchmarks
 *   - Custom eval scripts for user-defined benchmarks
 *
 * Integration approach per benchmark type (TBD in Phase 29):
 *   - "mmlu" / "humaneval" / "gsm8k": pip install lm-evaluation-harness, subprocess call
 *   - "custom": user-provided eval script, subprocess call with JSON I/O
 *   - "promptfoo": direct import of promptfoo Node.js API
 */
export class EvalRunner {
  async run(options: EvalRunOptions): Promise<EvalResult> {
    // TODO Phase 29: implement runner
    // - Detect benchmark type
    // - Dispatch to appropriate integration (promptfoo npm, lm-eval subprocess, custom)
    // - Collect results
    // - Compute metrics
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  async listBenchmarks(): Promise<EvalBenchmark[]> {
    // TODO Phase 29: list available benchmarks
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }
}
