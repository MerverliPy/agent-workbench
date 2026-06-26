import type { CompactionSuggestion, ContextBudgetInput, ContextMessageSummary } from "./types";
import { calculateBudget } from "./budget";

export function suggestCompaction(input: ContextBudgetInput): CompactionSuggestion {
  const budget = calculateBudget(input);

  if (budget.level === "healthy") {
    return { suggested: false, currentTokens: budget.used };
  }

  const nonSystemMessages = input.messages.filter((m: ContextMessageSummary) => m.role !== "system");
  const estimatedCompactedTokens = estimateCompactedSize(
    input.systemPromptContent?.length ?? 0,
    nonSystemMessages.length
  );

  return {
    suggested: true,
    currentTokens: budget.used,
    estimatedCompactedTokens: Math.ceil(estimatedCompactedTokens),
    reason:
      budget.level === "critical"
        ? "Context is critically full. Compaction strongly recommended."
        : budget.level === "strained"
          ? "Context is strained. Consider compacting to free space."
          : "Context usage is growing. Compaction may help maintain session health.",
  };
}

function estimateCompactedSize(
  systemPromptLength: number,
  recentMessageCount: number
): number {
  const systemTokens = Math.ceil(systemPromptLength / 4);
  const recentTokens = recentMessageCount * 200;
  const summaryOverhead = 500;
  return systemTokens + recentTokens + summaryOverhead;
}
