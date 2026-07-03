import type { AgentDefinition, AgentListItem } from "@agent-workbench/protocol";
import { GetAgentRoute, ListAgentsRoute } from "@agent-workbench/protocol";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

export function registerAgentRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { agentRegistry } = services;

  app.get(
    ListAgentsRoute.path,
    createJsonRouteHandler(ListAgentsRoute, () => {
      const profiles = agentRegistry.list();
      const items: AgentListItem[] = profiles.map((p) => ({
        id: p.id,
        name: p.name,
        mode: p.mode,
        description: p.description,
        capabilities: p.capabilities,
        toolCount: p.capabilities.length,
        promptVersion: p.promptVersion,
      }));
      return items;
    }),
  );

  app.get(
    GetAgentRoute.path,
    createJsonRouteHandler(GetAgentRoute, (_ctx, { validated }) => {
      const { agentId } = validated.pathParams as { agentId: string };
      const profile = agentRegistry.get(agentId);
      if (profile === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Agent not found: ${agentId}`,
          recoverable: true,
        });
      }
      const def: AgentDefinition = {
        id: profile.id,
        name: profile.name,
        mode: profile.mode,
        description: profile.description,
        capabilities: profile.capabilities,
        permissionProfile: profile.permissionProfile,
        promptVersion: profile.promptVersion,
      };
      return def;
    }),
  );
}
