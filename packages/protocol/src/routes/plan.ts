import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { Plan, PlanListResponse, PlanDecision } from "../schemas/plan";
import { SessionIdParams } from "./session";

export const PlanIdParams = z.object({
  planId: z.string().min(1),
});

export const ListPlansRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/plan",
  pathParams: SessionIdParams,
  response: PlanListResponse,
  errors: [ErrorEnvelope],
} as const;

export const GetPlanRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/plan/:planId",
  pathParams: z.object({
    sessionId: z.string().min(1),
    planId: z.string().min(1),
  }),
  response: Plan,
  errors: [ErrorEnvelope],
} as const;

export const DecidePlanRoute = {
  method: "POST" as const,
  path: "/session/:sessionId/plan/:planId/decision",
  pathParams: z.object({
    sessionId: z.string().min(1),
    planId: z.string().min(1),
  }),
  body: z.object({
    decision: PlanDecision,
    reason: z.string().optional(),
  }),
  response: Plan,
  errors: [ErrorEnvelope],
} as const;
