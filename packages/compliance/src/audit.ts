import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { ulid } from "ulid";
import type { DrizzleBunSqliteDatabase } from "@agent-workbench/storage";
import { auditEntries } from "@agent-workbench/storage";
import type { AuditEntry, AuditTrailOptions, IntegrityResult } from "./types";

const GENESIS_HASH = "0".repeat(64);

/**
 * Compute SHA-256 hash of an audit entry's content (excluding its own hash field).
 * Chain: SHA256(previousHash + sequence + action + actor + resource + detail + createdAt)
 */
function computeEntryHash(
  previousHash: string,
  sequence: number,
  action: string,
  actor: string,
  resource: string,
  detail: string | null,
  createdAt: string,
): string {
  const payload = `${previousHash}|${sequence}|${action}|${actor}|${resource}|${detail ?? ""}|${createdAt}`;
  return createHash("sha256")
    .update(payload, "utf-8")
    .digest("hex");
}

/**
 * Immutable audit trail with cryptographic hash chaining.
 *
 * Features:
 * - Append-only: entries cannot be deleted or modified through this API
 * - Hash chaining: each entry's hash depends on the previous entry
 * - Integrity verification: validates the entire chain
 * - Query by action, actor, resource, or time range
 *
 * @example
 * ```ts
 * const audit = new AuditTrail(db);
 * audit.record("session.create", "system", "sess_01", "Session created");
 * audit.record("session.delete", "user_admin", "sess_01", "Session deleted by admin");
 *
 * const ok = audit.verifyIntegrity();
 * console.log(ok.valid); // true if chain is intact
 * ```
 */
export class AuditTrail {
  private readonly db: DrizzleBunSqliteDatabase;
  private readonly options: Required<AuditTrailOptions>;

  constructor(
    db: DrizzleBunSqliteDatabase,
    options: AuditTrailOptions = {},
  ) {
    this.db = db;
    this.options = {
      enabled: options.enabled ?? true,
      actorFallback: options.actorFallback ?? "unknown",
    };
  }

  get enabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Record a new audit entry. Returns the created entry.
   * Throws if the audit trail is disabled.
   */
  record(
    action: string,
    actor: string,
    resource: string,
    detail?: string | null,
  ): AuditEntry {
    if (!this.options.enabled) {
      throw new Error(
        "Audit trail is disabled. Set AGENT_WORKBENCH_AUDIT_ENABLED=true to enable.",
      );
    }

    const id = ulid();
    const now = new Date().toISOString();
    const resolvedActor = actor || this.options.actorFallback;
    const resolvedDetail = detail ?? null;

    // Get the previous entry's hash and sequence number
    const lastEntry = this.db
      .select({ hash: auditEntries.hash, seq: auditEntries.sequence })
      .from(auditEntries)
      .orderBy(sql`${auditEntries.sequence} DESC`)
      .limit(1)
      .get();

    const previousHash = lastEntry?.hash ?? GENESIS_HASH;
    const sequence = (lastEntry?.seq ?? 0) + 1;

    const hash = computeEntryHash(
      previousHash,
      sequence,
      action,
      resolvedActor,
      resource,
      resolvedDetail,
      now,
    );

    this.db.insert(auditEntries).values({
      id,
      sequence,
      action,
      actor: resolvedActor,
      resource,
      detail: resolvedDetail,
      previousHash,
      hash,
      createdAt: now,
    }).run();

    return {
      id,
      sequence,
      action,
      actor: resolvedActor,
      resource,
      detail: resolvedDetail,
      previousHash,
      hash,
      createdAt: now,
    };
  }

  /**
   * Verify the integrity of the entire audit chain.
   * Returns valid=true if every entry's hash matches its recomputed hash
   * and the previous_hash chain links correctly.
   */
  verifyIntegrity(): IntegrityResult {
    const entries = this.db
      .select()
      .from(auditEntries)
      .orderBy(sql`${auditEntries.sequence} ASC`)
      .all();

    if (entries.length === 0) {
      return { valid: true, checked: 0, errors: [] };
    }

    const errors: string[] = [];
    const first = entries[0]!;

    if (first.sequence !== 1) {
      errors.push(
        `First entry (id=${first.id}) has sequence ${first.sequence}, expected 1`,
      );
    }
    if (first.previousHash !== GENESIS_HASH) {
      errors.push(
        `Genesis entry has previousHash=${first.previousHash.slice(0, 16)}..., expected ${GENESIS_HASH.slice(0, 16)}...`,
      );
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const expectedHash = computeEntryHash(
        entry.previousHash,
        entry.sequence,
        entry.action,
        entry.actor,
        entry.resource,
        entry.detail,
        entry.createdAt,
      );

      if (entry.hash !== expectedHash) {
        errors.push(
          `Entry ${entry.id} (seq=${entry.sequence}): hash mismatch`,
        );
      }

      if (i > 0) {
        const prev = entries[i - 1]!;
        if (entry.previousHash !== prev.hash) {
          errors.push(
            `Entry ${entry.id} (seq=${entry.sequence}): chain broken`,
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      checked: entries.length,
      errors,
    };
  }

  /** Query audit entries by action type. */
  findByAction(action: string, limit = 100): AuditEntry[] {
    return (this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.action, action))
      .orderBy(sql`${auditEntries.createdAt} DESC`)
      .limit(limit)
      .all() as unknown) as AuditEntry[];
  }

  /** Query audit entries by actor. */
  findByActor(actor: string, limit = 100): AuditEntry[] {
    return (this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.actor, actor))
      .orderBy(sql`${auditEntries.createdAt} DESC`)
      .limit(limit)
      .all() as unknown) as AuditEntry[];
  }

  /** Query audit entries by resource identifier. */
  findByResource(resource: string, limit = 100): AuditEntry[] {
    return (this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.resource, resource))
      .orderBy(sql`${auditEntries.createdAt} DESC`)
      .limit(limit)
      .all() as unknown) as AuditEntry[];
  }

  /** Query audit entries within a time range. */
  findByTimeRange(from: string, to: string, limit = 100): AuditEntry[] {
    return (this.db
      .select()
      .from(auditEntries)
      .where(
        sql`${auditEntries.createdAt} >= ${from} AND ${auditEntries.createdAt} <= ${to}`,
      )
      .orderBy(sql`${auditEntries.createdAt} DESC`)
      .limit(limit)
      .all() as unknown) as AuditEntry[];
  }

  /** Get the total number of entries in the audit log. */
  count(): number {
    const result = this.db
      .select({ count: sql<number>`count(*)` })
      .from(auditEntries)
      .get();
    return result?.count ?? 0;
  }
}
