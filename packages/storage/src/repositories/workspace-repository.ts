import { eq, and, isNull } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { workspaces } from "../schema/workspaces";

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type WorkspaceInsert = typeof workspaces.$inferInsert;

export class WorkspaceRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): WorkspaceRow | undefined {
    const rows = this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  list(includeArchived = false): WorkspaceRow[] {
    const q = this.db.select().from(workspaces);
    if (!includeArchived) {
      return q
        .where(eq(workspaces.archived, false))
        .orderBy(workspaces.updatedAt)
        .all();
    }
    return q.orderBy(workspaces.updatedAt).all();
  }

  create(row: WorkspaceInsert): WorkspaceRow {
    this.db.insert(workspaces).values(row).run();
    return this.findById(row.id)!;
  }

  update(
    id: string,
    patch: Partial<
      Pick<
        WorkspaceInsert,
        "name" | "rootPath" | "description" | "archived" | "tagsJson" | "updatedAt"
      >
    >,
  ): WorkspaceRow | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    this.db
      .update(workspaces)
      .set(patch)
      .where(eq(workspaces.id, id))
      .run();
    return this.findById(id);
  }

  delete(id: string): boolean {
    const existing = this.findById(id);
    if (!existing) return false;
    this.db.delete(workspaces).where(eq(workspaces.id, id)).run();
    return true;
  }
}
