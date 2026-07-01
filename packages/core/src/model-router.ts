import type { ToolDefinition } from "@agent-workbench/protocol";
import type { ModelProvider, ModelResponse, ModelStreamChunk } from "@agent-workbench/models";
import type { ContextMessage } from "./types";

/**
 * Routes model calls to the configured provider.
 *
 * Phase 6: a single provider is registered at construction time. Future phases
 * will add multi-provider routing based on session/agent configuration.
 */
export class ModelRouter {
  constructor(private readonly provider: ModelProvider) {}

  /**
   * Call the model with the given message context.
   *
   * @param messages  The full context array to send.
   * @param tools     Optional tool definitions to expose to the model.
   * @param signal    Abort signal; the provider is expected to honour it.
   * @param maxTokens Soft token cap passed to the provider.
   */
  async route(
    messages: ContextMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    maxTokens?: number
  ): Promise<ModelResponse> {
    return this.provider.call({
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId !== undefined ? { toolCallId: m.toolCallId } : {}),
        ...(m.toolCalls !== undefined ? { toolCalls: m.toolCalls } : {}),
      })),
      ...(tools !== undefined && tools.length > 0
        ? {
            tools: tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          }
        : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(signal !== undefined ? { signal } : {}),
    });
  }

  /**
   * Stream a response from the model incrementally.
   *
   * Yields `ModelStreamChunk` values. Falls back to `route()` if the provider
   * does not support streaming — in that case a single terminal chunk is
   * yielded with the complete response.
   *
   * @param messages  The full context array to send.
   * @param tools     Optional tool definitions to expose to the model.
   * @param signal    Abort signal; the provider is expected to honour it.
   * @param maxTokens Soft token cap passed to the provider.
   */
  async *routeStream(
    messages: ContextMessage[],
    tools?: ToolDefinition[],
    signal?: AbortSignal,
    maxTokens?: number
  ): AsyncIterable<ModelStreamChunk> {
    if (typeof this.provider.stream !== "function") {
      // Fallback: call non-streaming and yield a single terminal chunk
      const response = await this.route(messages, tools, signal, maxTokens);
      yield {
        content: response.kind.type === "text" ? response.kind.content : "",
        done: true,
        ...(response.usage ? { usage: response.usage } : {}),
        ...(response.stopReason ? { stopReason: response.stopReason } : {}),
      };
      return;
    }

    const mappedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCallId !== undefined ? { toolCallId: m.toolCallId } : {}),
      ...(m.toolCalls !== undefined ? { toolCalls: m.toolCalls } : {}),
    }));

    const mappedTools = (tools !== undefined && tools.length > 0)
      ? tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }))
      : undefined;

    yield* this.provider.stream({
      messages: mappedMessages,
      ...(mappedTools !== undefined ? { tools: mappedTools } : {}),
      ...(maxTokens !== undefined ? { maxTokens } : {}),
      ...(signal !== undefined ? { signal } : {}),
    });
  }

  /**
   * Returns true when the underlying provider supports streaming.
   */
  supportsStreaming(): boolean {
    return typeof this.provider.stream === "function";
  }
}
