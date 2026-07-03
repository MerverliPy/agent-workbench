// lm-evaluation-harness integration — subprocess-based standard benchmarks
//
// lm-eval==0.4.12 provides industry-standard ML benchmarks:
//   - MMLU, HumanEval, GSM8K, HellaSwag, ARC, etc.
//   - Task-based evaluation with predefined metrics
//
// Design: The lm-eval harness is Python-only, so we invoke it via subprocess.
// Users must install it separately (pip install lm-eval or use managed venv).
// The adapter auto-detects the Python environment and provides clear errors
// when lm-eval is not available.
//
// CLI command shape:
//   python -m lm_eval \
//     --model openai-completions \
//     --model_args model=<name>,base_url=<endpoint> \
//     --tasks mmlu \
//     --output_path /tmp/lm-eval-results \
//     --log_samples \
//     --write_out \
//     --num_fewshot 5

import { ulid } from "ulid";
import type { EvalResult, EvalRunOptions } from "../runner";

export interface LmEvalAdapterOptions {
  /** Python executable path. Default: auto-detect from ~/.agent-workbench/.venv or system */
  pythonPath?: string;
  /** Custom API base URL (for self-hosted providers) */
  apiBaseUrl?: string;
  /** API key for the endpoint */
  apiKey?: string;
}

/** Map our benchmark IDs to lm-eval task names */
const BENCHMARK_TASK_MAP: Record<string, string> = {
  mmlu: "mmlu",
  humaneval: "humaneval",
  gsm8k: "gsm8k",
  hellaswag: "hellaswag",
  arc: "arc_challenge",
};

/** Map our benchmark IDs to recommended few-shot values */
const BENCHMARK_FEWSHOT: Record<string, number> = {
  mmlu: 5,
  humaneval: 0,
  gsm8k: 5,
  hellaswag: 5,
  arc: 25,
};

/**
 * Run a standard ML benchmark via lm-evaluation-harness subprocess.
 *
 * Strategy:
 *   1. Auto-detect Python environment (managed venv > system pip > clear error)
 *   2. Verify lm-eval is installed with `python -c "import lm_eval; print(lm_eval.__version__)"`
 *   3. Build the subprocess command with provider routing via --model_args
 *   4. Execute with Bun.spawn (non-blocking, streaming stdout)
 *   5. Parse the JSON results file from the output path
 *   6. Map task scores to our EvalResult format
 *
 * Provider routing:
 *   - For OpenAI-compatible providers: --model openai-completions, --model_args model=...,base_url=...
 *   - For direct API: --model openai-completions, --model_args model=<name>
 *   - For other providers: user provides custom script path via options.customScript
 */
export async function runLmEvalHarnessBenchmark(
  options: EvalRunOptions,
  adapterOptions: LmEvalAdapterOptions = {},
): Promise<EvalResult> {
  const runId = ulid();
  const startTime = performance.now();

  // 1. Detect Python environment
  const pythonPath = await detectPython();
  if (!pythonPath) {
    return createFallbackResult(
      runId,
      options,
      "Python/lm-eval not available. Install: pip install lm-eval or use a custom eval script.",
    );
  }

  // 2. Verify lm-eval is installed
  const lmEvalVersion = await checkLmEvalInstalled(pythonPath);
  if (!lmEvalVersion) {
    return createFallbackResult(
      runId,
      options,
      "lm-evaluation-harness not installed. Run: pip install lm-eval",
    );
  }

  const taskName = BENCHMARK_TASK_MAP[options.benchmark] ?? options.benchmark;
  const fewshot =
    (options.params?.fewshot as number) ??
    BENCHMARK_FEWSHOT[options.benchmark] ??
    0;

  try {
    // 3. Build model args for provider routing
    const modelArgs = buildModelArgs(options, adapterOptions);

    // 4. Execute command
    const tmpDir = `/tmp/lm-eval-${runId}`;
    const cmd = [
      pythonPath,
      "-m",
      "lm_eval",
      "--model",
      getLmEvalModel(options.provider),
      "--model_args",
      modelArgs,
      "--tasks",
      taskName,
      "--num_fewshot",
      String(fewshot),
      "--output_path",
      tmpDir,
      "--log_samples",
      "--write_out",
    ];

    // Use Bun.spawn for non-blocking execution
    const proc = Bun.spawn(cmd, {
      env: {
        ...process.env,
        ...(adapterOptions.apiKey
          ? { OPENAI_API_KEY: adapterOptions.apiKey }
          : {}),
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(
        `lm-eval exited with code ${exitCode}\nstderr: ${stderr}`,
      );
    }

    const durationMs = performance.now() - startTime;

    // 5. Parse results from output path
    const results = await parseLmEvalResults(tmpDir, taskName);

    return {
      id: runId,
      timestamp: new Date().toISOString(),
      options,
      scores: results.scores,
      summary: {
        accuracy: results.accuracy,
        totalItems: results.totalItems,
        itemsPassed: results.itemsPassed,
        durationMs,
        costUsd: 0,
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: { p50: 0, p95: 0, p99: 0 },
        errorRate: 0,
      },
      rawOutput: stdout.slice(0, 5000),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return createFallbackResult(
      runId,
      options,
      `Evaluation failed: ${errorMessage}`,
    );
  }
}

/**
 * Auto-detect the Python environment.
 * Checks in order:
 *   1. ~/.agent-workbench/.venv/bin/python (managed venv)
 *   2. python3 (system)
 *   3. python (system fallback)
 */
async function detectPython(): Promise<string | null> {
  const paths = [
    `${process.env.HOME}/.agent-workbench/.venv/bin/python3`,
    `${process.env.HOME}/.agent-workbench/.venv/bin/python`,
    "python3",
    "python",
  ];

  for (const pyPath of paths) {
    try {
      const result = await new Promise<number>((resolve) => {
        const proc = Bun.spawn([pyPath, "--version"], {
          stderr: "pipe",
          stdout: "pipe",
        });
        proc.exited.then(resolve);
      });
      if (result === 0) return pyPath;
    } catch {}
  }
  return null;
}

/** Check if lm_eval is installed and return its version string */
async function checkLmEvalInstalled(
  pythonPath: string,
): Promise<string | null> {
  try {
    const proc = Bun.spawn(
      [pythonPath, "-c", "import lm_eval; print(lm_eval.__version__)"],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return exitCode === 0 ? output.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Build the --model_args string for provider routing.
 *
 * For OpenAI-compatible providers (openai, openrouter, custom):
 *   model=<model_name>,base_url=<compatible_endpoint>,tokenizer=<model>
 *
 * For direct API (openai): model=<model_name>
 */
function buildModelArgs(
  options: EvalRunOptions,
  adapterOptions: LmEvalAdapterOptions,
): string {
  const args: string[] = [`model=${options.model}`];

  if (adapterOptions.apiBaseUrl) {
    args.push(`base_url=${adapterOptions.apiBaseUrl}`);
  }

  if (options.params?.temperature !== undefined) {
    args.push(`temperature=${options.params.temperature}`);
  }

  return args.join(",");
}

/**
 * Determine the lm-eval --model argument based on provider type.
 * openai-completions handles OpenAI-compatible API endpoints.
 */
function getLmEvalModel(provider: string): string {
  const openaiCompatible = [
    "openai",
    "openrouter",
    "anthropic",
    "custom",
    "deepseek",
  ];
  if (openaiCompatible.includes(provider)) {
    return "openai-completions";
  }
  // For other providers, default to openai-completions with base_url override
  return "openai-completions";
}

/** Parse lm-eval JSON results from the output directory */
async function parseLmEvalResults(
  tmpDir: string,
  taskName: string,
): Promise<{
  scores: EvalResult["scores"];
  accuracy: number;
  totalItems: number;
  itemsPassed: number;
}> {
  // lm-eval outputs a results.json file with per-task scores
  const resultsPath = `${tmpDir}/results.json`;
  try {
    const file = Bun.file(resultsPath);
    const content = await file.text();
    const data = JSON.parse(content);

    const results = data.results ?? {};
    const scores: EvalResult["scores"] = [];

    let totalItems = 0;
    let totalPassed = 0;

    for (const [task, metrics] of Object.entries(results)) {
      const m = metrics as Record<string, number>;
      const accuracy = m.acc ?? m.exact_match ?? 0;
      const count = m.samples ?? m.num_fewshot_samples ?? 1;

      scores.push({
        task,
        score: accuracy,
        metric: m.acc !== undefined ? "accuracy" : "exact_match",
        itemCount: Math.round(count),
      });

      totalItems += count;
      totalPassed += Math.round(accuracy * count);
    }

    // Clean up temp dir
    try {
      Bun.spawnSync(["rm", "-rf", tmpDir]);
    } catch {
      /* ignore */
    }

    return {
      scores:
        scores.length > 0
          ? scores
          : [{ task: taskName, score: 0, metric: "accuracy", itemCount: 0 }],
      accuracy: totalItems > 0 ? totalPassed / totalItems : 0,
      totalItems,
      itemsPassed: totalPassed,
    };
  } catch {
    return {
      scores: [{ task: taskName, score: 0, metric: "accuracy", itemCount: 0 }],
      accuracy: 0,
      totalItems: 0,
      itemsPassed: 0,
    };
  }
}

/** Create a fallback result when lm-eval is unavailable */
function createFallbackResult(
  runId: string,
  options: EvalRunOptions,
  reason: string,
): EvalResult {
  return {
    id: runId,
    timestamp: new Date().toISOString(),
    options,
    scores: [],
    summary: {
      accuracy: 0,
      totalItems: 0,
      itemsPassed: 0,
      durationMs: 0,
      costUsd: 0,
      tokensUsed: { input: 0, output: 0, total: 0 },
      latencyMs: { p50: 0, p95: 0, p99: 0 },
      errorRate: 1,
    },
    rawOutput: reason,
  };
}
