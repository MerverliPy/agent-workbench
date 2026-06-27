import type { ModelProvider, ModelRequest, ModelResponse, ModelToolCall } from "@agent-workbench/models";

export interface MockModelTurn {
  toolCalls?: ModelToolCall[];
  text?: string;
}

export type FaultAction =
  | { type: "normal"; turn: MockModelTurn }
  | { type: "error"; message: string }
  | { type: "abort" }
  | { type: "empty-tool-calls" };

/**
 * Deterministic fault-injection model provider for Phase 14B-2B tests.
 *
 * Each call to `call()` consumes the next FaultAction. After all configured
 * actions are consumed, the provider returns a default text response.
 *
 * Supports:
 *  - normal model turn (text or tool_calls)
 *  - throw Error on a specific call
 *  - throw DOMException AbortError on a specific call
 *  - empty tool_calls response (calls: [])
 *
 * Usage:
 * ```ts
 * const prov = new FaultModelProvider([
 *   { type: "normal", turn: { toolCalls: [{ id: "c1", name: "read", input: {} }] } },
 *   { type: "error", message: "Provider crash" },
 * ]);
 * ```
 */
export class FaultModelProvider implements ModelProvider {
  private readonly actions: FaultAction[];
  private callIndex = 0;
  private readonly defaultText: string;

  constructor(actions: FaultAction[], defaultText = "fault mock response") {
    this.actions = [...actions];
    this.defaultText = defaultText;
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const action = this.actions[this.callIndex];
    this.callIndex += 1;

    if (action === undefined) {
      return {
        kind: { type: "text", content: this.defaultText },
        stopReason: "stop",
        usage: { inputTokens: request.messages.length * 10, outputTokens: 5 },
      };
    }

    switch (action.type) {
      case "error":
        throw new Error(action.message);

      case "abort":
        throw new DOMException("Fault-injected abort", "AbortError");

      case "empty-tool-calls":
        return {
          kind: { type: "tool_calls", calls: [] },
          stopReason: "tool_use",
        };

      case "normal": {
        if (action.turn.toolCalls !== undefined && action.turn.toolCalls.length > 0) {
          return {
            kind: { type: "tool_calls", calls: action.turn.toolCalls },
            stopReason: "tool_use",
          };
        }
        return {
          kind: { type: "text", content: action.turn.text ?? this.defaultText },
          stopReason: "stop",
          usage: { inputTokens: request.messages.length * 10, outputTokens: 5 },
        };
      }
    }
  }

  reset(): void {
    this.callIndex = 0;
  }
}
