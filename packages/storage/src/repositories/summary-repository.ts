import { asc, eq } from "drizzle-orm";
import { summaries } from "../schema";
import type { DrizzleBunSqliteDatabase } from "../types";

export type SummaryRow = typeof summaries.$inferSelect;
export type SummaryInsert = typeof summaries.$inferInsert;

export class SummaryRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): SummaryRow | undefined {
    const rows = this.db
      .select()
      .from(summaries)
      .where(eq(summaries.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): SummaryRow[] {
    return this.db
      .select()
      .from(summaries)
      .where(eq(summaries.sessionId, sessionId))
      .orderBy(asc(summaries.createdAt))
      .all();
  }

  listByRun(runId: string): SummaryRow[] {
    return this.db
      .select()
      .from(summaries)
      .where(eq(summaries.runId, runId))
      .orderBy(asc(summaries.createdAt))
      .all();
  }

  create(data: SummaryInsert): SummaryRow {
    this.db.insert(summaries).values(data).run();
    return this.findById(data.id) as SummaryRow;
  }
}
