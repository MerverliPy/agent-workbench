import { eq, asc } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { messages } from "../schema";

export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

export class MessageRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): MessageRow | undefined {
    const rows = this.db
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): MessageRow[] {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .all();
  }

  listByRun(runId: string): MessageRow[] {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.runId, runId))
      .orderBy(asc(messages.createdAt))
      .all();
  }

  create(data: MessageInsert): MessageRow {
    this.db.insert(messages).values(data).run();
    return this.findById(data.id) as MessageRow;
  }
}
