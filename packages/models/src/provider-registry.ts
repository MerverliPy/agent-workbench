import type { ModelProvider, ModelRequest, ModelResponse } from "./types";
import { StubModelProvider } from "./stub-provider";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { parseProviderConfig } from "./provider-config";
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
}

const STUB_PROVIDER_ID = "stub";

const STUB_MODEL_CAPABILITIES = ["text", "tool_calls"];

export class ProviderRegistry {
  private readonly providerMap: Map<string, ModelProvider> = new Map();
  private readonly metaMap: Map<string, ProviderEntry> = new Map();
  private readonly defaultProviderId: string;

  constructor(options?: {
    defaultProvider?: ModelProvider;
    fetchImpl?: typeof fetch;
  }) {
    this.registerStubProvider(options?.defaultProvider);

    const openAiResult = this.tryRegisterOpenAIProvider(options?.fetchImpl);

    if (options?.defaultProvider !== undefined) {
      const customId = "custom";
      this.providerMap.set(customId, options.defaultProvider);
      this.metaMap.set(customId, {
        id: customId,
        name: "Custom Provider",
        status: "connected",
        description: "User-supplied provider instance",
        modelId: "custom-model",
        modelName: "Custom Model",
        capabilities: STUB_MODEL_CAPABILITIES,
      });
    }

    if (openAiResult === "registered") {
      this.defaultProviderId = "openai";
    } else if (openAiResult === "error") {
      this.defaultProviderId = "openai";
      this.providerMap.set("openai", createConfigErrorProvider(
        "OpenAI provider misconfigured: OPENAI_API_KEY is not set. " +
        "Set OPENAI_API_KEY or unset AGENT_WORKBENCH_PROVIDER to use the stub."
      ));
    } else if (options?.defaultProvider !== undefined) {
      this.defaultProviderId = "custom";
    } else {
      this.defaultProviderId = STUB_PROVIDER_ID;
    }
  }

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
      capabilities: STUB_MODEL_CAPABILITIES,
    });
  }

  private tryRegisterOpenAIProvider(fetchImpl?: typeof fetch): "registered" | "skipped" | "error" {
    let config;
    try {
      config = parseProviderConfig();
    } catch {
      return "skipped";
    }

    if (config.provider !== "openai" && config.provider !== "openai-compatible") {
      return "skipped";
    }

    if (config.apiKey.length === 0) {
      this.metaMap.set("openai", {
        id: "openai",
        name: "OpenAI Compatible",
        status: "error",
        description: "OPENAI_API_KEY is not set",
        modelId: "",
        modelName: "",
        capabilities: [],
      });
      return "error";
    }

    const provider = new OpenAICompatibleProvider(config, fetchImpl);
    this.providerMap.set("openai", provider);
    this.metaMap.set("openai", {
      id: "openai",
      name: "OpenAI Compatible",
      status: "connected",
      description: `OpenAI-compatible provider (model: ${config.model})`,
      modelId: config.model,
      modelName: config.model,
      capabilities: STUB_MODEL_CAPABILITIES,
      contextLimit: 128000,
    });

    return "registered";
  }

  getDefaultProvider(): ModelProvider {
    const provider = this.providerMap.get(this.defaultProviderId);
    if (provider === undefined) {
      return this.providerMap.get(STUB_PROVIDER_ID)!;
    }
    return provider;
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
    return [{
      id: meta.modelId,
      providerId: meta.id,
      name: meta.modelName,
      capabilities: meta.capabilities,
      ...(meta.contextLimit !== undefined ? { contextLimit: meta.contextLimit } : {}),
    }];
  }
}

function createConfigErrorProvider(message: string): ModelProvider {
  return {
    async call(_request: ModelRequest): Promise<ModelResponse> {
      throw new ProviderConfigError(message);
    },
  };
}
