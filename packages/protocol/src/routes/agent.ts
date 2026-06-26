import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { AgentDefinition, AgentListItem, AgentId } from "../schemas/agent";

export const ListAgentsRoute = {
  method: "GET" as const,
  path: "/agent",
  response: z.array(AgentListItem),
  errors: [ErrorEnvelope],
} as const;

export const AgentIdParams = z.object({
  agentId: AgentId,
});

export const GetAgentRoute = {
  method: "GET" as const,
  path: "/agent/:agentId",
  pathParams: AgentIdParams,
  response: AgentDefinition,
  errors: [ErrorEnvelope],
} as const;
