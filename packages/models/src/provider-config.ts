import { ProviderConfigError } from "./errors";

export interface ProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

/**
 * All recognized provider IDs and their required env vars.
 * "openai-compatible" is an alias for "openai".
 */
const PROVIDER_ENV_MAP: Record<
  string,
  { keyVar: string; defaultModel: string; defaultBaseUrl?: string }
> = {
  openai: {
    keyVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  "openai-compatible": {
    keyVar: "OPENAI_API_KEY",
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    keyVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-20250514",
    defaultBaseUrl: "https://api.anthropic.com/v1",
  },
  openrouter: {
    keyVar: "OPENROUTER_API_KEY",
    defaultModel: "openai/gpt-4o",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  ollama: {
    keyVar: "__OLLAMA_NO_KEY__", // Ollama doesn't require an API key
    defaultModel: "llama3.2",
    defaultBaseUrl: "http://localhost:11434/v1",
  },
};

/**
 * Parse provider configuration from environment variables.
 *
 * Supports: openai, anthropic, openrouter, ollama.
 * Throws `ProviderConfigError` when AGENT_WORKBENCH_PROVIDER is missing,
 * or when a required API key is not set.
 */
export function parseProviderConfig(env?: typeof process.env): ProviderConfig {
  const e = env ?? process.env;
  const provider = e.AGENT_WORKBENCH_PROVIDER?.trim() || null;

  if (provider === null || provider.length === 0) {
    throw new ProviderConfigError(
      "AGENT_WORKBENCH_PROVIDER is not set. Set it to a provider id " +
        "(e.g. 'openai', 'anthropic', 'openrouter', 'ollama') or leave it " +
        "unset to use the stub provider.",
    );
  }

  const entry = PROVIDER_ENV_MAP[provider.toLowerCase()];
  if (entry === undefined) {
    throw new ProviderConfigError(
      `Unknown provider "${provider}". Supported: openai, anthropic, openrouter, ollama.`,
    );
  }

  // Ollama doesn't need an API key
  const apiKey =
    entry.keyVar === "__OLLAMA_NO_KEY__"
      ? ""
      : (e[entry.keyVar]?.trim() ?? null);

  if (
    apiKey === null ||
    (apiKey.length === 0 && entry.keyVar !== "__OLLAMA_NO_KEY__")
  ) {
    throw new ProviderConfigError(
      `Provider "${provider}" requires ${entry.keyVar} to be set.`,
    );
  }

  const model = e.AGENT_WORKBENCH_MODEL?.trim() || entry.defaultModel;
  const baseUrl =
    e.OPENAI_BASE_URL?.trim() ||
    e.ANTHROPIC_BASE_URL?.trim() ||
    e.OPENROUTER_BASE_URL?.trim() ||
    e.OLLAMA_BASE_URL?.trim() ||
    entry.defaultBaseUrl ||
    undefined;

  const result: ProviderConfig = {
    provider,
    model,
    apiKey,
  };
  if (baseUrl !== undefined) {
    result.baseUrl = baseUrl;
  }
  return result;
}

/**
 * Return the list of provider IDs that have their required API key
 * (or env vars) set. Useful for auto-detection when
 * AGENT_WORKBENCH_PROVIDER is not explicitly set.
 */
export function detectAvailableProviders(env?: typeof process.env): string[] {
  const e = env ?? process.env;
  const available: string[] = [];

  if ((e.OPENAI_API_KEY?.trim() ?? "").length > 0) {
    available.push("openai");
  }
  if ((e.ANTHROPIC_API_KEY?.trim() ?? "").length > 0) {
    available.push("anthropic");
  }
  if ((e.OPENROUTER_API_KEY?.trim() ?? "").length > 0) {
    available.push("openrouter");
  }

  // Only auto-register ollama when at least one API-key-based provider
  // is configured, so that a bare environment (no keys) falls back to
  // the stub provider instead of an unreachable ollama endpoint.
  if (available.length > 0) {
    available.push("ollama");
  }

  return available;
}
