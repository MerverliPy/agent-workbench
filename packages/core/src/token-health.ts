import type { MessageRepository, SummaryRepository } from "@agent-workbench/storage";
import {
  calculateBudget,
  suggestCompaction,
  truncateToolOutput,
} from "@agent-workbench/tokens";
import type {
  TokenBudget,
  CompactionSuggestion,
  TruncatedResult,
  TruncationOptions,
} from "@agent-workbench/tokens";

/**
 * Token health orchestration service.
 *
 * Owned by packages/core. Delegates counting/budget/compaction/truncation
 * to packages/tokens. Manages per-session/per-run token health state
 * (never stored globally on SessionRunner).
 */
export class TokenHealthService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly summaryRepository: SummaryRepository
  ) {}

  /**
   * Compute the current token budget for a session by reading its
   * message history and existing summaries from storage.
   */
  computeBudget(
    sessionId: string,
    modelContextLimit?: number,
    systemPromptContent?: string
  ): TokenBudget {
    const messages = this.messageRepository.listBySession(sessionId);

    const messageSummaries = messages.map((m) => ({
      role: m.role,
      contentLength: m.content.length,
      tokenCount: m.tokenCount ?? undefined,
    }));

    const summaries = this.summaryRepository.listBySession(sessionId);
    const summaryContent = summaries
      .map((s) => s.content)
      .join("\n");

    return calculateBudget({
      modelContextLimit,
      systemPromptContent,
      messages: messageSummaries,
      summaryContent: summaryContent.length > 0 ? summaryContent : undefined,
    });
  }

  /**
   * Check whether compaction should be suggested for a session.
   */
  suggestCompaction(
    sessionId: string,
    modelContextLimit?: number,
    systemPromptContent?: string
  ): CompactionSuggestion {
    const messages = this.messageRepository.listBySession(sessionId);

    const messageSummaries = messages.map((m) => ({
      role: m.role,
      contentLength: m.content.length,
      tokenCount: m.tokenCount ?? undefined,
    }));

    return suggestCompaction({
      modelContextLimit,
      systemPromptContent,
      messages: messageSummaries,
    });
  }

  /**
   * Truncate tool output with metadata preservation.
   * Delegates to packages/tokens truncation engine.
   */
  truncateOutput(raw: string, options?: TruncationOptions): TruncatedResult {
    return truncateToolOutput(raw, options);
  }
}
