// Model playground — one-shot chat to test any configured model without a full session

export interface PlaygroundConfig {
  /** Model identifier */
  model: string;
  /** Provider identifier */
  provider: string;
  /** System prompt (optional) */
  systemPrompt?: string;
  /** Temperature (default: 0.7) */
  temperature?: number;
  /** Max tokens (default: 4096) */
  maxTokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
}

export interface PlaygroundResult {
  /** The model's response */
  output: string;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
  /** Latency in ms */
  latencyMs: number;
  /** Token usage */
  tokensUsed: {
    input: number;
    output: number;
  };
  /** Cost in USD */
  costUsd: number;
  /** Whether the output was streamed */
  streamed: boolean;
  /** Timestamp */
  timestamp: string;
}

/**
 * One-shot model playground — quick test of any configured model
 * without creating a full agent session.
 *
 * Integrated into the TUI as a dedicated panel for quick experiments.
 */
export class ModelPlayground {
  /**
   * Send a single message to a model and get the response.
   * Supports streaming via SSE when stream: true.
   */
  async send(config: PlaygroundConfig, message: string): Promise<PlaygroundResult> {
    // TODO Phase 29: implement playground
    // - Look up model from provider registry (@agent-workbench/protocol)
    // - Send one-shot completion via provider SDK
    // - Measure latency
    // - Estimate cost
    // - Support SSE streaming
    void config;
    void message;
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  /** List available models for the playground dropdown */
  async listAvailableModels(): Promise<Array<{ model: string; provider: string }>> {
    // TODO Phase 29: query configured providers from @agent-workbench/protocol
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }
}
