import type { ToolDefinition } from "@agent-workbench/protocol";
import type { ModelProvider, ModelResponse } from "@agent-workbench/models";
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
}
