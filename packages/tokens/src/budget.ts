import type { TokenBudget, TokenHealthLevel, ContextBudgetInput } from "./types";
import { estimateTokensFromLength } from "./counting";

const DEFAULT_CONTEXT_LIMIT = 128_000;

const HEALTHY_THRESHOLD = 0.50;
const WATCH_THRESHOLD = 0.30;
const STRAINED_THRESHOLD = 0.10;

function classifyLevel(utilizationPercent: number): TokenHealthLevel {
  if (utilizationPercent > (1 - STRAINED_THRESHOLD) * 100) return "critical";
  if (utilizationPercent > (1 - WATCH_THRESHOLD) * 100) return "strained";
  if (utilizationPercent > (1 - HEALTHY_THRESHOLD) * 100) return "watch";
  return "healthy";
}

export function calculateBudget(input: ContextBudgetInput): TokenBudget {
  const limit = input.modelContextLimit ?? DEFAULT_CONTEXT_LIMIT;

  let estimatedUsed = 0;

  if (input.systemPromptContent !== undefined) {
    estimatedUsed += estimateTokensFromLength(input.systemPromptContent.length);
  }

  for (const msg of input.messages) {
    if (msg.tokenCount !== undefined) {
      estimatedUsed += msg.tokenCount;
    } else {
      estimatedUsed += estimateTokensFromLength(msg.contentLength);
    }
  }

  for (const tool of input.toolDefinitions ?? []) {
    estimatedUsed += estimateTokensFromLength(
      tool.name.length + tool.description.length + 100
    );
  }

  for (const result of input.pendingToolResults ?? []) {
    estimatedUsed += estimateTokensFromLength(result.resultSize);
  }

  if (input.summaryContent !== undefined) {
    estimatedUsed += estimateTokensFromLength(input.summaryContent.length);
  }

  const remaining = Math.max(0, limit - estimatedUsed);
  const utilizationPercent = limit > 0
    ? Math.round((estimatedUsed / limit) * 100)
    : 0;

  return {
    limit,
    used: estimatedUsed,
    remaining,
    utilizationPercent: Math.min(100, utilizationPercent),
    level: classifyLevel(utilizationPercent),
    isEstimate: true,
  };
}
