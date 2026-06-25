import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelToolCall,
} from "./types";

/**
 * Deterministic stub model provider for Phase 6 testing.
 *
 * Two configurable modes:
 *  1. Text mode (default) — always returns a fixed assistant text response.
 *  2. Tool-call mode (one-shot) — returns a single tool-call response on the
 *     first call for a given invocation sequence, then falls back to text so
 *     the model/tool loop can terminate naturally.
 *
 * This provider intentionally never calls any external service.
 */
export class StubModelProvider implements ModelProvider {
  private readonly textResponse: string;
  /**
   * Optional tool call to emit on the first model call of a run.
   * After the first call the provider returns textResponse so the loop ends.
   */
  private readonly stubbedToolCall?: ModelToolCall;

  constructor(options?: {
    textResponse?: string;
    stubbedToolCall?: ModelToolCall;
  }) {
    this.textResponse = options?.textResponse ?? "stub assistant response";
    if (options?.stubbedToolCall !== undefined) {
      this.stubbedToolCall = options.stubbedToolCall;
    }
  }

  /** Call counter resets per StubModelProvider instance. */
  private callCount = 0;

  async call(request: ModelRequest): Promise<ModelResponse> {
    // Respect abort signal even in the stub.
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    this.callCount += 1;

    if (this.stubbedToolCall !== undefined && this.callCount === 1) {
      return {
        kind: {
          type: "tool_calls",
          calls: [this.stubbedToolCall],
        },
        stopReason: "tool_use",
      };
    }

    return {
      kind: {
        type: "text",
        content: this.textResponse,
      },
      stopReason: "stop",
      usage: {
        inputTokens: request.messages.length * 10,
        outputTokens: 5,
      },
    };
  }

  /** Reset call counter (useful between test runs). */
  resetCallCount(): void {
    this.callCount = 0;
  }
}
