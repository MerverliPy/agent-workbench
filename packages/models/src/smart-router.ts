import type { ProviderProfile, TaskCategory } from "@agent-workbench/protocol";
import type { ProviderMarketplace } from "./marketplace";

/**
 * Task classification result from the classifier.
 */
export interface TaskClassification {
  /** Primary task category. */
  category: TaskCategory;
  /** Confidence score 0-1. */
  confidence: number;
  /** Keywords that triggered this classification. */
  matchedKeywords: string[];
}

/**
 * Routing decision from the smart router.
 */
export interface RoutingDecision {
  /** The selected provider profile. */
  provider: ProviderProfile;
  /** The task category used for selection. */
  category: TaskCategory;
  /** The confidence of the classification. */
  classificationConfidence: number;
  /** The fallback chain that would be tried if this provider fails. */
  fallbackChain: ProviderProfile[];
}

/**
 * Default cost-per-1K tokens for well-known models (USD).
 * Used for cost estimation when no profile-specific costs are set.
 */
const DEFAULT_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  // Anthropic
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-sonnet-4": { input: 0.003, output: 0.015 },
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
  "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
  "claude-haiku-3-5": { input: 0.0008, output: 0.004 },
  // DeepSeek
  "deepseek-v3-flash": { input: 0.00014, output: 0.00028 },
  "deepseek-v4-pro": { input: 0.002, output: 0.008 },
  // Google
  "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
  "gemini-2.0-pro": { input: 0.0035, output: 0.0105 },
  // Mistral
  "mistral-large-latest": { input: 0.002, output: 0.006 },
  "mistral-small-latest": { input: 0.001, output: 0.003 },
};

/**
 * Keywords that map user prompts to task categories.
 */
const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  read: [
    "read",
    "show",
    "display",
    "cat",
    "view",
    "list",
    "search",
    "find",
    "grep",
    "glob",
    "look",
    "what is",
    "explain",
    "describe",
    "status",
  ],
  code_generation: [
    "create",
    "write",
    "implement",
    "generate",
    "add",
    "build",
    "refactor",
    "fix",
    "update",
    "change",
    "modify",
    "edit",
    "patch",
  ],
  architecture_review: [
    "review",
    "audit",
    "architect",
    "design",
    "analyze",
    "evaluate",
    "assess",
    "compare",
    "plan",
    "strategy",
  ],
  summarization: [
    "summarize",
    "summarise",
    "brief",
    "tl;dr",
    "tldr",
    "condense",
    "shorten",
    "overview",
    "digest",
  ],
};

/**
 * Smart Router — task-based provider selection engine.
 *
 * Classifies a user prompt or tool call into a task category, then
 * selects the best provider from the marketplace based on cost,
 * tier, and task suitability.
 */
export class SmartRouter {
  private readonly marketplace: ProviderMarketplace;

  constructor(marketplace: ProviderMarketplace) {
    this.marketplace = marketplace;
  }

  /**
   * Classify a prompt into a task category.
   */
  classify(prompt: string): TaskClassification {
    const lower = prompt.toLowerCase();
    let bestCategory: TaskCategory = "read";
    let bestScore = 0;
    let bestKeywords: string[] = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      const matched: string[] = [];

      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          score += 1;
          matched.push(keyword);
        }
      }

      // Normalize score by keyword count so shorter keyword lists aren't
      // unfairly disadvantaged
      const normalized = keywords.length > 0 ? score / keywords.length : 0;

      if (normalized > bestScore) {
        bestScore = normalized;
        bestCategory = category as TaskCategory;
        bestKeywords = matched;
      }
    }

    // Boost confidence based on keyword density
    const confidence = Math.min(bestScore * 3, 1.0);

    return {
      category: bestCategory,
      confidence,
      matchedKeywords: bestKeywords,
    };
  }

  /**
   * Select the best provider for a given task classification.
   */
  route(classification: TaskClassification): RoutingDecision {
    const { category } = classification;

    // Get all enabled providers sorted by priority order:
    // preferred → fallback → emergency
    const preferred = this.marketplace.list({
      tier: "preferred",
      enabledOnly: true,
    });
    const fallback = this.marketplace.list({
      tier: "fallback",
      enabledOnly: true,
    });
    const emergency = this.marketplace.list({
      tier: "emergency",
      enabledOnly: true,
    });

    // Score and rank providers by task suitability
    const scored = [...preferred, ...fallback, ...emergency]
      .map((p) => ({
        provider: p,
        score: this.scoreProvider(p, category),
      }))
      .sort((a, b) => b.score - a.score);

    const selected = scored[0];
    if (selected === undefined) {
      throw new Error("No enabled provider profiles found in the marketplace");
    }

    // Build fallback chain (everything after the selected provider)
    const fallbackChain = scored
      .slice(1)
      .filter((s) => s.score > 0)
      .map((s) => s.provider);

    return {
      provider: selected.provider,
      category,
      classificationConfidence: classification.confidence,
      fallbackChain,
    };
  }

  /**
   * One-shot: classify + route in a single call.
   */
  classifyAndRoute(prompt: string): RoutingDecision {
    const classification = this.classify(prompt);
    return this.route(classification);
  }

  /**
   * Get default cost rates for a model (USD per 1K tokens).
   */
  static getDefaultCost(model: string): { input: number; output: number } {
    return DEFAULT_MODEL_COSTS[model] ?? { input: 0.002, output: 0.008 };
  }

  /**
   * Score a provider's suitability for a given task category.
   * Higher is better. Factors: tier priority, task category match,
   * cost efficiency.
   */
  private scoreProvider(
    profile: ProviderProfile,
    category: TaskCategory,
  ): number {
    let score = 0;

    // Tier bonus
    switch (profile.tier) {
      case "preferred":
        score += 100;
        break;
      case "fallback":
        score += 50;
        break;
      case "emergency":
        score += 10;
        break;
    }

    // Task category match bonus
    if (profile.taskCategories.includes(category)) {
      score += 50;
    }

    // Cost efficiency (lower cost = higher score, capped at 30)
    const totalCost = profile.costPer1KInput + profile.costPer1KOutput;
    const costEfficiency =
      totalCost > 0 ? Math.max(0, 30 - totalCost * 1000) : 30;
    score += costEfficiency;

    // Enabled bonus
    if (profile.enabled) {
      score += 20;
    }

    // Context limit bonus (larger context = more versatile, capped at 10)
    if (profile.contextLimit !== undefined) {
      score += Math.min(10, profile.contextLimit / 20000);
    }

    return score;
  }
}
