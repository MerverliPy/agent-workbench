import type { InferRouteResponse } from "@agent-workbench/protocol";
import { GlobalInfoRoute, HealthRoute } from "@agent-workbench/protocol";
import type { HttpTransport } from "../transport/http";

export class HealthResource {
  constructor(private transport: HttpTransport) {}

  async check(
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof HealthRoute>> {
    return this.transport.request(
      HealthRoute.method,
      HealthRoute.path,
      { responseSchema: HealthRoute.response },
      signal,
    );
  }

  async getInfo(
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GlobalInfoRoute>> {
    return this.transport.request(
      GlobalInfoRoute.method,
      GlobalInfoRoute.path,
      { responseSchema: GlobalInfoRoute.response },
      signal,
    );
  }
}
