import { z } from "zod/v4";

/**
 * Priority tier for a provider in the fallback chain.
 * - preferred: used as the primary provider for its task category
 * - fallback: used when the primary is unavailable
 * - emergency: absolute last resort
 */
export const ProviderTier = z.enum(["preferred", "fallback", "emergency"]);
export type ProviderTier = z.infer<typeof ProviderTier>;

/**
 * Task categories the smart router recognizes for provider selection.
 */
export const TaskCategory = z.enum([
  "read",
  "code_generation",
  "architecture_review",
  "summarization",
]);
export type TaskCategory = z.infer<typeof TaskCategory>;

/**
 * A provider profile that can be persisted and managed in the marketplace.
 * Sensitive fields (apiKey) are never returned in API responses — only
 * a `hasKey` boolean is exposed.
 */
export const ProviderProfile = z.object({
  /** Unique identifier for this profile (e.g. "my-openai"). */
  id: z.string().min(1).max(64),
  /** Human-readable display name. */
  name: z.string().min(1).max(128),
  /** Provider type: openai, anthropic, openrouter, ollama, or custom. */
  providerType: z.string().min(1),
  /** Model identifier (e.g. "gpt-4o", "claude-sonnet-4-20250514"). */
  model: z.string().min(1),
  /** Optional base URL override. */
  baseUrl: z.string().optional(),
  /** Priority tier for fallback ordering. */
  tier: ProviderTier.default("fallback"),
  /** Task categories this provider is suitable for. */
  taskCategories: z.array(TaskCategory).default(["read", "summarization"]),
  /** Context window limit in tokens. */
  contextLimit: z.number().int().nonnegative().optional(),
  /** Whether an API key has been configured (never contains the key itself). */
  hasKey: z.boolean().default(false),
  /** Cost per 1K input tokens in USD (for cost estimation). */
  costPer1KInput: z.number().nonnegative().default(0),
  /** Cost per 1K output tokens in USD (for cost estimation). */
  costPer1KOutput: z.number().nonnegative().default(0),
  /** Whether this provider supports streaming. */
  supportsStreaming: z.boolean().default(true),
  /** Whether this provider is enabled. */
  enabled: z.boolean().default(true),
  /** ISO timestamp of creation. */
  createdAt: z.string(),
  /** ISO timestamp of last update. */
  updatedAt: z.string(),
});
export type ProviderProfile = z.infer<typeof ProviderProfile>;

/**
 * Input for creating or updating a provider profile.
 * Includes the optional apiKey field that is stored separately.
 */
export const ProviderProfileInput = z.object({
  name: z.string().min(1).max(128),
  providerType: z.string().min(1),
  model: z.string().min(1),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  tier: ProviderTier.default("fallback"),
  taskCategories: z.array(TaskCategory).default(["read", "summarization"]),
  contextLimit: z.number().int().nonnegative().optional(),
  costPer1KInput: z.number().nonnegative().default(0),
  costPer1KOutput: z.number().nonnegative().default(0),
  supportsStreaming: z.boolean().default(true),
  enabled: z.boolean().default(true),
});
export type ProviderProfileInput = z.infer<typeof ProviderProfileInput>;

/**
 * A cost record for a single model call.
 */
export const CostRecord = z.object({
  providerId: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cost: z.number().nonnegative(),
  timestamp: z.string(),
});
export type CostRecord = z.infer<typeof CostRecord>;

/**
 * Aggregated cost summary for a session or day.
 */
export const CostSummary = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  totalCost: z.number().nonnegative(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  calls: z.number().int().nonnegative(),
  providerBreakdown: z.record(
    z.string(),
    z.object({
      cost: z.number().nonnegative(),
      calls: z.number().int().nonnegative(),
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
  ),
});
export type CostSummary = z.infer<typeof CostSummary>;
