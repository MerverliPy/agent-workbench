// Model playground — one-shot chat to test any configured model without a full session
//
// Makes direct HTTP calls to provider APIs (OpenAI, Anthropic, OpenRouter, custom).
// Supports both streaming (SSE) and non-streaming responses.
//
// Credential discovery order:
//   1. Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.)
//   2. Process-scoped credential store (future: ~/.agent-workbench/auth.json)
//
// API endpoint detection:
//   - openai → api.openai.com/v1/chat/completions
//   - anthropic → api.anthropic.com/v1/messages
//   - openrouter → openrouter.ai/api/v1/chat/completions
//   - custom → uses configured baseUrl from ProviderProfile

export interface PlaygroundConfig {
  /** Model identifier */
  model: string;
  /** Provider type: openai, anthropic, openrouter, or custom */
  provider: string;
  /** System prompt (optional) */
  systemPrompt?: string;
  /** Temperature (default: 0.7) */
  temperature?: number;
  /** Max tokens (default: 4096) */
  maxTokens?: number;
  /** Whether to stream the response via SSE */
  stream?: boolean;
  /** Override base URL (for custom providers) */
  baseUrl?: string;
  /** Override API key (otherwise discovered from environment) */
  apiKey?: string;
}

export interface PlaygroundResult {
  /** The model's response */
  output: string;
  /** Model used */
  model: string;
  /** Provider used */
  provider: string;
  /** Latency in ms */
  latencyMs: number;
  /** Token usage */
  tokensUsed: { input: number; output: number };
  /** Cost in USD */
  costUsd: number;
  /** Whether the output was streamed */
  streamed: boolean;
  /** Timestamp */
  timestamp: string;
}

// Per-provider pricing (USD per 1K tokens, used for cost estimation)
const PROVIDER_PRICING: Record<string, { input: number; output: number }> = {
  openai: { input: 0.0025, output: 0.01 }, // GPT-4o default
  anthropic: { input: 0.003, output: 0.015 }, // Claude Sonnet default
  openrouter: { input: 0.0025, output: 0.01 },
  deepseek: { input: 0.0005, output: 0.002 },
  google: { input: 0.00125, output: 0.005 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "claude-sonnet-4": { input: 0.003, output: 0.015 },
  "claude-haiku-3-5": { input: 0.0008, output: 0.004 },
  "claude-opus-4": { input: 0.015, output: 0.075 },
  "deepseek-v4": { input: 0.0005, output: 0.002 },
  "deepseek-v4-pro": { input: 0.0005, output: 0.002 },
  "deepseek-v4-flash": { input: 0.0001, output: 0.0005 },
  "gemini-2.5-pro": { input: 0.00125, output: 0.005 },
  "gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
};

/** Default system prompts for common playground use cases */
const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  openai: "You are a helpful assistant.",
  anthropic: "You are a helpful assistant.",
  openrouter: "You are a helpful assistant.",
};

/**
 * One-shot model playground — quick test of any configured model
 * without creating a full agent session.
 *
 * Integrated into the TUI as a dedicated panel for quick experiments.
 */
export class ModelPlayground {
  /**
   * Send a single message to a model and get the response.
   */
  async send(config: PlaygroundConfig, message: string): Promise<PlaygroundResult> {
    const startTime = performance.now();
    const stream = config.stream ?? false;
    const temperature = config.temperature ?? 0.7;
    const maxTokens = config.maxTokens ?? 4096;
    const systemPrompt = config.systemPrompt ?? DEFAULT_SYSTEM_PROMPTS[config.provider] ?? "";

    const apiKey = resolveApiKey(config);
    if (!apiKey) {
      throw new Error(
        `No API key found for provider "${config.provider}". ` +
        `Set the ${config.provider.toUpperCase()}_API_KEY environment variable, ` +
        `or pass apiKey in PlaygroundConfig.`,
      );
    }

    const endpoint = resolveEndpoint(config);
    const body = buildRequestBody(config.provider, config.model, message, systemPrompt, temperature, maxTokens, stream);

    // Make the API call
    const response = await callApi(endpoint, apiKey, body, stream);
    const latencyMs = performance.now() - startTime;

    // Parse token usage
    const tokensInput = response.usage?.input_tokens ?? response.usage?.prompt_tokens ?? estimateInputTokens(systemPrompt, message);
    const tokensOutput = response.usage?.output_tokens ?? response.usage?.completion_tokens ?? estimateOutputTokens(response.content);

    // Estimate cost
    const costUsd = computeCost(config.provider, config.model, tokensInput, tokensOutput);

    return {
      output: response.content,
      model: config.model,
      provider: config.provider,
      latencyMs: Math.round(latencyMs),
      tokensUsed: { input: tokensInput, output: tokensOutput },
      costUsd,
      streamed: stream,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List available models for the playground dropdown.
   */
  async listAvailableModels(): Promise<Array<{ model: string; provider: string }>> {
    const models: Array<{ model: string; provider: string }> = [];

    // OpenAI models (detected by API key presence)
    if (process.env.OPENAI_API_KEY) {
      models.push(
        { model: "gpt-4o", provider: "openai" },
        { model: "gpt-4o-mini", provider: "openai" },
        { model: "gpt-4-turbo", provider: "openai" },
        { model: "gpt-3.5-turbo", provider: "openai" },
      );
    }

    // Anthropic models
    if (process.env.ANTHROPIC_API_KEY) {
      models.push(
        { model: "claude-sonnet-4-20250514", provider: "anthropic" },
        { model: "claude-haiku-3-5-20241022", provider: "anthropic" },
        { model: "claude-opus-4-20250514", provider: "anthropic" },
      );
    }

    // OpenRouter models (always available — key optional)
    models.push(
      { model: "openai/gpt-4o", provider: "openrouter" },
      { model: "anthropic/claude-sonnet-4", provider: "openrouter" },
      { model: "google/gemini-2.5-flash", provider: "openrouter" },
      { model: "deepseek/deepseek-chat", provider: "openrouter" },
    );

    // DeepSeek models
    if (process.env.DEEPSEEK_API_KEY) {
      models.push(
        { model: "deepseek-chat", provider: "deepseek" },
        { model: "deepseek-v4-flash", provider: "deepseek" },
      );
    }

    return models;
  }
}

// ── API helpers ──

/** Resolve the API key for a provider */
function resolveApiKey(config: PlaygroundConfig): string | undefined {
  if (config.apiKey) return config.apiKey;

  const envMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    google: "GOOGLE_API_KEY",
    gemini: "GOOGLE_API_KEY",
    custom: "CUSTOM_API_KEY",
  };

  const envVar = envMap[config.provider];
  if (envVar) {
    const key = process.env[envVar];
    if (key) return key;
  }

  // Fallback: OPENROUTER_API_KEY or OPENAI_API_KEY can serve OpenRouter
  if (config.provider === "openrouter") {
    return process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  }

  return undefined;
}

/** Resolve the API endpoint URL */
function resolveEndpoint(config: PlaygroundConfig): string {
  if (config.baseUrl) return config.baseUrl;

  const endpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    anthropic: "https://api.anthropic.com/v1/messages",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    google: "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent",
    gemini: "https://generativelanguage.googleapis.com/v1/models/{model}:generateContent",
  };

  const endpoint = endpoints[config.provider] ?? "https://api.openai.com/v1/chat/completions";
  // Replace {model} placeholder for providers that embed it in the URL
  return (endpoint as string).replace("{model}", config.model);
}

/** Build the request body based on provider API format */
function buildRequestBody(
  provider: string,
  model: string,
  message: string,
  systemPrompt: string,
  temperature: number,
  maxTokens: number,
  stream: boolean,
): unknown {
  if (provider === "anthropic") {
    return {
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: message }],
      max_tokens: maxTokens,
      temperature,
    };
  }

  if (provider === "google" || provider === "gemini") {
    return {
      contents: [
        ...(systemPrompt
          ? [{ role: "user", parts: [{ text: `System: ${systemPrompt}\n\nUser: ${message}` }] }]
          : [{ role: "user", parts: [{ text: message }] }]),
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
  }

  // OpenAI-compatible format (openai, openrouter, deepseek, custom)
  return {
    model,
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      { role: "user", content: message },
    ],
    temperature,
    max_tokens: maxTokens,
    stream,
  };
}

/** Result from the API call */
interface ApiResult {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
  };
}

/** Make the HTTP API call with optional streaming */
async function callApi(endpoint: string, apiKey: string, body: unknown, stream: boolean): Promise<ApiResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // Anthropic uses x-api-key instead of Bearer
  if (endpoint.includes("anthropic")) {
    delete headers.Authorization;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  // OpenRouter needs additional headers
  if (endpoint.includes("openrouter")) {
    headers["HTTP-Referer"] = "agent-workbench";
    headers["X-Title"] = "agent-workbench playground";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `API call failed (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }

  if (stream) {
    return parseStreamResponse(response);
  }

  const data = await response.json() as Record<string, unknown>;

  // Handle Google's Gemini response format
  if (
    data.candidates &&
    Array.isArray(data.candidates) &&
    (data.candidates as unknown[]).length > 0
  ) {
    const candidate = (data.candidates as Array<Record<string, unknown>>)[0] ?? {};
    const content = (candidate.content ?? {}) as Record<string, unknown>;
    const parts = (content.parts ?? []) as Array<Record<string, unknown>>;
    const text = parts.map((p) => p.text as string).join("") ?? "";
    const usageData = data.usageMetadata as Record<string, number> | undefined;
    return {
      content: text,
      usage: {
        input_tokens: usageData?.promptTokenCount ?? 0,
        output_tokens: usageData?.candidatesTokenCount ?? 0,
        prompt_tokens: usageData?.promptTokenCount ?? 0,
        completion_tokens: usageData?.candidatesTokenCount ?? 0,
      },
    };
  }

  // Handle OpenAI-compatible response format
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const contentObj = choices?.[0]?.message as Record<string, unknown> | undefined;
  const text = (contentObj?.content as string) ?? "No response";
  const usageObj = (data.usage ?? {}) as Record<string, number>;

  return {
    content: text,
    usage: {
      input_tokens: usageObj.prompt_tokens ?? 0,
      output_tokens: usageObj.completion_tokens ?? 0,
      prompt_tokens: usageObj.prompt_tokens ?? 0,
      completion_tokens: usageObj.completion_tokens ?? 0,
    },
  };
}

/** Parse a streaming SSE response */
async function parseStreamResponse(response: Response): Promise<ApiResult> {
  const noUsage = {
    input_tokens: 0,
    output_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
  };

  if (!response.body) {
    return { content: "No streaming response body", usage: noUsage };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let streamUsage: ApiResult["usage"] = { ...noUsage };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const dataStr = line.slice(6).trim();
      if (dataStr === "[DONE]") continue;

      try {
        const data = JSON.parse(dataStr);
        const choices = data.choices as Array<Record<string, unknown>> | undefined;

        if (choices?.[0]) {
          const delta = choices[0].delta as Record<string, unknown> | undefined;
          const deltaContent = delta?.content as string | undefined;
          if (deltaContent) {
            fullContent += deltaContent;
          }
        }

        // Capture usage from final chunk
        if (data.usage) {
          streamUsage = (data.usage as unknown) as ApiResult["usage"];
        }
      } catch {
        // Skip malformed JSON in SSE stream
      }
    }
  }

  return { content: fullContent, usage: streamUsage };
}

// ── Token estimation helpers ──

/** Estimate input tokens from text length (~4 chars/token) */
function estimateInputTokens(systemPrompt: string, message: string): number {
  return Math.ceil((systemPrompt.length + message.length) / 4);
}

/** Estimate output tokens from response length */
function estimateOutputTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

/** Estimate cost based on provider pricing */
function computeCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Try exact model match, then provider match, then GPT-4o fallback
  const pricing =
    PROVIDER_PRICING[model] ??
    PROVIDER_PRICING[provider] ??
    { input: 0.0025, output: 0.01 }; // GPT-4o default pricing

  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}
