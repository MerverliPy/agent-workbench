import { eq, asc } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { runLedger } from "../schema";

export type LedgerRow = typeof runLedger.$inferSelect;
export type LedgerInsert = typeof runLedger.$inferInsert;

export class LedgerRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): LedgerRow | undefined {
    const rows = this.db
      .select()
      .from(runLedger)
      .where(eq(runLedger.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): LedgerRow[] {
    return this.db
      .select()
      .from(runLedger)
      .where(eq(runLedger.sessionId, sessionId))
      .orderBy(asc(runLedger.createdAt))
      .all();
  }

  listByRun(runId: string): LedgerRow[] {
    return this.db
      .select()
      .from(runLedger)
      .where(eq(runLedger.runId, runId))
      .orderBy(asc(runLedger.createdAt))
      .all();
  }

  listByCategory(category: string): LedgerRow[] {
    return this.db
      .select()
      .from(runLedger)
      .where(eq(runLedger.eventCategory, category))
      .orderBy(asc(runLedger.createdAt))
      .all();
  }

  create(data: LedgerInsert): LedgerRow {
    this.db.insert(runLedger).values(data).run();
    return this.findById(data.id) as LedgerRow;
  }
}
