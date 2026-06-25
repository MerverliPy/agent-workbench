import type { HttpTransport } from "../transport/http";
import {
  ListProvidersRoute,
  GetProviderRoute,
  ListProviderModelsRoute,
} from "@agent-workbench/protocol";
import type { ModelProvider, Model } from "@agent-workbench/protocol";

export class ProviderResource {
  constructor(private transport: HttpTransport) {}

  async list(signal?: AbortSignal): Promise<{ items: ModelProvider[] }> {
    return this.transport.request(ListProvidersRoute.method, ListProvidersRoute.path, undefined, signal);
  }

  async get(providerId: string, signal?: AbortSignal): Promise<ModelProvider> {
    return this.transport.request<ModelProvider>(
      GetProviderRoute.method,
      GetProviderRoute.path.replace(":providerId", providerId),
      undefined,
      signal,
    );
  }

  async listModels(providerId: string, signal?: AbortSignal): Promise<{ items: Model[] }> {
    return this.transport.request(
      ListProviderModelsRoute.method,
      ListProviderModelsRoute.path.replace(":providerId", providerId),
      undefined,
      signal,
    );
  }
}
