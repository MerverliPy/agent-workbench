import type { InferRouteResponse } from "@agent-workbench/protocol";
import { DashboardRoute } from "@agent-workbench/protocol";
import type { HttpTransport } from "../transport/http";

export class ObservabilityResource {
  constructor(private transport: HttpTransport) {}

  async getDashboard(
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof DashboardRoute>> {
    return this.transport.request(
      DashboardRoute.method,
      DashboardRoute.path,
      { responseSchema: DashboardRoute.response },
      signal,
    );
  }
}
