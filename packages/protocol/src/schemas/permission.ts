import { z } from "zod/v4";
import { Timestamp, Ulid } from "./common";

export const RiskLevel = z.enum(["low", "medium", "high", "critical"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const PermissionRequestStatus = z.enum([
  "pending",
  "approved",
  "denied",
  "expired",
]);
export type PermissionRequestStatus = z.infer<typeof PermissionRequestStatus>;

export const PermissionDecisionValue = z.enum(["allow", "deny"]);
export type PermissionDecisionValue = z.infer<typeof PermissionDecisionValue>;

export const PermissionRequest = z.object({
  id: Ulid,
  sessionId: Ulid.optional(),
  runId: Ulid.optional(),
  toolCallId: Ulid.optional(),
  agentId: z.string().optional(),
  toolName: z.string(),
  riskLevel: RiskLevel,
  reason: z.string().optional(),
  targetPaths: z.array(z.string()).optional(),
  command: z.string().optional(),
  diffSummary: z.string().optional(),
  dryRunSummary: z.string().optional(),
  commandPreview: z.unknown().optional(),
  status: PermissionRequestStatus,
  createdAt: Timestamp,
  expiresAt: Timestamp.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PermissionRequest = z.infer<typeof PermissionRequest>;

export const PermissionDecision = z.object({
  id: Ulid,
  requestId: Ulid,
  decision: PermissionDecisionValue,
  decidedBy: z.string().optional(),
  scope: z.enum(["once", "session", "project"]).optional(),
  reason: z.string().optional(),
  createdAt: Timestamp,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type PermissionDecision = z.infer<typeof PermissionDecision>;

export const SubmitDecisionRequest = z.object({
  decision: PermissionDecisionValue,
  scope: z.enum(["once", "session", "project"]).optional(),
  reason: z.string().optional(),
});
export type SubmitDecisionRequest = z.infer<typeof SubmitDecisionRequest>;
