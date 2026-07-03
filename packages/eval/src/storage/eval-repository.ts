// Eval repository — CRUD operations for eval storage
//
// Follows the repository pattern from @agent-workbench/storage.

import { eq, asc, desc, sql } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "@agent-workbench/storage";
import {
  evalRuns,
  evalScores,
  evalMetrics,
  playgroundRuns,
  comparisonRuns,
  comparisonResults,
} from "./schema";

// --- Type helpers ---

export type EvalRunRow = typeof evalRuns.$inferSelect;
export type EvalRunInsert = typeof evalRuns.$inferInsert;
export type EvalScoreRow = typeof evalScores.$inferSelect;
export type EvalScoreInsert = typeof evalScores.$inferInsert;
export type EvalMetricsRow = typeof evalMetrics.$inferSelect;
export type EvalMetricsInsert = typeof evalMetrics.$inferInsert;
export type PlaygroundRunRow = typeof playgroundRuns.$inferSelect;
export type PlaygroundRunInsert = typeof playgroundRuns.$inferInsert;
export type ComparisonRunRow = typeof comparisonRuns.$inferSelect;
export type ComparisonRunInsert = typeof comparisonRuns.$inferInsert;
export type ComparisonResultRow = typeof comparisonResults.$inferSelect;
export type ComparisonResultInsert = typeof comparisonResults.$inferInsert;

export class EvalRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  // ── Eval Runs ──

  findRunById(id: string): EvalRunRow | undefined {
    const rows = this.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listRuns(limit = 20, offset = 0): EvalRunRow[] {
    return this.db
      .select()
      .from(evalRuns)
      .orderBy(desc(evalRuns.createdAt))
      .limit(limit)
      .offset(offset)
      .all();
  }

  listRunsByModel(model: string, limit = 20): EvalRunRow[] {
    return this.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.model, model))
      .orderBy(desc(evalRuns.createdAt))
      .limit(limit)
      .all();
  }

  listRunsByBenchmark(benchmarkId: string, limit = 20): EvalRunRow[] {
    return this.db
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.benchmarkId, benchmarkId))
      .orderBy(desc(evalRuns.createdAt))
      .limit(limit)
      .all();
  }

  createRun(data: EvalRunInsert): EvalRunRow {
    this.db.insert(evalRuns).values(data).run();
    return this.findRunById(data.id)!;
  }

  updateRunStatus(id: string, status: string, completedAt?: string, error?: string): void {
    const updates: Partial<EvalRunInsert> = { status };
    if (completedAt !== undefined) updates.completedAt = completedAt;
    if (error !== undefined) updates.error = error;
    this.db.update(evalRuns).set(updates).where(eq(evalRuns.id, id)).run();
  }

  deleteRun(id: string): void {
    this.db.delete(evalScores).where(eq(evalScores.runId, id)).run();
    this.db.delete(evalMetrics).where(eq(evalMetrics.runId, id)).run();
    this.db.delete(evalRuns).where(eq(evalRuns.id, id)).run();
  }

  // ── Eval Scores ──

  listScoresByRun(runId: string): EvalScoreRow[] {
    return this.db
      .select()
      .from(evalScores)
      .where(eq(evalScores.runId, runId))
      .orderBy(asc(evalScores.task))
      .all();
  }

  createScore(data: EvalScoreInsert): EvalScoreRow {
    this.db.insert(evalScores).values(data).run();
    return data as EvalScoreRow;
  }

  createScores(data: EvalScoreInsert[]): void {
    for (const row of data) {
      this.db.insert(evalScores).values(row).run();
    }
  }

  // ── Eval Metrics ──

  findMetricsByRun(runId: string): EvalMetricsRow | undefined {
    const rows = this.db
      .select()
      .from(evalMetrics)
      .where(eq(evalMetrics.runId, runId))
      .limit(1)
      .all();
    return rows[0];
  }

  upsertMetrics(data: EvalMetricsInsert): void {
    const existing = this.findMetricsByRun(data.runId);
    if (existing) {
      this.db
        .update(evalMetrics)
        .set(data)
        .where(eq(evalMetrics.runId, data.runId))
        .run();
    } else {
      this.db.insert(evalMetrics).values(data).run();
    }
  }

  /** Compare metrics across multiple runs */
  compareMetrics(runIds: string[]): Array<{ runId: string; metrics: EvalMetricsRow }> {
    return runIds
      .map((id) => {
        const m = this.findMetricsByRun(id);
        return m ? { runId: id, metrics: m } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  // ── Playground ──

  listPlaygroundRuns(limit = 20): PlaygroundRunRow[] {
    return this.db
      .select()
      .from(playgroundRuns)
      .orderBy(desc(playgroundRuns.createdAt))
      .limit(limit)
      .all();
  }

  createPlaygroundRun(data: PlaygroundRunInsert): PlaygroundRunRow {
    this.db.insert(playgroundRuns).values(data).run();
    return data as PlaygroundRunRow;
  }

  // ── Comparisons ──

  listComparisons(limit = 20): ComparisonRunRow[] {
    return this.db
      .select()
      .from(comparisonRuns)
      .orderBy(desc(comparisonRuns.createdAt))
      .limit(limit)
      .all();
  }

  createComparison(data: ComparisonRunInsert): ComparisonRunRow {
    this.db.insert(comparisonRuns).values(data).run();
    return data as ComparisonRunRow;
  }

  getComparisonResults(comparisonId: string): ComparisonResultRow[] {
    return this.db
      .select()
      .from(comparisonResults)
      .where(eq(comparisonResults.comparisonId, comparisonId))
      .orderBy(asc(comparisonResults.ranking))
      .all();
  }

  createComparisonResult(data: ComparisonResultInsert): ComparisonResultRow {
    this.db.insert(comparisonResults).values(data).run();
    return data as ComparisonResultRow;
  }

  createComparisonResults(data: ComparisonResultInsert[]): void {
    for (const row of data) {
      this.db.insert(comparisonResults).values(row).run();
    }
  }

  // ── Aggregations ──

  /** Get the best-performing model for a benchmark (highest accuracy) */
  getBestModelForBenchmark(benchmarkId: string): string | undefined {
    const rows = this.db
      .select({
        model: evalRuns.model,
        accuracy: evalMetrics.accuracy,
      })
      .from(evalRuns)
      .innerJoin(evalMetrics, eq(evalRuns.id, evalMetrics.runId))
      .where(
        sql`${evalRuns.benchmarkId} = ${benchmarkId} AND ${evalRuns.status} = 'completed' AND ${evalMetrics.accuracy} IS NOT NULL`,
      )
      .orderBy(desc(evalMetrics.accuracy))
      .limit(1)
      .all();
    return rows[0]?.model;
  }

  /** Count total eval runs */
  countRuns(): number {
    const rows = this.db
      .select({ count: sql<number>`count(*)` })
      .from(evalRuns)
      .all();
    return rows[0]?.count ?? 0;
  }
}
