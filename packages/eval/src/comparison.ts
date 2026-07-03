// Side-by-side model comparison — compare outputs across 2+ models for the same prompt
//
// Uses ModelPlayground to dispatch identical prompts to multiple models
// in parallel and collect results for side-by-side comparison.

import { ModelPlayground, type PlaygroundConfig } from "./playground";

export interface ComparisonPair {
  /** Model identifier */
  model: string;
  /** Provider identifier */
  provider: string;
  /** The generated output */
  output: string;
  /** Latency for this model */
  latencyMs: number;
  /** Cost for this model */
  costUsd: number;
  /** Token usage */
  tokensUsed: { input: number; output: number; total: number };
}

export interface ComparisonResult {
  /** The prompt that was sent to all models */
  prompt: string;
  /** Results from each model */
  results: ComparisonPair[];
  /** Optional human preference ranking (1 = best) */
  ranking?: string[];
  /** Timestamp */
  timestamp: string;
}

export interface CompareOptions {
  /** System prompt sent to all models */
  systemPrompt?: string;
  /** Temperature (default: 0.7) */
  temperature?: number;
  /** Max tokens (default: 4096) */
  maxTokens?: number;
  /** Abort controller for cancellation */
  signal?: AbortSignal;
}

/**
 * Runs the same prompt across multiple models and collects results
 * for side-by-side comparison.
 *
 * Used by the TUI comparison diff viewer to help users evaluate
 * which model performs best for a given type of task.
 */
export class ModelComparer {
  private playground: ModelPlayground;

  constructor(playground?: ModelPlayground) {
    this.playground = playground ?? new ModelPlayground();
  }

  /**
   * Send a prompt to multiple models and collect their responses.
   * All models receive the identical system prompt and user message.
   * Models are dispatched in parallel for fair latency comparison.
   */
  async compare(
    prompt: string,
    systemPrompt: string | undefined,
    models: Array<{ model: string; provider: string }>,
    options?: CompareOptions,
  ): Promise<ComparisonResult> {
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens ?? 4096;
    const signal = options?.signal;

    // Dispatch to all models in parallel
    const results = await Promise.allSettled(
      models.map(async ({ model, provider }) => {
        const config: PlaygroundConfig = {
          model,
          provider,
          ...(systemPrompt !== undefined ? { systemPrompt } : {}),
          temperature,
          maxTokens,
          stream: false,
        };

        const startTime = performance.now();
        const playgroundResult = await this.playground.send(config, prompt);
        const latencyMs = Math.round(performance.now() - startTime);

        return {
          model,
          provider,
          output: playgroundResult.output,
          latencyMs,
          costUsd: playgroundResult.costUsd,
          tokensUsed: {
            input: playgroundResult.tokensUsed.input,
            output: playgroundResult.tokensUsed.output,
            total:
              playgroundResult.tokensUsed.input +
              playgroundResult.tokensUsed.output,
          },
        } satisfies ComparisonPair;
      }),
    );

    // Check for cancellation
    if (signal?.aborted) {
      throw new DOMException("Comparison cancelled", "AbortError");
    }

    // Collect results, logging any failures
    const collected: ComparisonPair[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        collected.push(result.value);
      } else {
        console.error(
          `[ModelComparer] Model failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
      }
    }

    return {
      prompt,
      results: collected,
      timestamp: new Date().toISOString(),
    };
  }

  /** Get a simple diff between two model outputs */
  diffOutput(outputA: string, outputB: string): string {
    const linesA = outputA.split("\n");
    const linesB = outputB.split("\n");
    const result: string[] = [];
    const maxLen = Math.max(linesA.length, linesB.length);

    for (let i = 0; i < maxLen; i++) {
      if (i >= linesA.length) {
        result.push(`+ ${linesB[i]}`);
      } else if (i >= linesB.length) {
        result.push(`- ${linesA[i]}`);
      } else if (linesA[i] !== linesB[i]) {
        result.push(`- ${linesA[i]}`);
        result.push(`+ ${linesB[i]}`);
      } else {
        result.push(`  ${linesA[i]}`);
      }
    }

    return result.join("\n");
  }
}
