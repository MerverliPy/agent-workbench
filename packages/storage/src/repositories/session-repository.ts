import { and, desc, eq, lt } from "drizzle-orm";
import { sessions } from "../schema";
import type { DrizzleBunSqliteDatabase } from "../types";

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
    return this.db.select().from(sessions).orderBy(sessions.updatedAt).all();
  }

  listPaginated(params?: {
    status?: string;
    projectPath?: string;
    limit?: number;
    cursor?: string;
  }): SessionRow[] {
    const conditions = [];
    if (params?.status) conditions.push(eq(sessions.status, params.status));
    if (params?.projectPath)
      conditions.push(eq(sessions.projectPath, params.projectPath));
    if (params?.cursor) conditions.push(lt(sessions.id, params.cursor));

    const base = this.db.select().from(sessions);
    const filtered =
      conditions.length > 0 ? base.where(and(...conditions)) : base;
    return filtered
      .orderBy(desc(sessions.createdAt))
      .limit(params?.limit ?? 50)
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
    data: Partial<Omit<SessionInsert, "id">>,
  ): SessionRow | undefined {
    this.db.update(sessions).set(data).where(eq(sessions.id, id)).run();
    return this.findById(id);
  }
}
