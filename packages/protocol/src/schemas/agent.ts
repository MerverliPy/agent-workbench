import { z } from "zod/v4";

export const AgentMode = z.enum(["build", "plan"]);
export type AgentMode = z.infer<typeof AgentMode>;

export const AgentId = z.enum(["build", "plan"]);
export type AgentId = z.infer<typeof AgentId>;

export const AgentPermissionEntry = z.object({
  toolName: z.string(),
  outcome: z.enum(["allow", "ask", "deny"]),
});

export const AgentDefinition = z.object({
  id: AgentId,
  name: z.string(),
  mode: AgentMode,
  description: z.string(),
  capabilities: z.array(z.string()),
  permissionProfile: z.array(AgentPermissionEntry),
  defaultModel: z.string().optional(),
  tokenBudget: z.number().int().positive().optional(),
  promptVersion: z.string(),
});
export type AgentDefinition = z.infer<typeof AgentDefinition>;

export const AgentListItem = z.object({
  id: AgentId,
  name: z.string(),
  mode: AgentMode,
  description: z.string(),
  capabilities: z.array(z.string()),
  toolCount: z.number().int().nonnegative(),
  promptVersion: z.string(),
});
export type AgentListItem = z.infer<typeof AgentListItem>;
