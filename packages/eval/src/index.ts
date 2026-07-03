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

// Results export (CSV/JSON)
export { ResultsExporter, type ExportOptions, type ExportFormat } from "./export";

// Storage — eval tables and repository
export {
  EvalRepository,
  evalRuns,
  evalScores,
  evalMetrics,
  playgroundRuns,
  comparisonRuns,
  comparisonResults,
} from "./storage";

export type {
  EvalRunRow,
  EvalRunInsert,
  EvalScoreRow,
  EvalScoreInsert,
  EvalMetricsRow,
  EvalMetricsInsert,
  PlaygroundRunRow,
  PlaygroundRunInsert,
  ComparisonRunRow,
  ComparisonRunInsert,
  ComparisonResultRow,
  ComparisonResultInsert,
} from "./storage/eval-repository";

// Re-export protocol types consumed by this package
export type { EvalBenchmark, EvalBenchmarkId, EvalScore } from "@agent-workbench/protocol";
