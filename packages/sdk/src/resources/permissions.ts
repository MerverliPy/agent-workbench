import type { HttpTransport } from "../transport/http";
import {
  ListPermissionRequestsRoute,
  GetPermissionRequestRoute,
  DecidePermissionRoute,
  GetEffectivePolicyRoute,
} from "@agent-workbench/protocol";
import type {
  PermissionRequest,
  PermissionDecision,
  SubmitDecisionRequest,
} from "@agent-workbench/protocol";

function toParams(record: Record<string, unknown>): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = value === undefined ? undefined : String(value);
  }
  return out;
}

export class PermissionResource {
  constructor(private transport: HttpTransport) {}

  async listRequests(params?: { status?: string }, signal?: AbortSignal): Promise<{ items: PermissionRequest[] }> {
    return this.transport.request(
      ListPermissionRequestsRoute.method,
      ListPermissionRequestsRoute.path,
      params ? { params: toParams(params as Record<string, unknown>) } : undefined,
      signal,
    );
  }

  async getRequest(requestId: string, signal?: AbortSignal): Promise<PermissionRequest> {
    return this.transport.request<PermissionRequest>(
      GetPermissionRequestRoute.method,
      GetPermissionRequestRoute.path.replace(":requestId", requestId),
      undefined,
      signal,
    );
  }

  async decide(requestId: string, data: SubmitDecisionRequest, signal?: AbortSignal): Promise<PermissionDecision> {
    return this.transport.request<PermissionDecision>(
      DecidePermissionRoute.method,
      DecidePermissionRoute.path.replace(":requestId", requestId),
      { body: data },
      signal,
    );
  }

  async getEffectivePolicy(signal?: AbortSignal): Promise<{ policy: Record<string, unknown> }> {
    return this.transport.request(
      GetEffectivePolicyRoute.method,
      GetEffectivePolicyRoute.path,
      undefined,
      signal,
    );
  }
}
