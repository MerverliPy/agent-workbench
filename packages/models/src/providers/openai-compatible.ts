import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderServerError,
} from "../errors";
import type { ProviderConfig } from "../provider-config";
import { redactApiKey, redactString } from "../redact";
import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelToolCall,
  ModelUsage,
} from "../types";

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
  private readonly skipAuth: boolean;
  private readonly extraHeaders: Record<string, string>;

  constructor(
    config: ProviderConfig,
    fetchImpl?: typeof fetch,
    options?: { skipAuth?: boolean; extraHeaders?: Record<string, string> },
  ) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.skipAuth = options?.skipAuth ?? false;
    this.extraHeaders = options?.extraHeaders ?? {};
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.extraHeaders,
    };
    if (!this.skipAuth && this.apiKey.length > 0) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const body = this.buildRequestBody(request);
    const url = `${this.baseUrl}/chat/completions`;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: this.buildHeaders(),
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
        safeErrorMessage("Provider request failed", err, this.apiKey),
      );
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new ProviderResponseError(
        "Provider returned invalid JSON response",
      );
    }

    return this.normalizeResponse(raw);
  }

  /**
   * Stream a model response from an OpenAI-compatible API using SSE.
   *
   * Yields `ModelStreamChunk` values for each content delta. Tool-call
   * deltas are accumulated and emitted only in the terminal chunk — tool
   * responses remain non-streaming at the interface level.
   *
   * Abort signals are honoured mid-stream. Errors are redacted using the
   * same rules as `call()`.
   */
  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const body = this.buildRequestBody(request);
    const streamBody = { ...body, stream: true };
    const url = `${this.baseUrl}/chat/completions`;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(streamBody),
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
        safeErrorMessage("Provider request failed", err, this.apiKey),
      );
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      // Fall back to non-streaming if the response body is not readable
      const raw = await response.json();
      const normalized = this.normalizeResponse(raw);

      yield {
        content: normalized.kind.type === "text" ? normalized.kind.content : "",
        done: true,
        ...(normalized.usage ? { usage: normalized.usage } : {}),
        ...(normalized.stopReason ? { stopReason: normalized.stopReason } : {}),
      };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    // Accumulated tool call state for the final chunk
    let accumulatedToolCalls: ModelToolCall[] | undefined;
    let finalFinishReason: string | undefined;
    let finalUsage: ModelUsage | undefined;

    while (true) {
      if (request.signal?.aborted) {
        throw new DOMException("Model call aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed === "" || trimmed.startsWith(":")) continue; // comment or empty
        if (trimmed === "data: [DONE]") continue; // stream end signal

        if (!trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          // Malformed JSON line — skip
          continue;
        }

        // Extract usage if present (may come in a standalone chunk)
        const usage = this.extractUsage(data);
        if (usage !== undefined) {
          finalUsage = usage;
        }

        const choices = data.choices;
        if (!Array.isArray(choices) || choices.length === 0) continue;

        const choice = choices[0] as Record<string, unknown>;

        // Capture finish reason
        if (
          typeof choice.finish_reason === "string" &&
          choice.finish_reason !== "null"
        ) {
          finalFinishReason = choice.finish_reason;
        }

        const delta = choice.delta as Record<string, unknown> | undefined;
        if (!delta || typeof delta !== "object") continue;

        // Extract text content delta
        const contentDelta =
          typeof delta.content === "string" ? delta.content : "";

        // Extract tool call deltas (accumulate for terminal chunk)
        const tcDelta = delta.tool_calls;
        if (Array.isArray(tcDelta)) {
          for (const tc of tcDelta) {
            const entry = tc as Record<string, unknown>;
            const idx = typeof entry.index === "number" ? entry.index : 0;
            const fn = entry.function as Record<string, unknown> | undefined;

            if (!fn) continue;

            // Accumulate: append to existing or create new
            if (!accumulatedToolCalls) {
              accumulatedToolCalls = [];
            }
            while (accumulatedToolCalls.length <= idx) {
              accumulatedToolCalls.push({
                id: "",
                name: "",
                input: "",
              });
            }
            // Merge delta into the accumulated slot
            const slot = accumulatedToolCalls[idx]!;
            if (typeof entry.id === "string") {
              slot.id += entry.id;
            }
            if (fn && typeof fn.name === "string") {
              slot.name += fn.name;
            }
            if (fn && typeof fn.arguments === "string") {
              const prevInput =
                typeof slot.input === "string" ? slot.input : "";
              slot.input = prevInput + fn.arguments;
            }
          }
          // Don't yield text for tool-call chunks
          continue;
        }

        // Yield text delta if non-empty
        if (contentDelta.length > 0) {
          yield {
            content: contentDelta,
            done: false,
          };
        }
      }
    }

    // Terminal chunk
    if (accumulatedToolCalls && accumulatedToolCalls.length > 0) {
      // Parse tool-call arguments from accumulated strings
      for (const tc of accumulatedToolCalls) {
        if (typeof tc.input === "string" && tc.input.length > 0) {
          try {
            tc.input = JSON.parse(tc.input);
          } catch {
            // Keep as string if not valid JSON
          }
        }
      }
      yield {
        content: "",
        done: true,
        stopReason: finalFinishReason ?? "tool_use",
        toolCalls: accumulatedToolCalls,
        ...(finalUsage ? { usage: finalUsage } : {}),
      };
    } else {
      yield {
        content: "",
        done: true,
        stopReason: finalFinishReason ?? "stop",
        ...(finalUsage ? { usage: finalUsage } : {}),
      };
    }
  }

  private buildRequestBody(request: ModelRequest): OpenAICompletionRequest {
    const messages: OpenAICompletionRequest["messages"] = request.messages.map(
      (m) => {
        const wire: OpenAICompletionRequest["messages"][0] = {
          role: m.role,
          content: m.content,
        };
        if (m.toolCallId !== undefined) {
          wire.tool_call_id = m.toolCallId;
        }
        if (
          m.role === "assistant" &&
          m.toolCalls !== undefined &&
          m.toolCalls.length > 0
        ) {
          wire.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: {
              name: tc.name,
              arguments:
                typeof tc.input === "string"
                  ? tc.input
                  : JSON.stringify(tc.input),
            },
          }));
          wire.content = "";
        }
        return wire;
      },
    );

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
      redactedBody = redactedBody.replaceAll(
        this.apiKey,
        redactApiKey(this.apiKey),
      );
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new ProviderAuthError(
          `Provider authentication error (${response.status}): ${safeTruncate(redactedBody)}`,
        );
      case 429:
        throw new ProviderRateLimitError(
          `Provider rate limit exceeded (${response.status}): ${safeTruncate(redactedBody)}`,
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ProviderServerError(
          `Provider server error (${response.status}): ${safeTruncate(redactedBody)}`,
        );
      default:
        throw new ProviderResponseError(
          `Provider HTTP error (${response.status}): ${safeTruncate(redactedBody)}`,
        );
    }
  }

  private normalizeResponse(raw: unknown): ModelResponse {
    if (typeof raw !== "object" || raw === null) {
      throw new ProviderResponseError(
        "Provider response was not a JSON object",
      );
    }

    const data = raw as Record<string, unknown>;

    const choices = data.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new ProviderResponseError(
        "Provider response missing choices array",
      );
    }

    const choice = choices[0] as Record<string, unknown>;
    const message = choice.message as Record<string, unknown> | undefined;

    if (message === undefined || typeof message !== "object") {
      throw new ProviderResponseError(
        "Provider response missing message object",
      );
    }

    const finishReason =
      typeof choice.finish_reason === "string" ? choice.finish_reason : "stop";

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

    const content = typeof message.content === "string" ? message.content : "";

    const result: ModelResponse = {
      kind: { type: "text", content: content ?? "" },
      stopReason: finishReason,
    };
    if (usage !== undefined) result.usage = usage;
    return result;
  }

  private normalizeToolCalls(
    message: Record<string, unknown>,
  ): ModelToolCall[] | undefined {
    const rawCalls = message.tool_calls;
    if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
      return undefined;
    }

    return rawCalls.map((tc: unknown) => {
      const call = tc as Record<string, unknown>;
      const fn = call.function as Record<string, unknown> | undefined;
      let input: unknown;

      if (fn !== undefined && typeof fn.arguments === "string") {
        try {
          input = JSON.parse(fn.arguments);
        } catch {
          input = fn.arguments;
        }
      }

      return {
        id: typeof call.id === "string" ? call.id : "",
        name:
          fn !== undefined && typeof fn.name === "string" ? fn.name : "unknown",
        input,
      };
    });
  }

  private extractUsage(data: Record<string, unknown>): ModelUsage | undefined {
    const usage = data.usage;
    if (usage === undefined || typeof usage !== "object" || usage === null) {
      return undefined;
    }
    const u = usage as Record<string, unknown>;
    const promptTokens =
      typeof u.prompt_tokens === "number" ? u.prompt_tokens : undefined;
    const completionTokens =
      typeof u.completion_tokens === "number" ? u.completion_tokens : undefined;
    if (promptTokens === undefined && completionTokens === undefined) {
      return undefined;
    }
    return {
      ...(promptTokens !== undefined ? { inputTokens: promptTokens } : {}),
      ...(completionTokens !== undefined
        ? { outputTokens: completionTokens }
        : {}),
    };
  }
}

function safeTruncate(text: string, maxLen = 500): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function safeErrorMessage(
  prefix: string,
  err: unknown,
  apiKey: string,
): string {
  let message = err instanceof Error ? err.message : String(err);
  message = redactString(message);
  if (apiKey.length > 0) {
    message = message.replaceAll(apiKey, redactApiKey(apiKey));
  }
  return `${prefix}: ${message}`;
}
