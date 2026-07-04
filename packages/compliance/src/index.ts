/**
 * @agent-workbench/compliance — Phase 30: Enterprise Readiness & Compliance
 *
 * Enterprise compliance features: immutable audit trail with cryptographic
 * hash chaining, configurable data retention policies, and compliance helpers.
 *
 * ## Usage
 *
 * ```ts
 * import { AuditTrail, DataRetention } from "@agent-workbench/compliance";
 * import { createDb } from "@agent-workbench/storage";
 *
 * const db = createDb();
 * const audit = new AuditTrail(db);
 * await audit.record("session.create", "system", "sess_01", "New session created");
 *
 * const retention = new DataRetention(db, { retentionDays: 30 });
 * const result = retention.cleanup();
 * console.log(`Deleted ${result.sessionsDeleted} old sessions`);
 * ```
 *
 * ## Environment Variables
 *
 * | Variable | Default | Description |
 * |----------|---------|-------------|
 * | `AGENT_WORKBENCH_AUDIT_ENABLED` | `true` | Enable/disable audit trail recording |
 * | `AGENT_WORKBENCH_RETENTION_DAYS` | `90` | Session retention period in days |
 */
export { AuditTrail } from "./audit";
export { DataRetention } from "./data-retention";
export { PIIScanner } from "./pii-scanner";
export { AirgapEnforcer } from "./airgap";
export { FipsCompliance } from "./fips";
export type {
  AuditEntry,
  AuditTrailOptions,
  IntegrityResult,
  DataRetentionOptions,
  RetentionResult,
  PIIPattern,
  PIIPatternType,
  PIISeverity,
  PIIMatch,
  ScanResult,
  PIIScannerOptions,
} from "./types";
