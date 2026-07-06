// Custom eval script integration — user-provided eval scripts
//
// Protocol: The custom script receives JSON on stdin and outputs JSON on stdout.
//
// Input format (stdin):
// {
//   "benchmark": "custom",
//   "model": "string",
//   "provider": "string",
//   "params": { ... },
//   "limit": number | undefined
// }
//
// Output format (stdout):
// {
//   "scores": [
//     { "task": "string", "score": number, "metric": "string", "itemCount": number }
//   ],
//   "accuracy": number,
//   "totalItems": number,
//   "itemsPassed": number
// }

import { existsSync } from "node:fs";
import { ulid } from "ulid";
import { MetricsCollector } from "../metrics";
import type { EvalResult, EvalRunOptions } from "../runner";

/**
 * Run a user-provided custom eval script.
 *
 * The script can be any executable (shell script, Python, Node.js, etc.).
 * Communication is via JSON stdin/stdout.
 *
 * @param options - Standard eval run options (benchmark=custom, customScript)
 * @param repo - Eval repository for persisting results
 */
export async function runCustomEvalScript(
  options: EvalRunOptions,
  repo: {
    // biome-ignore lint/complexity/noBannedTypes: integration glue, external API shapes
    createRun: Function;
    // biome-ignore lint/complexity/noBannedTypes: integration glue, external API shapes
    createScores: Function;
    // biome-ignore lint/complexity/noBannedTypes: integration glue, external API shapes
    upsertMetrics: Function;
    // biome-ignore lint/complexity/noBannedTypes: integration glue, external API shapes
    updateRunStatus: Function;
  },
): Promise<EvalResult> {
  const runId = ulid();
  const now = new Date().toISOString();

  if (!options.customScript) {
    return createFallback(
      runId,
      options,
      "No custom script provided. Set options.customScript.",
    );
  }

  if (!existsSync(options.customScript)) {
    return createFallback(
      runId,
      options,
      `Custom script not found: ${options.customScript}`,
    );
  }

  // Create a "running" record
  repo.createRun({
    id: runId,
    benchmarkId: "custom",
    model: options.model,
    provider: options.provider,
    status: "running",
    createdAt: now,
    configJson: JSON.stringify(options),
  });

  const startTime = performance.now();

  try {
    // Build the input payload
    const input = {
      benchmark: options.benchmark,
      model: options.model,
      provider: options.provider,
      params: options.params,
      limit: options.limit,
    };

    // Determine interpreter
    const scriptArgs = options.customScript.endsWith(".py")
      ? ["python3", options.customScript]
      : options.customScript.endsWith(".ts") ||
          options.customScript.endsWith(".js")
        ? ["bun", options.customScript]
        : [options.customScript]; // executable with shebang

    // Spawn and communicate via JSON
    const proc = Bun.spawn(scriptArgs, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, AGENT_WORKBENCH_EVAL: "1" },
    });

    // Write input JSON to stdin and close
    proc.stdin.write(`${JSON.stringify(input)}\n`);
    proc.stdin.end();

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const durationMs = performance.now() - startTime;

    if (exitCode !== 0) {
      throw new Error(`Script exited with code ${exitCode}\nstderr: ${stderr}`);
    }

    // Parse output
    // biome-ignore lint/suspicious/noExplicitAny: output shape from external script
    let output: any;
    try {
      output = JSON.parse(stdout.trim());
    } catch {
      throw new Error(
        `Script output was not valid JSON:\n${stdout.slice(0, 200)}`,
      );
    }

    const scores: EvalResult["scores"] = (output.scores ?? []).map(
      // biome-ignore lint/suspicious/noExplicitAny: scores from external script
      (s: any) => ({
        task: s.task ?? "unknown",
        score: typeof s.score === "number" ? s.score : 0,
        metric: s.metric ?? "custom",
        itemCount: s.itemCount ?? 1,
      }),
    );

    const totalItems = scores.reduce(
      (sum: number, s: EvalResult["scores"][number]) => sum + s.itemCount,
      0,
    );
    const itemsPassed = scores.reduce(
      (sum: number, s: EvalResult["scores"][number]) =>
        sum + Math.round(s.score * s.itemCount),
      0,
    );
    const accuracy = totalItems > 0 ? itemsPassed / totalItems : 0;

    const metrics = new MetricsCollector(
      // biome-ignore lint/suspicious/noExplicitAny: partial repo subset for MetricsCollector
      repo as any,
    );

    const result: EvalResult = {
      id: runId,
      timestamp: new Date().toISOString(),
      options,
      scores,
      summary: {
        accuracy,
        totalItems,
        itemsPassed,
        durationMs,
        costUsd: metrics.computeCostPerEval(
          options.model,
          options.limit ?? totalItems,
          0,
        ),
        tokensUsed: { input: 0, output: 0, total: 0 },
        latencyMs: { p50: 0, p95: 0, p99: 0 },
        errorRate: 0,
      },
      rawOutput: stderr || "",
    };

    // Persist results
    repo.createScores(
      scores.map((s: EvalResult["scores"][number]) => ({
        id: ulid(),
        runId,
        task: s.task,
        score: s.score,
        metric: s.metric,
        itemCount: s.itemCount,
      })),
    );

    repo.updateRunStatus(runId, "completed", new Date().toISOString());

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    repo.updateRunStatus(
      runId,
      "failed",
      new Date().toISOString(),
      errorMessage,
    );
    return createFallback(runId, options, errorMessage);
  }
}

function createFallback(
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
