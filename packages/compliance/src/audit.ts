import { createHash, randomUUID } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** Unique entry identifier */
  id: string;
  /** ISO 8601 timestamp of the event */
  timestamp: string;
  /** Who performed the action: user ID, agent ID, or "system" */
  actor: string;
  /** The action performed (e.g., "session.created", "permission.decided") */
  action: string;
  /** Optional resource path or identifier */
  resource?: string;
  /** Optional free-form metadata */
  details?: Record<string, unknown>;
  /** SHA-256 hex digest of the previous entry (empty string for genesis) */
  previousHash: string;
  /** SHA-256 hex digest of this entry */
  hash: string;
}

/**
 * Compute the SHA-256 hash for an audit entry (excluding the hash field).
 * The hash covers: timestamp, actor, action, resource, details, and previousHash.
 */
export function computeHash(entry: Omit<AuditEntry, "hash">): string {
  const payload = JSON.stringify({
    t: entry.timestamp,
    a: entry.actor,
    n: entry.action,
    r: entry.resource ?? null,
    d: entry.details ?? null,
    p: entry.previousHash,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// ── Audit Trail ─────────────────────────────────────────────────────────────

export type AuditQuery = {
  actor?: string;
  action?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
};

export class AuditTrail {
  private entries: AuditEntry[] = [];

  /** Append a new entry to the trail. Returns the fully populated entry. */
  append(
    input: Omit<AuditEntry, "id" | "timestamp" | "previousHash" | "hash">,
  ): AuditEntry {
    const previousHash =
      this.entries.length > 0
        ? this.entries[this.entries.length - 1]!.hash
        : "";

    const entry: Omit<AuditEntry, "hash"> = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...input,
      previousHash,
    };

    const full: AuditEntry = {
      ...entry,
      hash: computeHash(entry),
    };

    this.entries.push(full);
    return full;
  }

  /**
   * Verify the integrity of the entire chain.
   * Returns `{ valid: true }` or `{ valid: false, message, brokenIndex }`.
   */
  verify():
    | { valid: true }
    | { valid: false; message: string; brokenIndex: number } {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;

      // Verify the previousHash link
      if (i === 0) {
        if (entry.previousHash !== "") {
          return {
            valid: false,
            message: `Genesis entry (index 0) has non-empty previousHash`,
            brokenIndex: i,
          };
        }
      } else {
        const prev = this.entries[i - 1]!;
        if (entry.previousHash !== prev.hash) {
          return {
            valid: false,
            message: `Entry ${i} previousHash does not match entry ${i - 1} hash`,
            brokenIndex: i,
          };
        }
      }

      // Verify this entry's hash
      const { hash: _, ...rest } = entry;
      const expectedHash = computeHash(rest);
      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          message: `Entry ${i} hash mismatch — content was tampered`,
          brokenIndex: i,
        };
      }
    }

    return { valid: true };
  }

  /** Query entries by actor, action, time range. */
  query(filters: AuditQuery = {}): AuditEntry[] {
    let results = [...this.entries];

    if (filters.actor) {
      results = results.filter((e) => e.actor === filters.actor);
    }
    if (filters.action) {
      results = results.filter((e) => e.action === filters.action);
    }
    if (filters.since) {
      results = results.filter((e) => e.timestamp >= filters.since!);
    }
    if (filters.until) {
      results = results.filter((e) => e.timestamp <= filters.until!);
    }

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  /** Return all entries (for export / persistence). */
  all(): readonly AuditEntry[] {
    return this.entries;
  }

  /** Load entries from a serialized array (for persistence restore). */
  load(entries: AuditEntry[]): void {
    this.entries = [...entries];
  }

  /** Total number of entries. */
  get size(): number {
    return this.entries.length;
  }
}
