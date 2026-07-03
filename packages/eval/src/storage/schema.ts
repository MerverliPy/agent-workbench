// Eval storage schemas — Phase 29: Model Experimentation & Evaluation
//
// Follows the Drizzle SQLite pattern from @agent-workbench/storage.

import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/** Evaluation runs — a benchmark execution against a model + provider */
export const evalRuns = sqliteTable(
  "eval_runs",
  {
    id: text("id").primaryKey(),
    benchmarkId: text("benchmark_id").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("pending"), // pending | running | completed | failed
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
    configJson: text("config_json"), // EvalRunOptions serialized
    rawOutput: text("raw_output"),
    error: text("error"),
  },
  (table) => [
    index("eval_runs_benchmark_idx").on(table.benchmarkId),
    index("eval_runs_model_idx").on(table.model),
    index("eval_runs_status_idx").on(table.status),
    index("eval_runs_created_idx").on(table.createdAt),
  ],
);

/** Individual scores within an eval run */
export const evalScores = sqliteTable(
  "eval_scores",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => evalRuns.id),
    task: text("task").notNull(), // e.g. "mmlu_astronomy", "code_generation"
    score: real("score").notNull(),
    metric: text("metric").notNull(), // accuracy | exact_match | bleu | rouge | pass_at_k | custom
    itemCount: integer("item_count").notNull().default(0),
  },
  (table) => [
    index("eval_scores_run_id_idx").on(table.runId),
    index("eval_scores_task_idx").on(table.task),
  ],
);

/** Aggregated metrics per eval run */
export const evalMetrics = sqliteTable("eval_metrics", {
  runId: text("run_id")
    .primaryKey()
    .references(() => evalRuns.id),
  accuracy: real("accuracy"),
  totalItems: integer("total_items").notNull().default(0),
  itemsPassed: integer("items_passed").notNull().default(0),
  durationMs: integer("duration_ms"),
  costUsd: real("cost_usd"),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  latencyP50Ms: real("latency_p50_ms"),
  latencyP95Ms: real("latency_p95_ms"),
  latencyP99Ms: real("latency_p99_ms"),
  errorRate: real("error_rate"),
});

/** Model playground history */
export const playgroundRuns = sqliteTable(
  "playground_runs",
  {
    id: text("id").primaryKey(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    systemPrompt: text("system_prompt"),
    userMessage: text("user_message").notNull(),
    output: text("output").notNull(),
    createdAt: text("created_at").notNull(),
    latencyMs: integer("latency_ms"),
    costUsd: real("cost_usd"),
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),
    streamed: integer("streamed", { mode: "boolean" }).notNull().default(false),
    configJson: text("config_json"),
  },
  (table) => [
    index("playground_runs_model_idx").on(table.model),
    index("playground_runs_created_idx").on(table.createdAt),
  ],
);

/** Model comparison runs */
export const comparisonRuns = sqliteTable("comparison_runs", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  systemPrompt: text("system_prompt"),
  createdAt: text("created_at").notNull(),
  modelCount: integer("model_count").notNull(),
});

/** Individual model results within a comparison */
export const comparisonResults = sqliteTable(
  "comparison_results",
  {
    id: text("id").primaryKey(),
    comparisonId: text("comparison_id")
      .notNull()
      .references(() => comparisonRuns.id),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    output: text("output").notNull(),
    latencyMs: integer("latency_ms"),
    costUsd: real("cost_usd"),
    tokensInput: integer("tokens_input"),
    tokensOutput: integer("tokens_output"),
    ranking: integer("ranking"), // 1 = best, null = unranked
  },
  (table) => [
    index("comparison_results_comparison_idx").on(table.comparisonId),
    index("comparison_results_ranking_idx").on(table.ranking),
  ],
);
