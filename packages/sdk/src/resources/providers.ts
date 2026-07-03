import type { InferRouteResponse } from "@agent-workbench/protocol";
import {
  GetProviderRoute,
  ListProviderModelsRoute,
  ListProvidersRoute,
} from "@agent-workbench/protocol";
import type { HttpTransport } from "../transport/http";

export class ProviderResource {
  constructor(private transport: HttpTransport) {}

  async list(
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof ListProvidersRoute>> {
    return this.transport.request(
      ListProvidersRoute.method,
      ListProvidersRoute.path,
      { responseSchema: ListProvidersRoute.response },
      signal,
    );
  }

  async get(
    providerId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GetProviderRoute>> {
    return this.transport.request(
      GetProviderRoute.method,
      GetProviderRoute.path.replace(":providerId", providerId),
      { responseSchema: GetProviderRoute.response },
      signal,
    );
  }

  async listModels(
    providerId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof ListProviderModelsRoute>> {
    return this.transport.request(
      ListProviderModelsRoute.method,
      ListProviderModelsRoute.path.replace(":providerId", providerId),
      { responseSchema: ListProviderModelsRoute.response },
      signal,
    );
  }
}
