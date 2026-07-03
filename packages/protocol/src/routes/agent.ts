import { z } from "zod/v4";
import { AgentDefinition, AgentId, AgentListItem } from "../schemas/agent";
import { ErrorEnvelope } from "../schemas/error-envelope";

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
