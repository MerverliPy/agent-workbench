import { eq, asc } from "drizzle-orm";
import type { DrizzleBunSqliteDatabase } from "../types";
import { permissionRequests, permissionDecisions } from "../schema";

export type PermissionRequestRow = typeof permissionRequests.$inferSelect;
export type PermissionRequestInsert = typeof permissionRequests.$inferInsert;

export type PermissionDecisionRow = typeof permissionDecisions.$inferSelect;
export type PermissionDecisionInsert = typeof permissionDecisions.$inferInsert;

export class PermissionRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  // Permission Requests
  findRequestById(id: string): PermissionRequestRow | undefined {
    const rows = this.db
      .select()
      .from(permissionRequests)
      .where(eq(permissionRequests.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listRequestsBySession(sessionId: string): PermissionRequestRow[] {
    return this.db
      .select()
      .from(permissionRequests)
      .where(eq(permissionRequests.sessionId, sessionId))
      .orderBy(asc(permissionRequests.createdAt))
      .all();
  }

  listRequestsByRun(runId: string): PermissionRequestRow[] {
    return this.db
      .select()
      .from(permissionRequests)
      .where(eq(permissionRequests.runId, runId))
      .orderBy(asc(permissionRequests.createdAt))
      .all();
  }

  listRequests(status?: string): PermissionRequestRow[] {
    if (status !== undefined) {
      return this.db
        .select()
        .from(permissionRequests)
        .where(eq(permissionRequests.status, status))
        .orderBy(asc(permissionRequests.createdAt))
        .all();
    }
    return this.db
      .select()
      .from(permissionRequests)
      .orderBy(asc(permissionRequests.createdAt))
      .all();
  }

  createRequest(data: PermissionRequestInsert): PermissionRequestRow {
    this.db.insert(permissionRequests).values(data).run();
    return this.findRequestById(data.id) as PermissionRequestRow;
  }

  updateRequest(
    id: string,
    data: Partial<Omit<PermissionRequestInsert, "id">>
  ): PermissionRequestRow | undefined {
    this.db
      .update(permissionRequests)
      .set(data)
      .where(eq(permissionRequests.id, id))
      .run();
    return this.findRequestById(id);
  }

  // Permission Decisions
  findDecisionById(id: string): PermissionDecisionRow | undefined {
    const rows = this.db
      .select()
      .from(permissionDecisions)
      .where(eq(permissionDecisions.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  listDecisionsByRequest(requestId: string): PermissionDecisionRow[] {
    return this.db
      .select()
      .from(permissionDecisions)
      .where(eq(permissionDecisions.requestId, requestId))
      .orderBy(asc(permissionDecisions.createdAt))
      .all();
  }

  createDecision(data: PermissionDecisionInsert): PermissionDecisionRow {
    this.db.insert(permissionDecisions).values(data).run();
    return this.findDecisionById(data.id) as PermissionDecisionRow;
  }
}
