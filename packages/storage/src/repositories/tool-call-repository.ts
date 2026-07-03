import { asc, eq } from "drizzle-orm";
import { toolCalls } from "../schema";
import type { DrizzleBunSqliteDatabase } from "../types";

export type ToolCallRow = typeof toolCalls.$inferSelect;
export type ToolCallInsert = typeof toolCalls.$inferInsert;

export class ToolCallRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): ToolCallRow | undefined {
    const rows = this.db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): ToolCallRow[] {
    return this.db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.sessionId, sessionId))
      .orderBy(asc(toolCalls.startedAt))
      .all();
  }

  listByRun(runId: string): ToolCallRow[] {
    return this.db
      .select()
      .from(toolCalls)
      .where(eq(toolCalls.runId, runId))
      .orderBy(asc(toolCalls.startedAt))
      .all();
  }

  create(data: ToolCallInsert): ToolCallRow {
    this.db.insert(toolCalls).values(data).run();
    return this.findById(data.id) as ToolCallRow;
  }

  update(
    id: string,
    data: Partial<Omit<ToolCallInsert, "id">>,
  ): ToolCallRow | undefined {
    this.db.update(toolCalls).set(data).where(eq(toolCalls.id, id)).run();
    return this.findById(id);
  }
}
