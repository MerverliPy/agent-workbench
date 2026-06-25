/**
 * Provider-neutral types for model calls.
 *
 * These types define the interface between packages/core (ModelRouter) and
 * packages/models (provider adapters). They are intentionally decoupled from
 * any specific provider wire format.
 */

/** A single message in a model conversation. */
export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Required when role === "tool" — links back to the model's tool-call ID. */
  toolCallId?: string;
}

/** A tool specification presented to the model so it can request tool calls. */
export interface ModelToolSpec {
  name: string;
  description: string;
  /** JSON Schema object describing the tool's input. */
  inputSchema: unknown;
}

/** A single tool call the model requested. */
export interface ModelToolCall {
  /** Provider-generated call ID (used to correlate results). */
  id: string;
  name: string;
  /** Parsed input object. May be unknown if the provider returns raw JSON. */
  input: unknown;
}

/** Token-usage metadata returned alongside a model response. */
export interface ModelUsage {
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Discriminated union for the semantic content of a model response.
 * - `text`: the model produced a final assistant message.
 * - `tool_calls`: the model wants to invoke one or more tools.
 */
export type ModelResponseKind =
  | { readonly type: "text"; readonly content: string }
  | { readonly type: "tool_calls"; readonly calls: readonly ModelToolCall[] };

/** Full response envelope returned by a ModelProvider. */
export interface ModelResponse {
  kind: ModelResponseKind;
  usage?: ModelUsage;
  /** Provider-specific stop reason (e.g. "stop", "max_tokens", "tool_use"). */
  stopReason?: string;
}

/** Input to a model provider call. */
export interface ModelRequest {
  messages: ModelMessage[];
  /** Optional tool specs to expose to the model in this call. */
  tools?: ModelToolSpec[];
  /** Soft maximum-token hint — providers may ignore or cap this. */
  maxTokens?: number;
  /** Caller-supplied abort signal; providers should honour it where possible. */
  signal?: AbortSignal;
}

/**
 * The interface every model provider adapter must implement.
 *
 * Phase 6 ships only StubModelProvider. Real adapters (OpenAI, Anthropic, etc.)
 * are deferred to a future phase.
 */
export interface ModelProvider {
  call(request: ModelRequest): Promise<ModelResponse>;
}
