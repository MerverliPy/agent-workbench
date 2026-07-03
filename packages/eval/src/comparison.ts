// Side-by-side model comparison — compare outputs across 2+ models for the same prompt

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

/**
 * Runs the same prompt across multiple models and collects results
 * for side-by-side comparison.
 *
 * Used by the TUI comparison diff viewer to help users evaluate
 * which model performs best for a given type of task.
 */
export class ModelComparer {
  /**
   * Send a prompt to multiple models and collect their responses.
   * All models receive the identical system prompt and user message.
   */
  async compare(
    prompt: string,
    systemPrompt: string | undefined,
    models: Array<{ model: string; provider: string }>,
  ): Promise<ComparisonResult> {
    // TODO Phase 29: implement comparison
    // - Dispatch prompt to each model in parallel
    // - Collect outputs from @agent-workbench/protocol provider system
    // - Measure latency per model
    // - Estimate cost per model
    void systemPrompt;
    void models;
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  /** Get a unified diff between two model outputs */
  diffOutput(outputA: string, outputB: string): string {
    // TODO Phase 29: use @agent-workbench/diff for unified diff
    void outputA;
    void outputB;
    return "";
  }
}
