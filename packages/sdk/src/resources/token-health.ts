import type { HttpTransport } from "../transport/http";
import { GetTokenHealthRoute } from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

export class TokenHealthResource {
  constructor(private readonly transport: HttpTransport) {}

  async get(
    sessionId: string,
    signal?: AbortSignal
  ): Promise<InferRouteResponse<typeof GetTokenHealthRoute>> {
    const path = GetTokenHealthRoute.path.replace(":sessionId", sessionId);
    return this.transport.request(
      GetTokenHealthRoute.method,
      path,
      { responseSchema: GetTokenHealthRoute.response },
      signal
    );
  }
}
