// Eval runner — built-in benchmarks (MMLU, HumanEval, GSM8K) + custom eval pipelines
//
// Integrates with:
//   - promptfoo (npm) for prompt-level evaluation
//   - lm-evaluation-harness (subprocess/Python) for standard benchmarks
//
// Design: lightweight orchestration layer. Actual benchmark execution is delegated
// to external tools. This package manages the lifecycle, caching, and reporting.

import type { EvalBenchmarkId } from "@agent-workbench/protocol";
import { ulid } from "ulid";
import {
  runCustomEvalScript,
  runLmEvalHarnessBenchmark,
  runPromptfooEval,
} from "./integrations";
import { MetricsCollector } from "./metrics";
import {
  EvalRepository,
  type EvalRepository as EvalRepositoryType,
} from "./storage/eval-repository";

export interface EvalRunOptions {
  /** Benchmark to run */
  benchmark: EvalBenchmarkId;
  /** Model identifier (e.g. "claude-sonnet-4") */
  model: string;
  /** Provider identifier (matches @agent-workbench/protocol ProviderProfile) */
  provider: string;
  /** Optional subset of benchmark items to run (for quick smoke tests) */
  limit?: number;
  /** Model-specific parameters (temperature, max_tokens, etc.) */
  params?: Record<string, unknown>;
  /** User-provided eval script path (for "custom" benchmark type) */
  customScript?: string;
}

export interface EvalResult {
  /** Unique run ID */
  id: string;
  /** Timestamp of the run */
  timestamp: string;
  /** The benchmark configuration used */
  options: EvalRunOptions;
  /** Individual task scores */
  scores: Array<{
    task: string;
    score: number;
    metric: string;
    itemCount: number;
  }>;
  /** Aggregate summary */
  summary: {
    accuracy: number;
    totalItems: number;
    itemsPassed: number;
    durationMs: number;
    costUsd: number;
    tokensUsed: { input: number; output: number; total: number };
    latencyMs: { p50: number; p95: number; p99: number };
    errorRate: number;
  };
  /** Raw output for external analysis (empty string if none) */
  rawOutput: string;
}

interface BenchmarkConfig {
  id: EvalBenchmarkId;
  name: string;
  description: string;
  itemCount: number;
  categories: string[];
  requiresPython: boolean;
}

/** Available benchmarks with metadata */
const BENCHMARKS: BenchmarkConfig[] = [
  {
    id: "mmlu",
    name: "MMLU (Massive Multitask Language Understanding)",
    description: "57 subjects across STEM, humanities, and social sciences",
    itemCount: 14042,
    categories: ["stem", "humanities", "social_sciences", "other"],
    requiresPython: true,
  },
  {
    id: "humaneval",
    name: "HumanEval (Code Generation)",
    description: "164 hand-written programming problems with functional tests",
    itemCount: 164,
    categories: ["code_generation"],
    requiresPython: true,
  },
  {
    id: "gsm8k",
    name: "GSM8K (Grade School Math)",
    description: "8.5K grade-school math word problems",
    itemCount: 8792,
    categories: ["math"],
    requiresPython: true,
  },
  {
    id: "hellaswag",
    name: "HellaSwag (Commonsense Reasoning)",
    description: "Commonsense natural language inference",
    itemCount: 10042,
    categories: ["reasoning"],
    requiresPython: true,
  },
  {
    id: "arc",
    name: "ARC (AI2 Reasoning Challenge)",
    description: "Grade-school science questions",
    itemCount: 7787,
    categories: ["science", "reasoning"],
    requiresPython: true,
  },
  {
    id: "custom",
    name: "Custom Eval Script",
    description: "User-provided evaluation script with JSON I/O",
    itemCount: 0,
    categories: ["custom"],
    requiresPython: false,
  },
  {
    id: "promptfoo",
    name: "Promptfoo Evaluation",
    description: "Prompt-level evaluation via promptfoo npm package",
    itemCount: 0,
    categories: ["prompt_evaluation"],
    requiresPython: false,
  },
];

/**
 * Evaluates a model against a benchmark.
 *
 * Delegates to:
 *   - promptfoo for prompt-level evaluation (npm package)
 *   - lm-evaluation-harness via subprocess for standard benchmarks
 *   - Custom eval scripts for user-defined benchmarks
 */
export class EvalRunner {
  private repo: EvalRepositoryType;

  constructor(db: ConstructorParameters<typeof EvalRepositoryType>[0]) {
    this.repo = new EvalRepository(db);
  }

  /**
   * Run a benchmark evaluation against a model.
   *
   * The execution strategy depends on benchmark type:
   *   - mmlu/humaneval/gsm8k/hellaswag/arc → subprocess `python -m lm_eval`
   *   - promptfoo → direct npm API
   *   - custom → user-provided script subprocess
   */
  async run(options: EvalRunOptions): Promise<EvalResult> {
    const runId = ulid();
    const now = new Date().toISOString();

    // Create run record
    this.repo.createRun({
      id: runId,
      benchmarkId: options.benchmark,
      model: options.model,
      provider: options.provider,
      status: "running",
      createdAt: now,
      configJson: JSON.stringify(options),
    });

    const startTime = performance.now();

    try {
      // Dispatch to appropriate integration
      const { scores, rawOutput } = await this.executeBenchmark(options);

      const durationMs = performance.now() - startTime;

      // Compute summary metrics
      const totalItems = scores.reduce((sum, s) => sum + s.itemCount, 0);
      const itemsPassed = scores.reduce(
        (sum, s) => sum + Math.round(s.score * s.itemCount),
        0,
      );

      const accuracy = totalItems > 0 ? itemsPassed / totalItems : 0;

      // Use MetricsCollector for cost estimation
      const metrics = new MetricsCollector(this.repo);
      const totalInput = scores.reduce(
        (s, score) => s + score.itemCount * 250,
        0,
      ); // estimate ~250 input tokens per item
      const totalOutput = scores.reduce(
        (s, score) => s + score.itemCount * 500,
        0,
      ); // estimate ~500 output tokens per item
      const costUsd = metrics.computeCostPerEval(
        options.model,
        totalInput,
        totalOutput,
      );

      const result: EvalResult = {
        id: runId,
        timestamp: now,
        options,
        scores,
        summary: {
          accuracy,
          totalItems,
          itemsPassed,
          durationMs,
          costUsd,
          tokensUsed: {
            input: totalInput,
            output: totalOutput,
            total: totalInput + totalOutput,
          },
          latencyMs: { p50: durationMs, p95: durationMs, p99: durationMs },
          errorRate: 0,
        },
        rawOutput,
      };

      // Persist scores
      this.repo.createScores(
        scores.map((s) => ({
          id: ulid(),
          runId,
          task: s.task,
          score: s.score,
          metric: s.metric,
          itemCount: s.itemCount,
        })),
      );

      // Persist aggregated metrics
      this.repo.upsertMetrics({
        runId,
        accuracy,
        totalItems,
        itemsPassed,
        durationMs,
        costUsd,
        tokensInput: 0,
        tokensOutput: 0,
        latencyP50Ms: 0,
        latencyP95Ms: 0,
        latencyP99Ms: 0,
        errorRate: 0,
      });

      // Mark run as completed
      this.repo.updateRunStatus(runId, "completed", new Date().toISOString());

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.repo.updateRunStatus(
        runId,
        "failed",
        new Date().toISOString(),
        errorMessage,
      );
      throw err;
    }
  }

  /** Execute a benchmark by dispatching to the appropriate integration */
  private async executeBenchmark(
    options: EvalRunOptions,
  ): Promise<{ scores: EvalResult["scores"]; rawOutput: string }> {
    switch (options.benchmark) {
      case "mmlu":
      case "humaneval":
      case "gsm8k":
      case "hellaswag":
      case "arc":
        return this.runLmEvalHarness(options);
      case "promptfoo":
        return this.runPromptfoo(options);
      case "custom":
        return this.runCustomScript(options);
      default:
        throw new Error(`Unknown benchmark: ${options.benchmark}`);
    }
  }

  /**
   * Run benchmark via lm-evaluation-harness subprocess.
   * Requires `pip install lm-eval[all]` to be installed.
   *
   * CLI command shape:
   *   python -m lm_eval --model openai-completions --model_args model=<name> --tasks <benchmark> --output_path <tmp> --log_samples
   *
   * Implementation note: The lm-eval harness runs the model through its own
   * API calls, so we pass the model name. For self-hosted providers, we
   * configure a custom OpenAI-compatible endpoint via model_args.
   */
  private async runLmEvalHarness(
    options: EvalRunOptions,
  ): Promise<{ scores: EvalResult["scores"]; rawOutput: string }> {
    const result = await runLmEvalHarnessBenchmark(options, {});
    return { scores: result.scores, rawOutput: result.rawOutput };
  }

  /**
   * Run prompt-level evaluation via promptfoo npm package.
   */
  private async runPromptfoo(
    options: EvalRunOptions,
  ): Promise<{ scores: EvalResult["scores"]; rawOutput: string }> {
    const result = await runPromptfooEval(options, {
      prompts: (options.params?.prompts as string[]) ?? ["Test prompt"],
      systemPrompt: (options.params?.systemPrompt as string) ?? "",
      ...(options.params?.assertions
        ? {
            // biome-ignore lint/suspicious/noExplicitAny: assertions from user config
            assertions: options.params.assertions as any[],
          }
        : {}),
      ...(options.limit ? { repeats: options.limit } : {}),
    });
    return { scores: result.scores, rawOutput: result.rawOutput };
  }

  /**
   * Run a custom user-provided eval script.
   */
  private async runCustomScript(
    options: EvalRunOptions,
  ): Promise<{ scores: EvalResult["scores"]; rawOutput: string }> {
    const result = await runCustomEvalScript(options, this.repo);
    return { scores: result.scores, rawOutput: result.rawOutput };
  }

  /** List all available benchmarks */
  listBenchmarks(): BenchmarkConfig[] {
    return BENCHMARKS;
  }

  /** Get the repository for advanced queries */
  getRepository(): EvalRepositoryType {
    return this.repo;
  }
}
