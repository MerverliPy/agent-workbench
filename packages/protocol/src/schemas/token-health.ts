import { z } from "zod/v4";

export const TokenHealthLevel = z.enum([
  "healthy",
  "watch",
  "strained",
  "critical",
]);
export type TokenHealthLevel = z.infer<typeof TokenHealthLevel>;

export const TokenHealthStatus = z.object({
  budget: z.number().int().nonnegative(),
  used: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  threshold: z.number().int().nonnegative(),
  utilizationPercent: z.number().min(0).max(100),
  level: TokenHealthLevel,
  isEstimate: z.boolean(),
  compactionSuggested: z.boolean(),
});
export type TokenHealthStatus = z.infer<typeof TokenHealthStatus>;

export const CompactionSuggestion = z.object({
  suggested: z.boolean(),
  currentTokens: z.number().int().nonnegative(),
  estimatedCompactedTokens: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
});
export type CompactionSuggestion = z.infer<typeof CompactionSuggestion>;
