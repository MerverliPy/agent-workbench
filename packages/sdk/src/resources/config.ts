import type { HttpTransport } from "../transport/http";
import {
  GetConfigRoute,
  GetEffectiveConfigRoute,
  ValidateConfigRoute,
} from "@agent-workbench/protocol";
import type { Config } from "@agent-workbench/protocol";

export class ConfigResource {
  constructor(private transport: HttpTransport) {}

  async get(signal?: AbortSignal): Promise<Config> {
    return this.transport.request<Config>(GetConfigRoute.method, GetConfigRoute.path, undefined, signal);
  }

  async getEffective(signal?: AbortSignal): Promise<Config> {
    return this.transport.request<Config>(GetEffectiveConfigRoute.method, GetEffectiveConfigRoute.path, undefined, signal);
  }

  async validate(config: Config, signal?: AbortSignal): Promise<{ valid: boolean; errors?: string[] }> {
    return this.transport.request(
      ValidateConfigRoute.method,
      ValidateConfigRoute.path,
      { body: config },
      signal,
    );
  }
}
