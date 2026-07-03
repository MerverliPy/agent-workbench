import type { AgentId } from "@agent-workbench/protocol";

export interface AgentProfile {
  id: AgentId;
  name: string;
  mode: "build" | "plan";
  description: string;
  capabilities: string[];
  systemPrompt: string;
  permissionProfile: Array<{
    toolName: string;
    outcome: "allow" | "ask" | "deny";
  }>;
  defaultModel?: string;
  tokenBudget?: number;
  promptVersion: string;
}
