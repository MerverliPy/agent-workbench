// Public API for packages/eval — Model Experimentation & Evaluation
//
// Phase 29: Built-in model evaluation tools: A/B test prompts across providers,
// run eval harnesses, and track prompt effectiveness over time.

// Eval runner — built-in benchmarks + custom eval pipelines
export { EvalRunner, type EvalRunOptions, type EvalResult } from "./runner";

// Eval metrics — accuracy, latency, cost, percentiles
export { MetricsCollector, type EvalMetrics, type LatencyPercentiles } from "./metrics";

// Side-by-side model comparison
export { ModelComparer, type ComparisonResult, type ComparisonPair } from "./comparison";

// Version-controlled prompt library
export { PromptStore, type PromptTemplate, type PromptVersion } from "./prompt-store";

// One-shot model playground
export { ModelPlayground, type PlaygroundConfig, type PlaygroundResult } from "./playground";

// Re-export protocol types needed by consumers
export type { EvalBenchmark, EvalBenchmarkId, EvalScore } from "@agent-workbench/protocol";
