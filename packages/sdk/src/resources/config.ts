import type { z } from "zod/v4";
import type { HttpTransport } from "../transport/http";
import {
  GetConfigRoute,
  GetEffectiveConfigRoute,
  ValidateConfigRoute,
} from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

export class ConfigResource {
  constructor(private transport: HttpTransport) {}

  async get(signal?: AbortSignal): Promise<InferRouteResponse<typeof GetConfigRoute>> {
    return this.transport.request(GetConfigRoute.method, GetConfigRoute.path, { responseSchema: GetConfigRoute.response }, signal);
  }

  async getEffective(signal?: AbortSignal): Promise<InferRouteResponse<typeof GetEffectiveConfigRoute>> {
    return this.transport.request(GetEffectiveConfigRoute.method, GetEffectiveConfigRoute.path, { responseSchema: GetEffectiveConfigRoute.response }, signal);
  }

  async validate(config: z.infer<typeof ValidateConfigRoute.body>, signal?: AbortSignal): Promise<InferRouteResponse<typeof ValidateConfigRoute>> {
    return this.transport.request(
      ValidateConfigRoute.method,
      ValidateConfigRoute.path,
      { body: config, responseSchema: ValidateConfigRoute.response },
      signal,
    );
  }
}
