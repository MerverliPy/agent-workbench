import type { MessageRepository } from "@agent-workbench/storage";
import type { ContextMessage } from "./types";

/**
 * Builds a provider-neutral message list for a model call by reading the
 * persisted message history for a session.
 *
 * Phase 6 implementation: reads all messages for the session in chronological
 * order and maps each storage role to a ContextMessage role.
 *
 * Future phases will enrich this with:
 *  - session summaries (Phase 12 token health)
 *  - token-budget trimming (Phase 12)
 *  - agent-specific system prompts from agent definitions (Phase 11)
 */
export class ContextBuilder {
  constructor(private readonly messageRepository: MessageRepository) {}

  /**
   * Build the full context array for a model call.
   *
   * @param sessionId  Session whose history to load.
   * @param systemPrompt  Optional override system prompt. When omitted, no
   *   system message is prepended (the system prompt will be injected by the
   *   agent definition in Phase 11).
   * @param excludeRunId  When provided, messages belonging to the current
   *   in-flight run are excluded (they haven't been acknowledged by the model
   *   yet). Pass the current runId if the user message was already persisted
   *   before calling the model.
   */
  async build(
    sessionId: string,
    systemPrompt?: string,
    excludeRunId?: string
  ): Promise<ContextMessage[]> {
    const rows = this.messageRepository.listBySession(sessionId);

    const messages: ContextMessage[] = [];

    if (systemPrompt !== undefined && systemPrompt.length > 0) {
      messages.push({ role: "system", content: systemPrompt });
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
