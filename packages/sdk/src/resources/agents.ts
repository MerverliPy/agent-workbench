import type { InferRouteResponse } from "@agent-workbench/protocol";
import { GetAgentRoute, ListAgentsRoute } from "@agent-workbench/protocol";
import type { HttpTransport } from "../transport/http";

export class AgentResource {
  constructor(private transport: HttpTransport) {}

  async list(
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof ListAgentsRoute>> {
    return this.transport.request(
      ListAgentsRoute.method,
      ListAgentsRoute.path,
      { responseSchema: ListAgentsRoute.response },
      signal,
    );
  }

  async get(
    agentId: string,
    signal?: AbortSignal,
  ): Promise<InferRouteResponse<typeof GetAgentRoute>> {
    return this.transport.request(
      GetAgentRoute.method,
      GetAgentRoute.path.replace(":agentId", agentId),
      { responseSchema: GetAgentRoute.response },
      signal,
    );
  }
}
