/**
 * OpenAI-compatible provider adapter.
 *
 * Works with any provider that exposes an OpenAI-compatible chat completions
 * API (DeepSeek, OpenRouter, Ollama, opencode-go, etc.).
 *
 * Implements the PluginModelProvider interface from @agent-workbench/plugin-sdk.
 */

import type {
  PluginModelMessage,
  PluginModelResponse,
  PluginStreamChunk,
  PluginToolDefinition,
} from "@agent-workbench/plugin-sdk";

export interface OpenAIAdapterConfig {
  readonly providerId: string;
  readonly displayName: string;
  readonly model: string;
  readonly baseUrl: string;
  readonly apiKey: string;
}

export class OpenAIAdapter {
  readonly id: string;
  readonly name: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: OpenAIAdapterConfig) {
    this.id = config.providerId;
    this.name = config.displayName;
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  async call(
    messages: PluginModelMessage[],
    _tools?: PluginToolDefinition[],
    signal?: AbortSignal,
  ): Promise<PluginModelResponse> {
    const body = this.buildBody(messages, _tools, false);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(
        `[${this.id}] API ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const choice = (
      json.choices as Array<Record<string, unknown>> | undefined
    )?.[0];
    const message = choice?.message as Record<string, unknown> | undefined;

    const content = (message?.content as string | null) ?? "";
    const toolCallsRaw = message?.tool_calls as
      | Array<Record<string, unknown>>
      | undefined;

    const usage = json.usage as Record<string, unknown> | undefined;

    return {
      content,
      toolCalls: toolCallsRaw?.map((tc) => ({
        id: tc.id as string,
        name: (tc.function as Record<string, unknown>)?.name as string,
        arguments: JSON.parse(
          ((tc.function as Record<string, unknown>)?.arguments as string) ??
            "{}",
        ) as Record<string, unknown>,
      })),
      usage: usage
        ? {
            inputTokens: (usage.prompt_tokens as number) ?? 0,
            outputTokens: (usage.completion_tokens as number) ?? 0,
          }
        : undefined,
    };
  }

  async *stream(
    messages: PluginModelMessage[],
    _tools?: PluginToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<PluginStreamChunk> {
    const body = this.buildBody(messages, _tools, true);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(
        `[${this.id}] API ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("[${this.id}] No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const json = JSON.parse(trimmed.slice(6)) as Record<
              string,
              unknown
            >;
            const choice = (
              json.choices as Array<Record<string, unknown>> | undefined
            )?.[0];
            const delta = choice?.delta as Record<string, unknown> | undefined;
            const finishReason = choice?.finish_reason as
              | string
              | null
              | undefined;

            yield {
              delta: (delta?.content as string) ?? "",
              done: finishReason !== null && finishReason !== undefined,
            };
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final chunk to signal completion
    yield { delta: "", done: true };
  }

  private buildBody(
    messages: PluginModelMessage[],
    tools?: PluginToolDefinition[],
    stream?: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      stream: stream ?? false,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    return body;
  }
}
