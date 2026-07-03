import { asc, eq } from "drizzle-orm";
import { configSnapshots } from "../schema";
import type { DrizzleBunSqliteDatabase } from "../types";

export type ConfigSnapshotRow = typeof configSnapshots.$inferSelect;
export type ConfigSnapshotInsert = typeof configSnapshots.$inferInsert;

export class ConfigSnapshotRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): ConfigSnapshotRow | undefined {
    const rows = this.db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): ConfigSnapshotRow[] {
    return this.db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.sessionId, sessionId))
      .orderBy(asc(configSnapshots.createdAt))
      .all();
  }

  listByRun(runId: string): ConfigSnapshotRow[] {
    return this.db
      .select()
      .from(configSnapshots)
      .where(eq(configSnapshots.runId, runId))
      .orderBy(asc(configSnapshots.createdAt))
      .all();
  }

  create(data: ConfigSnapshotInsert): ConfigSnapshotRow {
    this.db.insert(configSnapshots).values(data).run();
    return this.findById(data.id) as ConfigSnapshotRow;
  }
}
