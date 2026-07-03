// Promptfoo integration — direct npm API for prompt-level evaluation
//
// promptfoo@0.121.17 provides:
//   - evaluate(testSuite, options) — core evaluation function
//   - Grading functions: matchesLlmRubric, matchesFactuality, matchesSimilarity
//   - Built-in provider routing for all major LLM APIs
//
// This adapter wraps the promptfoo API so our EvalRunner can use it
// without exposing promptfoo types to the rest of the codebase.

import { ulid } from "ulid";
import type { EvalRunOptions, EvalResult } from "../runner";

// NOTE: promptfoo is an optional dependency. In the Phase 29.6 integration
// flow, we use dynamic import() so it's only loaded when actually needed
// (attempting to import a missing package at module level would crash the run).

export interface PromptfooEvalOptions {
  /** Prompt template or prompts array to test */
  prompts: string[];
  /** Optional system prompt (empty string if none) */
  systemPrompt: string;
  /** Assertions/grading criteria */
  assertions?: Array<{
    type: "llm-rubric" | "factuality" | "similarity" | "contains" | "exact";
    value: string;
  }>;
  /** Number of test runs per prompt (for variance measurement) */
  repeats?: number;
}

/**
 * Convert our EvalRunOptions into a promptfoo-compatible evaluation config
 * and run it via the promptfoo npm library.
 *
 * Design:
 *   1. Dynamically import 'promptfoo' (handles missing package gracefully)
 *   2. Build EvaluateTestSuite from our options
 *   3. Run evaluate()
 *   4. Transform promptfoo's Eval result into our EvalResult format
 */
export async function runPromptfooEval(
  options: EvalRunOptions,
  evalOptions: PromptfooEvalOptions,
): Promise<EvalResult> {
  const promptfoo = await tryImportPromptfoo();
  if (!promptfoo) {
    return createFallbackResult(options, "promptfoo not installed. Run: bun add promptfoo");
  }

  const runId = ulid();
  const startTime = performance.now();

  // Build the promptfoo test suite from our options
  const testSuite: any = {
    prompts: evalOptions.prompts.map((p, i) => ({
      raw: p,
      label: evalOptions.systemPrompt
        ? `Test prompt ${i + 1}`
        : `Prompt ${i + 1}`,
    })),
    providers: [
      {
        id: `${options.provider}:${options.model}`,
        config: {
          ...options.params,
          temperature: options.params?.temperature ?? 0.7,
          max_tokens: options.params?.maxTokens ?? 4096,
        },
      },
    ],
    tests: evalOptions.assertions
      ? [
          {
            description: `Eval run ${runId}`,
            system_message: evalOptions.systemPrompt,
            assert: evalOptions.assertions.map((a) => ({
              type: a.type,
              value: a.value,
            })),
          },
        ]
      : undefined,
    ...(options.limit ? { repeat: options.limit } : {}),
  };

  try {
    const evalResult = await promptfoo.evaluate(testSuite, {
      showProgressBar: false,
      maxConcurrency: 3,
    });

    const durationMs = performance.now() - startTime;

    // Extract scores from promptfoo results
    const scores = extractPromptfooScores(evalResult, durationMs);

    return {
      id: runId,
      timestamp: new Date().toISOString(),
      options,
      scores,
      summary: {
        accuracy: scores.length > 0 ? scores.reduce((a, s) => a + s.score, 0) / scores.length : 0,
        totalItems: scores.reduce((sum, s) => sum + s.itemCount, 0),
        itemsPassed: scores.filter((s) => s.score >= 0.5).length,
        durationMs,
        costUsd: 0, // token tracking in Phase 29.3
        tokensUsed: { input: 0, output: 0 },
        latencyMs: { p50: 0, p95: 0, p99: 0 },
        errorRate: 0,
      },
      rawOutput: JSON.stringify(evalResult, null, 2),
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return createFallbackResult(options, `promptfoo evaluation failed: ${errorMessage}`);
  }
}

/** Extract and normalize scores from a promptfoo Eval result */
function extractPromptfooScores(evalResult: any, durationMs: number): EvalResult["scores"] {
  const scores: EvalResult["scores"] = [];
  if (evalResult?.results) {
    for (const result of evalResult.results) {
      const score = typeof result.score === "number" ? result.score : 0;
      scores.push({
        task: result.description ?? result.prompt?.raw ?? "unknown",
        score: typeof result.score === "number" ? Math.max(0, Math.min(1, result.score)) : 0,
        metric: result.assertion?.type ?? "pass",
        itemCount: result.test?.count ?? 1,
      });
    }
  }
  if (scores.length === 0) {
    scores.push({
      task: "aggregate",
      score: evalResult?.summary?.passRate ?? evalResult?.results?.passRate ?? 0,
      metric: "pass@1",
      itemCount: 1,
    });
  }
  return scores;
}

/**
 * Try to dynamically import promptfoo.
 * Returns null if the package is not installed, so callers can fall back gracefully.
 */
async function tryImportPromptfoo(): Promise<typeof import("promptfoo") | null> {
  try {
    return await import("promptfoo");
  } catch {
    return null;
  }
}

/** Create a fallback result when promptfoo is unavailable */
function createFallbackResult(options: EvalRunOptions, reason: string): EvalResult {
  return {
    id: ulid(),
    timestamp: new Date().toISOString(),
    options,
    scores: [],
    summary: {
      accuracy: 0,
      totalItems: 0,
      itemsPassed: 0,
      durationMs: 0,
      costUsd: 0,
      tokensUsed: { input: 0, output: 0 },
      latencyMs: { p50: 0, p95: 0, p99: 0 },
      errorRate: 1,
    },
    rawOutput: reason,
  };
}
