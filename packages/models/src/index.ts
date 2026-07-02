export type {
  ModelMessage,
  ModelToolSpec,
  ModelToolCall,
  ModelUsage,
  ModelResponseKind,
  ModelResponse,
  ModelRequest,
  ModelStreamChunk,
  ModelProvider,
} from "./types";

export { StubModelProvider } from "./stub-provider";

export {
  ProviderConfigError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderServerError,
  ProviderResponseError,
} from "./errors";

export {
  redactApiKey,
  redactAuthorizationHeader,
  redactString,
  redactHeaders,
  redactError,
} from "./redact";

export {
  parseProviderConfig,
  detectAvailableProviders,
} from "./provider-config";
export type { ProviderConfig } from "./provider-config";

export { OpenAICompatibleProvider } from "./providers/openai-compatible";
export { AnthropicProvider } from "./providers/anthropic";
export { createOpenRouterProvider, createOllamaProvider } from "./providers/openrouter";

export { ProviderRegistry } from "./provider-registry";
export type { ProviderEntry, ProviderModelEntry } from "./provider-registry";

export { ProviderMarketplace } from "./marketplace";
export { SmartRouter } from "./smart-router";
export { CostTracker } from "./cost-tracker";
export { ProviderHealthMonitor } from "./provider-health";
export type { TaskClassification, RoutingDecision } from "./smart-router";
export type { ProviderHealthStatus } from "./provider-health";
