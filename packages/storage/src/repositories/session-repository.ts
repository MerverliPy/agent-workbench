import { eq } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { sessions } from "../schema";

export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;

export class SessionRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): SessionRow | undefined {
    const rows = this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  list(): SessionRow[] {
    return this.db
      .select()
      .from(sessions)
      .orderBy(sessions.updatedAt)
      .all();
  }

  listByProject(projectPath: string): SessionRow[] {
    return this.db
      .select()
      .from(sessions)
      .where(eq(sessions.projectPath, projectPath))
      .orderBy(sessions.updatedAt)
      .all();
  }

  create(data: SessionInsert): SessionRow {
    this.db.insert(sessions).values(data).run();
    return this.findById(data.id) as SessionRow;
  }

  update(
    id: string,
    data: Partial<Omit<SessionInsert, "id">>
  ): SessionRow | undefined {
    this.db.update(sessions).set(data).where(eq(sessions.id, id)).run();
    return this.findById(id);
  }
}
