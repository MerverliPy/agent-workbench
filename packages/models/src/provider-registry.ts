import type { ModelProvider, ModelRequest, ModelResponse } from "./types";
import { StubModelProvider } from "./stub-provider";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { AnthropicProvider } from "./providers/anthropic";
import { createOpenRouterProvider, createOllamaProvider } from "./providers/openrouter";
import { parseProviderConfig, detectAvailableProviders } from "./provider-config";
import { ProviderConfigError } from "./errors";

export interface ProviderEntry {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  description: string;
  modelId: string;
  modelName: string;
  capabilities: string[];
  contextLimit?: number;
}

export interface ProviderModelEntry {
  id: string;
  providerId: string;
  name: string;
  capabilities: string[];
  contextLimit?: number;
  streaming?: boolean;
}

const STUB_PROVIDER_ID = "stub";
const MODEL_CAPABILITIES = ["text", "tool_calls", "streaming"];

export class ProviderRegistry {
  private readonly providerMap: Map<string, ModelProvider> = new Map();
  private readonly metaMap: Map<string, ProviderEntry> = new Map();
  private readonly fallbackChain: string[] = [];
  private defaultProviderId: string;

  constructor(options?: {
    defaultProvider?: ModelProvider;
    fetchImpl?: typeof fetch;
  }) {
    // 1. Stub provider (always available)
    this.registerStubProvider(options?.defaultProvider);

    // 2. Explicit provider from AGENT_WORKBENCH_PROVIDER
    const explicitResult = this.tryRegisterExplicitProvider(options?.fetchImpl);

    // 3. Auto-detect providers with API keys set
    if (explicitResult === "none") {
      this.tryRegisterAutoDetectedProviders(options?.fetchImpl);
    }

    // 4. Custom provider override
    if (options?.defaultProvider !== undefined) {
      this.registerCustomProvider(options.defaultProvider);
    }

    // 5. Determine default: explicit > explicit-error > auto-detected first > stub
    if (explicitResult === "registered") {
      this.defaultProviderId = this.fallbackChain[0] ?? STUB_PROVIDER_ID;
    } else if (explicitResult === "error") {
      // The explicitly requested provider was misconfigured; keep it as
      // default so callers get a ProviderConfigError instead of silently
      // falling through to stub.
      let requestedProvider =
        process.env.AGENT_WORKBENCH_PROVIDER?.trim()?.toLowerCase() ?? "";
      if (requestedProvider === "openai-compatible") {
        requestedProvider = "openai";
      }
      this.defaultProviderId = requestedProvider;
    } else if (this.fallbackChain.length > 0) {
      this.defaultProviderId = this.fallbackChain[0]!;
    } else {
      this.defaultProviderId = STUB_PROVIDER_ID;
    }
  }

  // ── Registration methods ────────────────────────────────────────────

  private registerStubProvider(override?: ModelProvider): void {
    const provider = override ?? new StubModelProvider({
      textResponse: "Hello! I am the agent-workbench stub assistant.",
    });
    this.providerMap.set(STUB_PROVIDER_ID, provider);
    this.metaMap.set(STUB_PROVIDER_ID, {
      id: STUB_PROVIDER_ID,
      name: "Stub Provider",
      status: "connected",
      description: "Deterministic stub provider for testing and development",
      modelId: "stub-model",
      modelName: "Stub Model",
      capabilities: ["text", "tool_calls"],
    });
  }

  private registerCustomProvider(provider: ModelProvider): void {
    const id = "custom";
    this.providerMap.set(id, provider);
    this.metaMap.set(id, {
      id,
      name: "Custom Provider",
      status: "connected",
      description: "User-supplied provider instance",
      modelId: "custom-model",
      modelName: "Custom Model",
      capabilities: MODEL_CAPABILITIES,
    });
  }

  private tryRegisterExplicitProvider(
    fetchImpl?: typeof fetch,
  ): "registered" | "error" | "none" {
    let config;
    try {
      config = parseProviderConfig();
    } catch {
      // If AGENT_WORKBENCH_PROVIDER is explicitly set but config failed
      // (e.g., missing API key), register an error provider so the
      // registry reflects the misconfiguration and throws the right error.
      const requestedProvider = process.env.AGENT_WORKBENCH_PROVIDER?.trim();
      if (requestedProvider && requestedProvider.length > 0) {
        // Normalize "openai-compatible" → "openai" for storage key
        let providerId = requestedProvider.toLowerCase();
        providerId = providerId === "openai-compatible" ? "openai" : providerId;
        this.registerErrorMeta(providerId, "API key not set");
        this.providerMap.set(
          providerId,
          createConfigErrorProvider(
            `Provider "${requestedProvider}" is misconfigured: the API key is not set. ` +
              "Unset AGENT_WORKBENCH_PROVIDER to use the stub provider.",
          ),
        );
        return "error";
      }
      return "none";
    }

    return this.registerProviderFromConfig(config, true, fetchImpl);
  }

  private tryRegisterAutoDetectedProviders(fetchImpl?: typeof fetch): void {
    const available = detectAvailableProviders();
    for (const providerId of available) {
      try {
        const config = parseProviderConfig({
          ...process.env,
          AGENT_WORKBENCH_PROVIDER: providerId,
        } as typeof process.env);
        this.registerProviderFromConfig(config, false, fetchImpl);
      } catch {
        // Skip providers that fail to configure
      }
    }
  }

  private registerProviderFromConfig(
    config: ReturnType<typeof parseProviderConfig>,
    isExplicit: boolean,
    fetchImpl?: typeof fetch,
  ): "registered" | "error" {
    const providerId = config.provider.toLowerCase();

    // Check API key (except Ollama)
    if (providerId !== "ollama" && config.apiKey.length === 0) {
      if (isExplicit) {
        this.registerErrorMeta(providerId, "API key not set");
        return "error";
      }
      return "error";
    }

    try {
      switch (providerId) {
        case "openai":
        case "openai-compatible":
          return this.registerOpenAI(config, fetchImpl);
        case "anthropic":
          return this.registerAnthropic(config, fetchImpl);
        case "openrouter":
          return this.registerOpenRouter(config, fetchImpl);
        case "ollama":
          return this.registerOllama(config, fetchImpl);
        default:
          if (isExplicit) {
            this.registerErrorMeta(providerId, `Unknown provider: ${providerId}`);
          }
          return "error";
      }
    } catch (err) {
      if (isExplicit) {
        const msg = err instanceof Error ? err.message : "Configuration error";
        this.registerErrorMeta(providerId, msg);
      }
      return "error";
    }
  }

  private registerOpenAI(
    config: ReturnType<typeof parseProviderConfig>,
    fetchImpl?: typeof fetch,
  ): "registered" {
    return this.addProvider(
      "openai",
      new OpenAICompatibleProvider(config, fetchImpl),
      {
        name: "OpenAI Compatible",
        description: `OpenAI-compatible provider (model: ${config.model})`,
        modelId: config.model,
        modelName: config.model,
        contextLimit: 128000,
      },
    );
  }

  private registerAnthropic(
    config: ReturnType<typeof parseProviderConfig>,
    fetchImpl?: typeof fetch,
  ): "registered" {
    const modelName = config.model.startsWith("claude-")
      ? config.model
      : `claude-sonnet-4-20250514`;

    return this.addProvider(
      "anthropic",
      new AnthropicProvider({ ...config, model: modelName }, fetchImpl),
      {
        name: "Anthropic",
        description: `Anthropic provider (model: ${modelName})`,
        modelId: modelName,
        modelName,
        contextLimit: 200000,
      },
    );
  }

  private registerOpenRouter(
    config: ReturnType<typeof parseProviderConfig>,
    fetchImpl?: typeof fetch,
  ): "registered" {
    const provider = createOpenRouterProvider(config, fetchImpl);
    return this.addProvider("openrouter", provider, {
      name: "OpenRouter",
      description: `OpenRouter multi-provider (model: ${config.model})`,
      modelId: config.model,
      modelName: config.model,
      contextLimit: 128000,
    });
  }

  private registerOllama(
    config: ReturnType<typeof parseProviderConfig>,
    fetchImpl?: typeof fetch,
  ): "registered" {
    const provider = createOllamaProvider(config, fetchImpl);
    return this.addProvider("ollama", provider, {
      name: "Ollama",
      description: `Local Ollama provider (model: ${config.model})`,
      modelId: config.model,
      modelName: config.model,
      contextLimit: 128000,
    });
  }

  private addProvider(
    id: string,
    provider: ModelProvider,
    meta: Omit<ProviderEntry, "id" | "status" | "capabilities">,
  ): "registered" {
    this.providerMap.set(id, provider);
    this.metaMap.set(id, {
      id,
      status: "connected",
      capabilities: MODEL_CAPABILITIES,
      ...meta,
    });
    this.fallbackChain.push(id);
    return "registered";
  }

  private registerErrorMeta(providerId: string, reason: string): void {
    const names: Record<string, string> = {
      openai: "OpenAI Compatible",
      anthropic: "Anthropic",
      openrouter: "OpenRouter",
      ollama: "Ollama",
    };
    this.metaMap.set(providerId, {
      id: providerId,
      name: names[providerId] ?? providerId,
      status: "error",
      description: reason,
      modelId: "",
      modelName: "",
      capabilities: [],
    });
  }

  // ── Query methods ────────────────────────────────────────────────────

  getDefaultProvider(): ModelProvider {
    const provider = this.providerMap.get(this.defaultProviderId);
    if (provider === undefined) {
      return this.providerMap.get(STUB_PROVIDER_ID)!;
    }
    return provider;
  }

  /**
   * Get the provider with fallback.
   * If the primary provider errors, try the next in the fallback chain.
   */
  async callWithFallback(
    request: ModelRequest,
  ): Promise<ModelResponse> {
    const allIds = [this.defaultProviderId, ...this.fallbackChain];

    let lastError: Error | undefined;

    for (const id of allIds) {
      const provider = this.providerMap.get(id);
      if (!provider) continue;

      try {
        return await provider.call(request);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continue to next fallback
      }
    }

    throw lastError ?? new ProviderConfigError("No providers available");
  }

  getProvider(id: string): ModelProvider | undefined {
    return this.providerMap.get(id);
  }

  getMetadata(id: string): ProviderEntry | undefined {
    return this.metaMap.get(id);
  }

  listMetadata(): ProviderEntry[] {
    return Array.from(this.metaMap.values());
  }

  listModels(providerId: string): ProviderModelEntry[] {
    const meta = this.metaMap.get(providerId);
    if (meta === undefined) return [];
    const provider = this.providerMap.get(providerId);
    const supportsStream =
      provider !== undefined &&
      "stream" in provider &&
      typeof provider.stream === "function";
    return [
      {
        id: meta.modelId,
        providerId: meta.id,
        name: meta.modelName,
        capabilities: meta.capabilities,
        streaming: supportsStream,
        ...(meta.contextLimit !== undefined
          ? { contextLimit: meta.contextLimit }
          : {}),
      },
    ];
  }

  /**
   * Get the ordered fallback chain (excluding the default provider if
   * it's first). Useful for checking available alternatives.
   */
  getFallbackChain(): string[] {
    return this.fallbackChain;
  }
}

/**
 * Creates a ModelProvider that always throws ProviderConfigError.
 * Used when a provider was explicitly requested but misconfigured,
 * so the caller gets a clear config error instead of a cryptic
 * network or runtime failure.
 */
function createConfigErrorProvider(message: string): ModelProvider {
  return {
    call: async () => {
      throw new ProviderConfigError(message);
    },
    stream: async function* () {
      throw new ProviderConfigError(message);
    },
  };
}
