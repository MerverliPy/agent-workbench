import type { InferRouteResponse } from "@agent-workbench/protocol";
import {
  DecidePermissionRoute,
  GetEffectivePolicyRoute,
  GetPermissionRequestRoute,
  ListPermissionRequestsRoute,
} from "@agent-workbench/protocol";
import type { z } from "zod/v4";
import type { HttpTransport } from "../transport/http";

function toParams(
  record: Record<string, unknown>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class PermissionResource {
  constructor(private transport: HttpTransport) {}

  async listRequests(
    params?: { status?: string },
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof ListPermissionRequestsRoute>> {
    return this.transport.request(
      ListPermissionRequestsRoute.method,
      ListPermissionRequestsRoute.path,
      params
        ? {
            params: toParams(params as Record<string, unknown>),
            responseSchema: ListPermissionRequestsRoute.response,
          }
        : { responseSchema: ListPermissionRequestsRoute.response },
      signal,
    );
  }

  async getRequest(
    requestId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GetPermissionRequestRoute>> {
    return this.transport.request(
      GetPermissionRequestRoute.method,
      GetPermissionRequestRoute.path.replace(":requestId", requestId),
      { responseSchema: GetPermissionRequestRoute.response },
      signal,
    );
  }

  async decide(
    requestId: string,
    data: z.infer<typeof DecidePermissionRoute.body>,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof DecidePermissionRoute>> {
    return this.transport.request(
      DecidePermissionRoute.method,
      DecidePermissionRoute.path.replace(":requestId", requestId),
      { body: data, responseSchema: DecidePermissionRoute.response },
      signal,
    );
  }

  async getEffectivePolicy(
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GetEffectivePolicyRoute>> {
    return this.transport.request(
      GetEffectivePolicyRoute.method,
      GetEffectivePolicyRoute.path,
      { responseSchema: GetEffectivePolicyRoute.response },
      signal,
    );
  }
}
