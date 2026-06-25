import type { HttpTransport } from "../transport/http";
import { ListToolsRoute, GetToolRoute } from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

export class ToolResource {
  constructor(private transport: HttpTransport) {}

  async list(signal?: AbortSignal): Promise<InferRouteResponse<typeof ListToolsRoute>> {
    return this.transport.request(ListToolsRoute.method, ListToolsRoute.path, { responseSchema: ListToolsRoute.response }, signal);
  }

  async get(toolName: string, signal?: AbortSignal): Promise<InferRouteResponse<typeof GetToolRoute>> {
    return this.transport.request(
      GetToolRoute.method,
      GetToolRoute.path.replace(":toolName", toolName),
      { responseSchema: GetToolRoute.response },
      signal,
    );
  }
}
