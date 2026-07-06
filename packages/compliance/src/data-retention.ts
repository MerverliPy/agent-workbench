import type { AuditEntry } from "./audit";

export type RetentionPolicy = {
  /** Maximum age in days before entries are eligible for deletion */
  maxAgeDays: number;
  /** Specific actions to exempt from the policy (never auto-delete) */
  exemptActions?: string[];
};

export type RetentionResult = {
  deletedCount: number;
  retainedCount: number;
  /** The cutoff date that was applied */
  cutoffDate: string;
};

const DEFAULT_POLICY: RetentionPolicy = {
  maxAgeDays: 90,
};

/**
 * Apply a retention policy to an array of audit entries.
 * Returns entries that should be retained and the count of those removed.
 */
export function applyRetention(
  entries: AuditEntry[],
  policy: RetentionPolicy = DEFAULT_POLICY,
): { retained: AuditEntry[]; result: RetentionResult } {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - policy.maxAgeDays);
  const cutoffDate = cutoff.toISOString();

  const exempt = new Set(policy.exemptActions ?? []);

  const retained: AuditEntry[] = [];
  let deletedCount = 0;

  for (const entry of entries) {
    if (exempt.has(entry.action)) {
      retained.push(entry);
    } else if (entry.timestamp >= cutoffDate) {
      retained.push(entry);
    } else {
      deletedCount++;
    }
  }

  return {
    retained,
    result: {
      deletedCount,
      retainedCount: retained.length,
      cutoffDate,
    },
  };
}

/**
 * Merge two arrays of audit entries, deduplicating by `id`.
 * Useful for restoring from multiple snapshots.
 */
export function mergeEntries(
  ...batches: AuditEntry[][]
): AuditEntry[] {
  const seen = new Set<string>();
  const result: AuditEntry[] = [];

  for (const batch of batches) {
    for (const entry of batch) {
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        result.push(entry);
      }
    }
  }

  // Sort by timestamp for chain integrity
  result.sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp),
  );

  return result;
}
