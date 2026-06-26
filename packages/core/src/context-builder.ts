import type { MessageRepository, SummaryRepository } from "@agent-workbench/storage";
import type { ContextMessage } from "./types";

export interface BuildOptions {
  sessionId: string;
  systemPrompt?: string | undefined;
  excludeRunId?: string | undefined;
  agentSystemPrompt?: string | undefined;
  maxTokenBudget?: number | undefined;
  injectSummaries?: boolean | undefined;
}

/**
 * Builds a provider-neutral message list for a model call by reading the
 * persisted message history for a session.
 *
 * Phase 12: injects session summaries at the head of context (after system
 * prompt) and supports approximate token-budget trimming.
 */
export class ContextBuilder {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly summaryRepository: SummaryRepository
  ) {}

  /**
   * Build the full context array for a model call.
   */
  async build(options: BuildOptions): Promise<ContextMessage[]> {
    const {
      sessionId,
      systemPrompt,
      excludeRunId,
      agentSystemPrompt,
      injectSummaries = true,
    } = options;

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

    if (injectSummaries) {
      const summaries = this.summaryRepository.listBySession(sessionId);
      for (const summary of summaries) {
        messages.push({
          role: "system",
          content: `[Session Summary (${summary.summaryType})]: ${summary.content}`,
        });
      }
    }

    for (const row of rows) {
      if (excludeRunId !== undefined && row.runId === excludeRunId) {
        continue;
      }

      const role = this.mapRole(row.role);
      if (role === null) {
        continue;
      }

      const msg: ContextMessage = { role, content: row.content };

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
