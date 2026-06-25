import { eq, asc } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { fileChanges } from "../schema";

export type FileChangeRow = typeof fileChanges.$inferSelect;
export type FileChangeInsert = typeof fileChanges.$inferInsert;

export class FileChangeRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): FileChangeRow | undefined {
    const rows = this.db
      .select()
      .from(fileChanges)
      .where(eq(fileChanges.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): FileChangeRow[] {
    return this.db
      .select()
      .from(fileChanges)
      .where(eq(fileChanges.sessionId, sessionId))
      .orderBy(asc(fileChanges.createdAt))
      .all();
  }

  listByRun(runId: string): FileChangeRow[] {
    return this.db
      .select()
      .from(fileChanges)
      .where(eq(fileChanges.runId, runId))
      .orderBy(asc(fileChanges.createdAt))
      .all();
  }

  create(data: FileChangeInsert): FileChangeRow {
    this.db.insert(fileChanges).values(data).run();
    return this.findById(data.id) as FileChangeRow;
  }
}
