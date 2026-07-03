import { z } from "zod/v4";
import { Timestamp, Ulid } from "./common";
import { RiskLevel } from "./permission";

export const PlanStatus = z.enum([
  "draft",
  "pending",
  "approved",
  "denied",
  "executing",
  "completed",
  "failed",
]);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const PlanStepType = z.enum([
  "read",
  "shell",
  "write",
  "edit",
  "patch",
  "delete",
  "other",
]);
export type PlanStepType = z.infer<typeof PlanStepType>;

export const PlanStep = z.object({
  order: z.number().int().nonnegative(),
  type: PlanStepType,
  description: z.string(),
  targetPath: z.string().optional(),
  command: z.string().optional(),
  isRisky: z.boolean(),
  riskLevel: RiskLevel.optional(),
});
export type PlanStep = z.infer<typeof PlanStep>;

export const Plan = z.object({
  id: Ulid,
  sessionId: Ulid,
  runId: Ulid.optional(),
  status: PlanStatus,
  summary: z.string(),
  riskLevel: RiskLevel,
  steps: z.array(PlanStep),
  targetFiles: z.array(z.string()),
  permissionRequestId: Ulid.optional(),
  approvalPolicy: z.enum(["auto", "ask", "deny"]).optional(),
  createdAt: Timestamp,
  approvedAt: Timestamp.optional(),
  completedAt: Timestamp.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Plan = z.infer<typeof Plan>;

export const PlanListResponse = z.object({
  items: z.array(Plan),
});
export type PlanListResponse = z.infer<typeof PlanListResponse>;

export const PlanDecision = z.enum(["approve", "deny"]);
export type PlanDecision = z.infer<typeof PlanDecision>;

export const SubmitPlanDecisionRequest = z.object({
  decision: PlanDecision,
  reason: z.string().optional(),
});
export type SubmitPlanDecisionRequest = z.infer<
  typeof SubmitPlanDecisionRequest
>;
