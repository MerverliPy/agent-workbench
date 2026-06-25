import type { HttpTransport } from "../transport/http";
import { ListToolsRoute, GetToolRoute } from "@agent-workbench/protocol";
import type { ToolDefinition } from "@agent-workbench/protocol";

export class ToolResource {
  constructor(private transport: HttpTransport) {}

  async list(signal?: AbortSignal): Promise<{ items: ToolDefinition[] }> {
    return this.transport.request(ListToolsRoute.method, ListToolsRoute.path, undefined, signal);
  }

  async get(toolName: string, signal?: AbortSignal): Promise<ToolDefinition> {
    return this.transport.request<ToolDefinition>(
      GetToolRoute.method,
      GetToolRoute.path.replace(":toolName", toolName),
      undefined,
      signal,
    );
  }
}
