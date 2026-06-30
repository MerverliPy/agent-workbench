import type { ModelProvider, ModelRequest, ModelResponse, ModelToolCall, ModelUsage } from "../types";
import type { ProviderConfig } from "../provider-config";
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderResponseError,
} from "../errors";
import { redactApiKey, redactString } from "../redact";

interface OpenAICompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
    tool_call_id?: string;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }>;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: unknown;
    };
  }>;
  max_tokens?: number;
}

interface OpenAICompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ProviderConfig, fetchImpl?: typeof fetch) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const body = this.buildRequestBody(request);
    const url = `${this.baseUrl}/chat/completions`;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    };
    if (request.signal !== undefined) {
      fetchOptions.signal = request.signal;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url, fetchOptions);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      throw new ProviderResponseError(
        safeErrorMessage("Provider request failed", err, this.apiKey)
      );
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new ProviderResponseError("Provider returned invalid JSON response");
    }

    return this.normalizeResponse(raw);
  }

  private buildRequestBody(request: ModelRequest): OpenAICompletionRequest {
    const messages: OpenAICompletionRequest["messages"] = request.messages.map((m) => {
      const wire: OpenAICompletionRequest["messages"][0] = {
        role: m.role,
        content: m.content,
      };
      if (m.toolCallId !== undefined) {
        wire.tool_call_id = m.toolCallId;
      }
      if (m.role === "assistant" && m.toolCalls !== undefined && m.toolCalls.length > 0) {
        wire.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: typeof tc.input === "string" ? tc.input : JSON.stringify(tc.input),
          },
        }));
        wire.content = "";
      }
      return wire;
    });

    const req: OpenAICompletionRequest = {
      model: this.model,
      messages,
    };

    if (request.tools !== undefined && request.tools.length > 0) {
      req.tools = request.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    if (request.maxTokens !== undefined) {
      req.max_tokens = request.maxTokens;
    }

    return req;
  }

  private async handleHttpError(response: Response): Promise<never> {
    let bodyText: string;
    try {
      bodyText = await response.text();
    } catch {
      bodyText = "(could not read response body)";
    }

    let redactedBody = redactString(bodyText);
    if (this.apiKey.length > 0) {
      redactedBody = redactedBody.replaceAll(this.apiKey, redactApiKey(this.apiKey));
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new ProviderAuthError(
          `Provider authentication error (${response.status}): ${safeTruncate(redactedBody)}`
        );
      case 429:
        throw new ProviderRateLimitError(
          `Provider rate limit exceeded (${response.status}): ${safeTruncate(redactedBody)}`
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ProviderServerError(
          `Provider server error (${response.status}): ${safeTruncate(redactedBody)}`
        );
      default:
        throw new ProviderResponseError(
          `Provider HTTP error (${response.status}): ${safeTruncate(redactedBody)}`
        );
    }
  }

  private normalizeResponse(raw: unknown): ModelResponse {
    if (typeof raw !== "object" || raw === null) {
      throw new ProviderResponseError("Provider response was not a JSON object");
    }

    const data = raw as Record<string, unknown>;

    const choices = data["choices"];
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new ProviderResponseError("Provider response missing choices array");
    }

    const choice = choices[0] as Record<string, unknown>;
    const message = choice["message"] as Record<string, unknown> | undefined;

    if (message === undefined || typeof message !== "object") {
      throw new ProviderResponseError("Provider response missing message object");
    }

    const finishReason = typeof choice["finish_reason"] === "string"
      ? choice["finish_reason"]
      : "stop";

    const usage: ModelUsage | undefined = this.extractUsage(data);

    const toolCalls = this.normalizeToolCalls(message);
    if (toolCalls !== undefined && toolCalls.length > 0) {
      const result: ModelResponse = {
        kind: { type: "tool_calls", calls: toolCalls },
        stopReason: finishReason,
      };
      if (usage !== undefined) result.usage = usage;
      return result;
    }

    const content = typeof message["content"] === "string"
      ? message["content"]
      : "";

    const result: ModelResponse = {
      kind: { type: "text", content: content ?? "" },
      stopReason: finishReason,
    };
    if (usage !== undefined) result.usage = usage;
    return result;
  }

  private normalizeToolCalls(
    message: Record<string, unknown>
  ): ModelToolCall[] | undefined {
    const rawCalls = message["tool_calls"];
    if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
      return undefined;
    }

    return rawCalls.map((tc: unknown) => {
      const call = tc as Record<string, unknown>;
      const fn = call["function"] as Record<string, unknown> | undefined;
      let input: unknown = undefined;

      if (fn !== undefined && typeof fn["arguments"] === "string") {
        try {
          input = JSON.parse(fn["arguments"]);
        } catch {
          input = fn["arguments"];
        }
      }

      return {
        id: typeof call["id"] === "string" ? call["id"] : "",
        name: fn !== undefined && typeof fn["name"] === "string"
          ? fn["name"]
          : "unknown",
        input,
      };
    });
  }

  private extractUsage(data: Record<string, unknown>): ModelUsage | undefined {
    const usage = data["usage"];
    if (usage === undefined || typeof usage !== "object" || usage === null) {
      return undefined;
    }
    const u = usage as Record<string, unknown>;
    const promptTokens = typeof u["prompt_tokens"] === "number" ? u["prompt_tokens"] : undefined;
    const completionTokens = typeof u["completion_tokens"] === "number" ? u["completion_tokens"] : undefined;
    if (promptTokens === undefined && completionTokens === undefined) {
      return undefined;
    }
    return {
      ...(promptTokens !== undefined ? { inputTokens: promptTokens } : {}),
      ...(completionTokens !== undefined ? { outputTokens: completionTokens } : {}),
    };
  }
}

function safeTruncate(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function safeErrorMessage(prefix: string, err: unknown, apiKey: string): string {
  let message = err instanceof Error ? err.message : String(err);
  message = redactString(message);
  if (apiKey.length > 0) {
    message = message.replaceAll(apiKey, redactApiKey(apiKey));
  }
  return `${prefix}: ${message}`;
}
