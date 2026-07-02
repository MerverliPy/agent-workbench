import { OpenAICompatibleProvider } from "./openai-compatible";
import type { ProviderConfig } from "../provider-config";
import type { ModelProvider } from "../types";

/**
 * Create an OpenRouter provider adapter.
 *
 * OpenRouter exposes an OpenAI-compatible chat completions endpoint at
 * https://openrouter.ai/api/v1. Adds HTTP-Referer and X-Title headers
 * for OpenRouter's ranking/analytics.
 */
export function createOpenRouterProvider(
  config: ProviderConfig,
  fetchImpl?: typeof fetch,
): ModelProvider {
  const siteUrl = process.env.OPENROUTER_SITE_URL ?? "http://localhost:5173";
  const siteName = process.env.OPENROUTER_SITE_NAME ?? "agent-workbench";

  const openRouterConfig: ProviderConfig = {
    ...config,
    baseUrl: config.baseUrl ?? "https://openrouter.ai/api/v1",
  };

  return new OpenAICompatibleProvider(openRouterConfig, fetchImpl, {
    extraHeaders: {
      "HTTP-Referer": siteUrl,
      "X-Title": siteName,
    },
  });
}

/**
 * Create an Ollama provider adapter.
 *
 * Ollama exposes an OpenAI-compatible chat completions endpoint at
 * http://localhost:11434/v1. No authentication required.
 */
export function createOllamaProvider(
  config: ProviderConfig,
  fetchImpl?: typeof fetch,
): ModelProvider {
  const ollamaConfig: ProviderConfig = {
    ...config,
    baseUrl: config.baseUrl ?? "http://localhost:11434/v1",
  };

  return new OpenAICompatibleProvider(ollamaConfig, fetchImpl, {
    skipAuth: true,
  });
}
