import { and, asc, eq, isNull } from "drizzle-orm";
import { cacheEntries } from "../schema";
import type { DrizzleBunSqliteDatabase } from "../types";

export type CacheEntryRow = typeof cacheEntries.$inferSelect;
export type CacheEntryInsert = typeof cacheEntries.$inferInsert;

export class CacheRepository {
  constructor(private readonly db: DrizzleBunSqliteDatabase) {}

  findById(id: string): CacheEntryRow | undefined {
    const rows = this.db
      .select()
      .from(cacheEntries)
      .where(eq(cacheEntries.id, id))
      .limit(1)
      .all();
    return rows[0];
  }

  findByKey(
    sessionId: string,
    cacheType: string,
    cacheKey: string,
  ): CacheEntryRow | undefined {
    const rows = this.db
      .select()
      .from(cacheEntries)
      .where(
        and(
          eq(cacheEntries.sessionId, sessionId),
          eq(cacheEntries.cacheType, cacheType),
          eq(cacheEntries.cacheKey, cacheKey),
          isNull(cacheEntries.invalidatedAt),
        ),
      )
      .limit(1)
      .all();
    return rows[0];
  }

  listBySession(sessionId: string): CacheEntryRow[] {
    return this.db
      .select()
      .from(cacheEntries)
      .where(eq(cacheEntries.sessionId, sessionId))
      .orderBy(asc(cacheEntries.createdAt))
      .all();
  }

  create(data: CacheEntryInsert): CacheEntryRow {
    this.db.insert(cacheEntries).values(data).run();
    return this.findById(data.id) as CacheEntryRow;
  }

  invalidate(id: string): CacheEntryRow | undefined {
    this.db
      .update(cacheEntries)
      .set({ invalidatedAt: new Date().toISOString() })
      .where(eq(cacheEntries.id, id))
      .run();
    return this.findById(id);
  }

  /**
   * Return all non-invalidated cache entries for a session.
   * Used by ToolCache.invalidateAffectedByPath() to find entries
   * that reference a mutated file path.
   */
  listActiveBySession(sessionId: string): CacheEntryRow[] {
    return this.db
      .select()
      .from(cacheEntries)
      .where(
        and(
          eq(cacheEntries.sessionId, sessionId),
          isNull(cacheEntries.invalidatedAt),
        ),
      )
      .orderBy(asc(cacheEntries.createdAt))
      .all();
  }
}
