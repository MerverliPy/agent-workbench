/**
 * Provider plugin extension interface.
 *
 * Plugins can register custom model providers. The Plugin SDK defines
 * a lightweight provider interface so plugins don't depend on
 * @agent-workbench/models directly.
 */

/** Message types sent to a model provider. */
export interface PluginModelMessage {
  readonly role: "user" | "assistant" | "system" | "tool";
  readonly content: string;
  readonly toolCallId?: string;
  readonly toolCalls?: PluginToolCall[];
}

/** Tool call structure within a message. */
export interface PluginToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

/** Response from a model provider. */
export interface PluginModelResponse {
  readonly content: string;
  readonly toolCalls?: PluginToolCall[];
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
}

/** Model provider interface that plugins implement. */
export interface PluginModelProvider {
  readonly id: string;
  readonly name: string;
  call(messages: PluginModelMessage[], tools?: PluginToolDefinition[], signal?: AbortSignal): Promise<PluginModelResponse>;
  stream?(messages: PluginModelMessage[], tools?: PluginToolDefinition[], signal?: AbortSignal): AsyncGenerator<PluginStreamChunk>;
}

/** Tool definition passed to the model provider. */
export interface PluginToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** Streaming chunk from a model provider. */
export interface PluginStreamChunk {
  readonly delta: string;
  readonly toolCallDelta?: { readonly id: string; readonly name?: string; readonly arguments?: string };
  readonly done: boolean;
}

/** Interface that provider plugins must export as their default export. */
export interface ProviderPlugin {
  /** Plugin metadata. */
  readonly name: string;
  readonly version: string;
  /** Providers provided by this plugin. */
  readonly providers: PluginModelProvider[];
}
