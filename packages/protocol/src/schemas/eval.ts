// Evaluation schemas for Phase 29: Model Experimentation & Evaluation

import { z } from "zod";

/** Standard benchmark identifiers */
export const EvalBenchmarkId = z.enum([
  "mmlu", // Massive Multitask Language Understanding
  "humaneval", // Code generation benchmark
  "gsm8k", // Grade School Math 8K
  "hellaswag", // Commonsense reasoning
  "arc", // AI2 Reasoning Challenge
  "custom", // User-defined benchmark
  "promptfoo", // Promptfoo-based evaluation
]);

export type EvalBenchmarkId = z.infer<typeof EvalBenchmarkId>;

/** Evaluation benchmark definition */
export const EvalBenchmark = z.object({
  /** Unique identifier */
  id: EvalBenchmarkId,
  /** Human-readable name */
  name: z.string(),
  /** Description of what this benchmark measures */
  description: z.string(),
  /** Number of items in the benchmark */
  itemCount: z.number(),
  /** Categories or subjects within the benchmark */
  categories: z.array(z.string()),
  /** Whether it requires external Python tools (lm-eval-harness) */
  requiresPython: z.boolean(),
  /** License information */
  license: z.string().optional(),
});

export type EvalBenchmark = z.infer<typeof EvalBenchmark>;

/** Individual evaluation score */
export const EvalScore = z.object({
  /** Category or task name */
  task: z.string(),
  /** Score value (0-1 for accuracy, raw values for others) */
  score: z.number(),
  /** Metric type */
  metric: z.enum(["accuracy", "exact_match", "bleu", "rouge", "pass_at_k", "custom"]),
  /** Number of items evaluated for this score */
  itemCount: z.number(),
});

export type EvalScore = z.infer<typeof EvalScore>;