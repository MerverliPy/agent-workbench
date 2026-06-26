import { eq, asc } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { plans } from "../schema";

export type PlanRow = typeof plans.$inferSelect;
export type PlanInsert = typeof plans.$inferInsert;

export class PlanRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): PlanRow | undefined {
    const rows = this.db
      .select()
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): PlanRow[] {
    return this.db
      .select()
      .from(plans)
      .where(eq(plans.sessionId, sessionId))
      .orderBy(asc(plans.createdAt))
      .all();
  }

  listByRun(runId: string): PlanRow[] {
    return this.db
      .select()
      .from(plans)
      .where(eq(plans.runId, runId))
      .orderBy(asc(plans.createdAt))
      .all();
  }

  create(data: PlanInsert): PlanRow {
    this.db.insert(plans).values(data).run();
    return this.findById(data.id) as PlanRow;
  }

  update(id: string, data: Partial<Omit<PlanInsert, "id">>): PlanRow | undefined {
    const existing = this.findById(id);
    if (existing === undefined) return undefined;
    this.db.update(plans).set(data).where(eq(plans.id, id)).run();
    return this.findById(id);
  }
}
