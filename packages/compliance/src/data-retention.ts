import type { DrizzleBunSqliteDatabase } from "@agent-workbench/storage";
import type { DataRetentionOptions, RetentionResult } from "./types";

const DEFAULT_RETENTION_DAYS = 90;

/**
 * Data retention policy: auto-delete sessions and associated data
 * older than a configurable number of days.
 *
 * Retention applies to:
 * - Sessions
 * - Messages within expired sessions
 * - Tool calls within expired sessions
 * - Run ledger entries within expired sessions
 * - Optionally, audit entries referencing expired sessions
 */
export class DataRetention {
  private readonly db: DrizzleBunSqliteDatabase;
  private readonly options: Required<DataRetentionOptions>;

  constructor(
    db: DrizzleBunSqliteDatabase,
    options: DataRetentionOptions = {},
  ) {
    this.db = db;
    this.options = {
      retentionDays: options.retentionDays ?? DEFAULT_RETENTION_DAYS,
      purgeAuditEntries: options.purgeAuditEntries ?? false,
    };
  }

  get retentionDays(): number {
    return this.options.retentionDays;
  }

  private getCutoffDate(): string {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.options.retentionDays);
    return cutoff.toISOString();
  }

  /**
   * Count rows before deletion to return meaningful stats.
   * Uses raw SQL via the underlying bun:sqlite database handle
   * to access the `changes` property from run().
   */
  cleanup(): RetentionResult {
    const cutoff = this.getCutoffDate();
    const errors: string[] = [];

    try {
      // Access the underlying bun:sqlite Database directly
      const sqliteDb = (this.db as unknown as { session: { db: import("bun:sqlite").Database } }).session.db;

      // Count before deletion
      const countStmt = (table: string, where: string): number => {
        const row = sqliteDb
          .prepare(`SELECT COUNT(*) as cnt FROM ${table} WHERE ${where}`)
          .get() as { cnt: number } | null;
        return row?.cnt ?? 0;
      };

      const msgBefore = countStmt("messages", `session_id IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`);
      const tcBefore = countStmt("tool_calls", `session_id IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`);
      const rlBefore = countStmt("run_ledger", `session_id IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`);
      const sessBefore = countStmt("sessions", `created_at < '${cutoff}'`);
      let auditBefore = 0;
      if (this.options.purgeAuditEntries) {
        auditBefore = countStmt("audit_entries", `resource IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`)
          + countStmt("audit_entries", `resource IN (SELECT 'session:' || id FROM sessions WHERE created_at < '${cutoff}')`);
      }

      if (sessBefore === 0) {
        return { sessionsDeleted: 0, messagesDeleted: 0, toolCallsDeleted: 0, runLedgerDeleted: 0, auditEntriesDeleted: 0, errors: [] };
      }

      // Delete with raw SQL via bun:sqlite
      const runRaw = (sql: string): number => {
        const result = sqliteDb.run(sql);
        return Number(result.changes);
      };

      const messagesDeleted = runRaw(`DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`);
      const toolCallsDeleted = runRaw(`DELETE FROM tool_calls WHERE session_id IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`);
      const runLedgerDeleted = runRaw(`DELETE FROM run_ledger WHERE session_id IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`);

      let auditEntriesDeleted = 0;
      if (this.options.purgeAuditEntries) {
        auditEntriesDeleted = runRaw(`DELETE FROM audit_entries WHERE resource IN (SELECT id FROM sessions WHERE created_at < '${cutoff}')`)
          + runRaw(`DELETE FROM audit_entries WHERE resource IN (SELECT 'session:' || id FROM sessions WHERE created_at < '${cutoff}')`);
      }

      const sessionsDeleted = runRaw(`DELETE FROM sessions WHERE created_at < '${cutoff}'`);

      return {
        sessionsDeleted,
        messagesDeleted,
        toolCallsDeleted,
        runLedgerDeleted,
        auditEntriesDeleted,
        errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Retention cleanup failed: ${msg}`);
      return { sessionsDeleted: 0, messagesDeleted: 0, toolCallsDeleted: 0, runLedgerDeleted: 0, auditEntriesDeleted: 0, errors };
    }
  }
}
