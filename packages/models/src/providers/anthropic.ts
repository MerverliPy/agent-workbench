import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderServerError,
} from "../errors";
import type { ProviderConfig } from "../provider-config";
import { redactApiKey, redactString } from "../redact";
import type {
  ModelMessage,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelToolCall,
  ModelUsage,
} from "../types";

// ── Anthropic wire types ───────────────────────────────────────────────

interface AnthropicContentText {
  type: "text";
  text: string;
}

interface AnthropicContentToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicContentToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type AnthropicContentBlock =
  | AnthropicContentText
  | AnthropicContentToolUse
  | AnthropicContentToolResult;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: AnthropicContentBlock[];
}

interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: unknown;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  tools?: AnthropicToolDef[];
  stream?: boolean;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string; partial_json?: string };
  content_block?: { type: string; id?: string; name?: string; input?: unknown };
  usage?: AnthropicUsage;
}

// ── Adapter ────────────────────────────────────────────────────────────

const ANTHROPIC_API_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements ModelProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ProviderConfig, fetchImpl?: typeof fetch) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  // ── call() ──────────────────────────────────────────────────────────

  async call(request: ModelRequest): Promise<ModelResponse> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const body = this.buildRequestBody(request);
    const url = `${this.baseUrl}/messages`;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
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
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderResponseError(
        safeErrorMessage("Anthropic request failed", err, this.apiKey),
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
        "Anthropic returned invalid JSON response",
      );
    }

    return this.normalizeResponse(raw);
  }

  // ── stream() ────────────────────────────────────────────────────────

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    if (request.signal?.aborted) {
      throw new DOMException("Model call aborted", "AbortError");
    }

    const body = this.buildRequestBody(request);
    body.stream = true;
    const url = `${this.baseUrl}/messages`;

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
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
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderResponseError(
        safeErrorMessage("Anthropic stream request failed", err, this.apiKey),
      );
    }

    if (!response.ok) {
      await this.handleHttpError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
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
    let accumulatedToolCalls: ModelToolCall[] | undefined;
    let finalUsage: ModelUsage | undefined;

    while (true) {
      if (request.signal?.aborted) {
        throw new DOMException("Model call aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        let event: AnthropicStreamEvent;
        try {
          event = JSON.parse(jsonStr) as AnthropicStreamEvent;
        } catch {
          continue;
        }

        switch (event.type) {
          case "content_block_start": {
            const block = event.content_block;
            if (block?.type === "tool_use") {
              if (!accumulatedToolCalls) accumulatedToolCalls = [];
              accumulatedToolCalls.push({
                id: block.id ?? "",
                name: block.name ?? "",
                input: {},
              });
            }
            break;
          }

          case "content_block_delta": {
            const delta = event.delta;
            if (delta?.type === "text_delta" && delta.text) {
              yield { content: delta.text, done: false };
            }
            if (
              delta?.type === "input_json_delta" &&
              delta.partial_json &&
              accumulatedToolCalls
            ) {
              // Accumulate tool-call input JSON
              const last =
                accumulatedToolCalls[accumulatedToolCalls.length - 1];
              if (last) {
                const prev = typeof last.input === "string" ? last.input : "";
                last.input = prev + delta.partial_json;
              }
            }
            break;
          }

          case "message_delta": {
            if (event.usage) {
              finalUsage = {
                inputTokens: event.usage.input_tokens,
                outputTokens: event.usage.output_tokens,
              };
            }
            break;
          }
        }
      }
    }

    // Parse accumulated tool-call inputs from JSON strings
    if (accumulatedToolCalls) {
      for (const tc of accumulatedToolCalls) {
        if (typeof tc.input === "string" && tc.input.length > 0) {
          try {
            tc.input = JSON.parse(tc.input);
          } catch {
            // Keep as string
          }
        }
      }
    }

    if (accumulatedToolCalls && accumulatedToolCalls.length > 0) {
      yield {
        content: "",
        done: true,
        stopReason: "tool_use",
        toolCalls: accumulatedToolCalls,
        ...(finalUsage ? { usage: finalUsage } : {}),
      };
    } else {
      yield {
        content: "",
        done: true,
        stopReason: "end_turn",
        ...(finalUsage ? { usage: finalUsage } : {}),
      };
    }
  }

  // ── Request building ────────────────────────────────────────────────

  private buildRequestBody(request: ModelRequest): AnthropicRequest {
    const systemMessages = request.messages.filter((m) => m.role === "system");
    const conversation = request.messages.filter((m) => m.role !== "system");

    // Build Anthropic-formatted messages, merging same-role consecutive messages
    const messages: AnthropicMessage[] = [];

    for (const msg of conversation) {
      const blocks = this.toContentBlocks(msg);
      if (blocks.length === 0) continue;

      const role =
        msg.role === "user" || msg.role === "tool" ? "user" : "assistant";

      const prev = messages[messages.length - 1];
      if (prev && prev.role === role) {
        // Merge into previous message (Anthropic requires alternating roles)
        prev.content.push(...blocks);
      } else {
        messages.push({ role, content: blocks });
      }
    }

    const req: AnthropicRequest = {
      model: this.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages,
    };

    // System messages go in the top-level `system` field
    if (systemMessages.length > 0) {
      req.system = systemMessages.map((m) => m.content).join("\n\n");
    }

    if (request.tools && request.tools.length > 0) {
      req.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    return req;
  }

  private toContentBlocks(m: ModelMessage): AnthropicContentBlock[] {
    if (m.role === "tool" && m.toolCallId) {
      return [
        { type: "tool_result", tool_use_id: m.toolCallId, content: m.content },
      ];
    }

    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const blocks: AnthropicContentBlock[] = [];
      if (m.content) {
        blocks.push({ type: "text", text: m.content });
      }
      for (const tc of m.toolCalls) {
        blocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }
      return blocks;
    }

    // Default: user or assistant text message
    if (m.content.length > 0) {
      return [{ type: "text", text: m.content }];
    }
    return [];
  }

  // ── Response normalization ──────────────────────────────────────────

  private normalizeResponse(raw: unknown): ModelResponse {
    if (typeof raw !== "object" || raw === null) {
      throw new ProviderResponseError(
        "Anthropic response was not a JSON object",
      );
    }

    const data = raw as Record<string, unknown>;
    const content = data.content;

    if (!Array.isArray(content) || content.length === 0) {
      throw new ProviderResponseError(
        "Anthropic response missing content array",
      );
    }

    const blocks = content as AnthropicContentBlock[];
    const usage = this.extractUsage(data);
    const stopReason =
      typeof data.stop_reason === "string"
        ? (data.stop_reason as string)
        : "end_turn";

    // Check for tool calls
    const toolCalls = this.normalizeToolCalls(blocks);
    if (toolCalls && toolCalls.length > 0) {
      const result: ModelResponse = {
        kind: { type: "tool_calls", calls: toolCalls },
        stopReason,
      };
      if (usage) result.usage = usage;
      return result;
    }

    // Extract text
    let text = "";
    for (const block of blocks) {
      if (block.type === "text") {
        text += (block as AnthropicContentText).text;
      }
    }

    const result: ModelResponse = {
      kind: { type: "text", content: text },
      stopReason,
    };
    if (usage) result.usage = usage;
    return result;
  }

  private normalizeToolCalls(
    blocks: AnthropicContentBlock[],
  ): ModelToolCall[] | undefined {
    const calls: ModelToolCall[] = [];
    for (const block of blocks) {
      if (block.type === "tool_use") {
        const tu = block as AnthropicContentToolUse;
        calls.push({ id: tu.id, name: tu.name, input: tu.input });
      }
    }
    return calls.length > 0 ? calls : undefined;
  }

  private extractUsage(data: Record<string, unknown>): ModelUsage | undefined {
    const usage = data.usage;
    if (!usage || typeof usage !== "object") return undefined;
    const u = usage as Record<string, unknown>;
    const inputTokens =
      typeof u.input_tokens === "number" ? u.input_tokens : undefined;
    const outputTokens =
      typeof u.output_tokens === "number" ? u.output_tokens : undefined;
    if (inputTokens === undefined && outputTokens === undefined)
      return undefined;
    return {
      ...(inputTokens !== undefined ? { inputTokens } : {}),
      ...(outputTokens !== undefined ? { outputTokens } : {}),
    };
  }

  // ── Error handling ──────────────────────────────────────────────────

  private async handleHttpError(response: Response): Promise<never> {
    let bodyText: string;
    try {
      bodyText = await response.text();
    } catch {
      bodyText = "(could not read response body)";
    }

    let redacted = redactString(bodyText);
    if (this.apiKey.length > 0) {
      redacted = redacted.replaceAll(this.apiKey, redactApiKey(this.apiKey));
    }

    switch (response.status) {
      case 401:
      case 403:
        throw new ProviderAuthError(
          `Anthropic auth error (${response.status}): ${safeTruncate(redacted)}`,
        );
      case 429:
        throw new ProviderRateLimitError(
          `Anthropic rate limit (${response.status}): ${safeTruncate(redacted)}`,
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ProviderServerError(
          `Anthropic server error (${response.status}): ${safeTruncate(redacted)}`,
        );
      default:
        throw new ProviderResponseError(
          `Anthropic HTTP error (${response.status}): ${safeTruncate(redacted)}`,
        );
    }
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
  if (err instanceof Error) {
    let msg = err.message;
    if (apiKey.length > 0) {
      msg = msg.replaceAll(apiKey, redactApiKey(apiKey));
    }
    return `${prefix}: ${msg}`;
  }
  return `${prefix}: unknown error`;
}
