import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
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

  /**
   * Stream the configured text response word-by-word, simulating incremental
   * model output for offline testing.
   *
   * Emits a terminal chunk with usage metadata after the full text is streamed.
   * Respects abort signals mid-stream.
   */
  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    // Tool-call mode on first call: yield a terminal chunk with tool calls,
    // then subsequent calls stream text.
    this.callCount += 1;
    if (this.stubbedToolCall !== undefined && this.callCount === 1) {
      // Tool-call responses are not streamed — yield a single terminal chunk
      // so the caller completes the loop.
      return;
    }

    const words = this.textResponse.split(" ");
    for (let i = 0; i < words.length; i++) {
      if (request.signal?.aborted) {
        throw new DOMException("Model call aborted", "AbortError");
      }

      const isLast = i === words.length - 1;
      const content = words[i] + (isLast ? "" : " ");

      yield {
        content,
        done: isLast,
        ...(isLast
          ? {
              stopReason: "stop" as const,
              usage: {
                inputTokens: request.messages.length * 10,
                outputTokens: 5,
              },
            }
          : {}),
      };
    }
  }
}
