import type { ModelProvider, ModelRequest, ModelResponse, ModelToolCall } from "@agent-workbench/models";

export interface MockModelTurn {
  /** Tool calls to return on this turn (if any). */
  toolCalls?: ModelToolCall[];
  /** Optional text response — if provided, the run ends after this turn. */
  text?: string;
}

/**
 * Programmable multi-turn mock model provider for tests.
 *
 * Configured with a sequence of turns. Each call to `call()` consumes the
 * next turn. After the last configured turn the provider returns a default
 * text response.
 *
 * Usage:
 * ```ts
 * const mock = new MockModelProvider([
 *   { toolCalls: [{ id: "c1", name: "read", input: { path: "x.ts" } }] },
 *   { toolCalls: [{ id: "c2", name: "grep", input: { pattern: "foo" } }] },
 *   { text: "Done." },
 * ]);
 * ```
 */
export class MockModelProvider implements ModelProvider {
  private readonly turns: MockModelTurn[];
  private callIndex = 0;
  private readonly defaultText: string;

  constructor(turns: MockModelTurn[], defaultText = "mock response") {
    this.turns = [...turns];
    this.defaultText = defaultText;
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const turn: MockModelTurn | undefined = this.turns[this.callIndex];
    this.callIndex += 1;

    if (turn === undefined) {
      return {
        kind: { type: "text", content: this.defaultText },
        stopReason: "stop",
        usage: { inputTokens: request.messages.length * 10, outputTokens: 5 },
      };
    }

    if (turn.toolCalls !== undefined && turn.toolCalls.length > 0) {
      return {
        kind: { type: "tool_calls", calls: turn.toolCalls },
        stopReason: "tool_use",
      };
    }

    return {
      kind: { type: "text", content: turn.text ?? this.defaultText },
      stopReason: "stop",
      usage: { inputTokens: request.messages.length * 10, outputTokens: 5 },
    };
  }

  reset(): void {
    this.callIndex = 0;
  }
}
