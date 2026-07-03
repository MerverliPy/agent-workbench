import type { AgentId } from "@agent-workbench/protocol";
import { ALL_AGENTS } from "./definitions";
import type { AgentProfile } from "./types";

export class AgentRegistry {
  get(id: string): AgentProfile | undefined {
    return ALL_AGENTS.get(id as AgentId);
  }

  list(): AgentProfile[] {
    return Array.from(ALL_AGENTS.values());
  }

  resolveActiveAgent(
    sessionActiveAgent: string | null | undefined,
  ): AgentProfile {
    if (sessionActiveAgent === "build" || sessionActiveAgent === "plan") {
      const profile = ALL_AGENTS.get(sessionActiveAgent);
      if (profile !== undefined) {
        return profile;
      }
    }
    return ALL_AGENTS.get("build")!;
  }

  isToolAvailable(agentId: string, toolName: string): boolean {
    const profile = this.get(agentId);
    if (profile === undefined) return false;
    return profile.capabilities.includes(toolName);
  }

  getSystemPrompt(agentId: string): string | undefined {
    return this.get(agentId)?.systemPrompt;
  }
}
