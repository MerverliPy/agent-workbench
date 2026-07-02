/**
 * GitHub Copilot provider adapter.
 *
 * Uses the GitHub Copilot API (completions endpoint at
 * https://api.githubcopilot.com/chat/completions).
 * Authenticates with a GitHub personal access token via COPILOT_GITHUB_TOKEN.
 *
 * The Copilot API is a modified OpenAI-compatible endpoint with some
 * Copilot-specific headers for model selection.
 */

import type { PluginModelMessage, PluginToolDefinition, PluginModelResponse, PluginStreamChunk } from "@agent-workbench/plugin-sdk";

export interface CopilotAdapterConfig {
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
}

export class CopilotAdapter {
  readonly id = "hermes:copilot";
  readonly name = "Copilot (via GitHub)";
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: CopilotAdapterConfig) {
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? "https://api.githubcopilot.com").replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  async call(
    messages: PluginModelMessage[],
    tools?: PluginToolDefinition[],
    signal?: AbortSignal,
  ): Promise<PluginModelResponse> {
    const body = this.buildBody(messages, tools, false);
    const headers = this.buildHeaders();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`[copilot] API ${response.status}: ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const choice = (json.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const message = choice?.message as Record<string, unknown> | undefined;
    const content = (message?.content as string | null) ?? "";
    const usage = json.usage as Record<string, unknown> | undefined;

    return {
      content,
      usage: usage ? {
        inputTokens: (usage.prompt_tokens as number) ?? 0,
        outputTokens: (usage.completion_tokens as number) ?? 0,
      } : undefined,
    };
  }

  async *stream(
    messages: PluginModelMessage[],
    tools?: PluginToolDefinition[],
    signal?: AbortSignal,
  ): AsyncGenerator<PluginStreamChunk> {
    const body = this.buildBody(messages, tools, true);
    const headers = this.buildHeaders();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`[copilot] API ${response.status}: ${text.slice(0, 200)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("[copilot] No response body");

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
            const json = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
            const choice = (json.choices as Array<Record<string, unknown>> | undefined)?.[0];
            const delta = choice?.delta as Record<string, unknown> | undefined;
            const finishReason = choice?.finish_reason as string | null | undefined;

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

    yield { delta: "", done: true };
  }

  private buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
      "Copilot-Integration-Id": "agent-workbench",
      "Editor-Version": "agent-workbench/0.0.0",
    };
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
