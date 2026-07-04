/**
 * Type definitions for the @agent-workbench/compliance package.
 */

export interface AuditEntry {
  id: string;
  sequence: number;
  action: string;
  actor: string;
  resource: string;
  detail: string | null;
  previousHash: string;
  hash: string;
  createdAt: string;
}

export interface AuditTrailOptions {
  /** Enable/disable audit trail recording (default: true) */
  enabled?: boolean;
  /** Fallback actor name when no actor is specified (default: "unknown") */
  actorFallback?: string;
}

export interface IntegrityResult {
  valid: boolean;
  checked: number;
  errors: string[];
}

export interface DataRetentionOptions {
  /** Number of days to retain sessions and related data (default: 90) */
  retentionDays?: number;
  /** Whether to also purge audit entries for deleted sessions (default: false) */
  purgeAuditEntries?: boolean;
}

export interface RetentionResult {
  sessionsDeleted: number;
  messagesDeleted: number;
  toolCallsDeleted: number;
  runLedgerDeleted: number;
  auditEntriesDeleted: number;
  errors: string[];
}

/** PII scanner types */
export type { PIIPattern, PIIPatternType, PIISeverity, PIIMatch, ScanResult, PIIScannerOptions } from "./pii-scanner";
/** Air-gap types */
export type { AirgapOptions, AirgapCheckResult } from "./airgap";
/** FIPS types */
export type { FipsComplianceStatus, FipsComplianceIssue, CryptoCheckResult } from "./fips";
