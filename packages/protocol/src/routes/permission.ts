import { z } from "zod/v4";
import { Ulid } from "../schemas/common";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { PermissionRequest, PermissionDecision, SubmitDecisionRequest } from "../schemas/permission";

export const PermissionRequestListParams = z.object({
  status: z.string().optional(),
});

export const ListPermissionRequestsRoute = {
  method: "GET" as const,
  path: "/permission/request",
  params: PermissionRequestListParams,
  response: z.object({ items: z.array(PermissionRequest) }),
  errors: [ErrorEnvelope],
} as const;

export const GetPermissionRequestRoute = {
  method: "GET" as const,
  path: "/permission/request/:requestId",
  response: PermissionRequest,
  errors: [ErrorEnvelope],
} as const;

export const DecidePermissionRoute = {
  method: "POST" as const,
  path: "/permission/request/:requestId/decision",
  body: SubmitDecisionRequest,
  response: PermissionDecision,
  errors: [ErrorEnvelope],
} as const;

export const GetEffectivePolicyRoute = {
  method: "GET" as const,
  path: "/permission/policy/effective",
  response: z.object({ policy: z.record(z.string(), z.unknown()) }),
  errors: [ErrorEnvelope],
} as const;
