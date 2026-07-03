// Public API for packages/eval — Model Experimentation & Evaluation
//
// Phase 29: Built-in model evaluation tools: A/B test prompts across providers,
// run eval harnesses, and track prompt effectiveness over time.

// Re-export protocol types consumed by this package
export type {
  EvalBenchmark,
  EvalBenchmarkId,
  EvalScore,
} from "@agent-workbench/protocol";
// Side-by-side model comparison
export {
  type ComparisonPair,
  type ComparisonResult,
  ModelComparer,
} from "./comparison";
// Results export (CSV/JSON)
export {
  type ExportFormat,
  type ExportOptions,
  ResultsExporter,
} from "./export";
// Eval metrics — accuracy, latency, cost, percentiles
export {
  type EvalMetrics,
  type LatencyPercentiles,
  MetricsCollector,
} from "./metrics";

// One-shot model playground
export {
  ModelPlayground,
  type PlaygroundConfig,
  type PlaygroundResult,
} from "./playground";
// Version-controlled prompt library
export {
  PromptStore,
  type PromptTemplate,
  type PromptVersion,
} from "./prompt-store";
// Eval runner — built-in benchmarks + custom eval pipelines
export { type EvalResult, EvalRunner, type EvalRunOptions } from "./runner";
// Storage — eval tables and repository
export {
  comparisonResults,
  comparisonRuns,
  EvalRepository,
  evalMetrics,
  evalRuns,
  evalScores,
  playgroundRuns,
} from "./storage";
export type {
  ComparisonResultInsert,
  ComparisonResultRow,
  ComparisonRunInsert,
  ComparisonRunRow,
  EvalMetricsInsert,
  EvalMetricsRow,
  EvalRunInsert,
  EvalRunRow,
  EvalScoreInsert,
  EvalScoreRow,
  PlaygroundRunInsert,
  PlaygroundRunRow,
} from "./storage/eval-repository";
