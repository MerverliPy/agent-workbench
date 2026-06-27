import { ProviderConfigError } from "./errors";

export interface ProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export function parseProviderConfig(env?: typeof process.env): ProviderConfig {
  const e = env ?? process.env;
  const provider = e.AGENT_WORKBENCH_PROVIDER?.trim() || null;
  const model = e.AGENT_WORKBENCH_MODEL?.trim() || null;
  const apiKey = e.OPENAI_API_KEY?.trim() || null;
  const baseUrl = e.OPENAI_BASE_URL?.trim() || null;

  if (provider === null || provider.length === 0) {
    throw new ProviderConfigError(
      "AGENT_WORKBENCH_PROVIDER is not set. Set it to a provider id (e.g. 'openai') or leave it unset to use the stub provider."
    );
  }

  if (apiKey === null || apiKey.length === 0) {
    throw new ProviderConfigError(
      `Provider "${provider}" requires OPENAI_API_KEY to be set.`
    );
  }

  const resolvedModel = model ?? "gpt-4o";
  const result: ProviderConfig = {
    provider,
    model: resolvedModel,
    apiKey,
  };
  if (baseUrl !== null && baseUrl.length > 0) {
    result.baseUrl = baseUrl;
  }
  return result;
}
