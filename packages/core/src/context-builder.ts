import type { MessageRepository } from "@agent-workbench/storage";
import type { ContextMessage } from "./types";

/**
 * Builds a provider-neutral message list for a model call by reading the
 * persisted message history for a session.
 *
 * Phase 6 implementation: reads all messages for the session in chronological
 * order and maps each storage role to a ContextMessage role.
 *
 * Phase 11: accepts an optional agentSystemPrompt that is prepended when
 * no explicit systemPrompt override is provided.
 *
 * Future phases will enrich this with:
 *  - session summaries (Phase 12 token health)
 *  - token-budget trimming (Phase 12)
 */
export class ContextBuilder {
  constructor(private readonly messageRepository: MessageRepository) {}

  /**
   * Build the full context array for a model call.
   *
   * @param sessionId  Session whose history to load.
   * @param systemPrompt  Optional override system prompt. When omitted and
   *   agentSystemPrompt is provided, the agent system prompt is used.
   * @param excludeRunId  When provided, messages belonging to the current
   *   in-flight run are excluded.
   * @param agentSystemPrompt  Phase 11: system prompt from the active agent
   *   definition. Used when no explicit systemPrompt override is given.
   */
  async build(
    sessionId: string,
    systemPrompt?: string,
    excludeRunId?: string,
    agentSystemPrompt?: string
  ): Promise<ContextMessage[]> {
    const rows = this.messageRepository.listBySession(sessionId);

    const messages: ContextMessage[] = [];

    const effectivePrompt =
      systemPrompt !== undefined && systemPrompt.length > 0
        ? systemPrompt
        : agentSystemPrompt !== undefined && agentSystemPrompt.length > 0
          ? agentSystemPrompt
          : undefined;

    if (effectivePrompt !== undefined && effectivePrompt.length > 0) {
      messages.push({ role: "system", content: effectivePrompt });
    }

    for (const row of rows) {
      // Exclude the current run's messages (not yet part of the model history).
      if (excludeRunId !== undefined && row.runId === excludeRunId) {
        continue;
      }

      const role = this.mapRole(row.role);
      if (role === null) {
        // Skip roles the model does not understand (e.g. "summary").
        continue;
      }

      const msg: ContextMessage = { role, content: row.content };

      // Preserve toolCallId for tool-result messages if stored in metadata.
      if (role === "tool" && row.metadataJson !== null && row.metadataJson !== undefined) {
        try {
          const meta = JSON.parse(row.metadataJson) as Record<string, unknown>;
          if (typeof meta["toolCallId"] === "string") {
            msg.toolCallId = meta["toolCallId"];
          }
        } catch {
          // Ignore malformed metadata.
        }
      }

      messages.push(msg);
    }

    return messages;
  }

  private mapRole(
    storageRole: string
  ): ContextMessage["role"] | null {
    switch (storageRole) {
      case "user":
        return "user";
      case "assistant":
        return "assistant";
      case "system":
        return "system";
      case "tool":
        return "tool";
      default:
        return null;
    }
  }
}
