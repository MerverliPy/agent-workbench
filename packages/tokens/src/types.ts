export type TokenHealthLevel = "healthy" | "watch" | "strained" | "critical";

export interface TokenBudget {
  limit: number;
  used: number;
  remaining: number;
  utilizationPercent: number;
  level: TokenHealthLevel;
  isEstimate: boolean;
}

export interface TokenCountEstimate {
  tokenCount: number;
  isEstimate: boolean;
  method: "char_div_4" | "provider_reported";
}

export interface TruncationMeta {
  truncated: boolean;
  originalLength: number;
  truncatedLength: number;
  reason: "output_limit" | "context_budget";
  preservedElements: string[];
}

export interface CompactionSuggestion {
  suggested: boolean;
  currentTokens: number;
  estimatedCompactedTokens?: number;
  reason?: string;
}

export interface ContextBudgetInput {
  modelContextLimit?: number | undefined;
  systemPromptContent?: string | undefined;
  messages: ContextMessageSummary[];
  toolDefinitions?: { name: string; description: string }[] | undefined;
  pendingToolResults?: { name: string; resultSize: number }[] | undefined;
  summaryContent?: string | undefined;
}

export interface ContextMessageSummary {
  role: string;
  contentLength: number;
  tokenCount?: number | undefined;
}
