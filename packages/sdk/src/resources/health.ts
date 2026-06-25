import type { HttpTransport } from "../transport/http";
import { HealthRoute } from "@agent-workbench/protocol";
import type { HealthResponse } from "@agent-workbench/protocol";

export class HealthResource {
  constructor(private transport: HttpTransport) {}

  async check(signal?: AbortSignal): Promise<HealthResponse> {
    return this.transport.request<HealthResponse>(
      HealthRoute.method,
      HealthRoute.path,
      undefined,
      signal,
    );
  }
}
