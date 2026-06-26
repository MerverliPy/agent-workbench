import type { Hono } from "hono";
import {
  ListPlansRoute,
  GetPlanRoute,
  DecidePlanRoute,
} from "@agent-workbench/protocol";
import type { Plan } from "@agent-workbench/protocol";
import { ApiError } from "../errors";
import type { ServerAppBindings, ServerServices } from "../context";
import { createJsonRouteHandler } from "./helpers";

type PlanServices = Pick<
  ServerServices,
  "planRepository" | "permissionGate"
>;

function rowToPlan(
  row: import("@agent-workbench/storage").PlanRow
): Plan {
  return {
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId ?? undefined,
    status: row.status as Plan["status"],
    summary: row.summary,
    riskLevel: row.riskLevel as Plan["riskLevel"],
    steps: JSON.parse(row.stepsJson) as Plan["steps"],
    targetFiles: JSON.parse(row.targetFilesJson) as Plan["targetFiles"],
    permissionRequestId: row.permissionRequestId ?? undefined,
    approvalPolicy: row.approvalPolicy as Plan["approvalPolicy"],
    createdAt: row.createdAt,
    approvedAt: row.approvedAt ?? undefined,
    completedAt: row.completedAt ?? undefined,
  };
}

export function registerPlanRoutes(
  app: Hono<ServerAppBindings>,
  services: PlanServices
): void {
  const { planRepository, permissionGate } = services;

  app.get(
    ListPlansRoute.path,
    createJsonRouteHandler(ListPlansRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const rows = planRepository.listBySession(sessionId);
      return { items: rows.map(rowToPlan) };
    })
  );

  app.get(
    GetPlanRoute.path,
    createJsonRouteHandler(GetPlanRoute, (_ctx, { validated }) => {
      const { planId } = validated.pathParams as { planId: string };
      const row = planRepository.findById(planId);
      if (row === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Plan not found: ${planId}`,
          recoverable: true,
        });
      }
      return rowToPlan(row);
    })
  );

  app.post(
    DecidePlanRoute.path,
    createJsonRouteHandler(DecidePlanRoute, async (_ctx, { validated }) => {
      const { planId } = validated.pathParams as { planId: string };
      const body = validated.body as {
        decision: "approve" | "deny";
        reason?: string;
      };

      const planRow = planRepository.findById(planId);
      if (planRow === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Plan not found: ${planId}`,
          recoverable: true,
        });
      }

      if (planRow.status !== "pending") {
        throw new ApiError({
          status: 409,
          code: "CONFLICT",
          message: `Plan ${planId} is already ${planRow.status}.`,
          recoverable: false,
        });
      }

      const now = new Date().toISOString();
      const permReqId = planRow.permissionRequestId;

      const newStatus = body.decision === "approve" ? "approved" : "denied";
      planRepository.update(planId, {
        status: newStatus,
        ...(body.decision === "approve" ? { approvedAt: now } : {}),
      });

      if (permReqId !== null) {
        permissionGate.resolve(
          permReqId,
          body.decision === "approve" ? "allow" : "deny"
        );
      }

      const updatedRow = planRepository.findById(planId);
      if (updatedRow === undefined) {
        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Failed to read back plan after update.",
          recoverable: false,
        });
      }
      return rowToPlan(updatedRow);
    })
  );
}
