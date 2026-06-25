/**
 * Real Phase 8 permission route handlers.
 *
 * Replaces the 501 placeholders registered in placeholders.ts.
 *
 * Routes:
 *   GET  /permission/request            → list requests (optional status filter)
 *   GET  /permission/request/:requestId → get single request
 *   POST /permission/request/:requestId/decision → submit user decision
 *   GET  /permission/policy/effective   → return active policy summary
 *
 * The decision route is the critical Phase 8 path:
 *   1. Validates the decision body.
 *   2. Persists the PermissionDecision row.
 *   3. Updates the PermissionRequest status.
 *   4. Emits permission.decided SSE event.
 *   5. Records one permission.decided ledger entry.
 *   6. Calls permissionGate.resolve() to unblock the suspended core runtime.
 *
 * The route does NOT execute tools or compute permission policy.
 */

import { ulid } from "ulid";
import type { Hono } from "hono";
import {
  ListPermissionRequestsRoute,
  GetPermissionRequestRoute,
  DecidePermissionRoute,
  GetEffectivePolicyRoute,
} from "@agent-workbench/protocol";
import { EventName } from "@agent-workbench/events";
import type { EventEnvelope } from "@agent-workbench/protocol";
import { ApiError } from "../errors";
import type { ServerAppBindings, ServerServices } from "../context";
import { createJsonRouteHandler } from "./helpers";

type PermissionServices = Pick<
  ServerServices,
  | "permissionRepository"
  | "permissionGate"
  | "permissionEngine"
  | "eventBus"
  | "ledgerRepository"
>;

export function registerPermissionRoutes(
  app: Hono<ServerAppBindings>,
  services: PermissionServices
): void {
  const {
    permissionRepository,
    permissionGate,
    permissionEngine,
    eventBus,
    ledgerRepository,
  } = services;

  // GET /permission/request
  app.get(
    ListPermissionRequestsRoute.path,
    createJsonRouteHandler(
      ListPermissionRequestsRoute,
      (_ctx, { validated }) => {
        const query = validated.query as { status?: string };
        const rows = permissionRepository.listRequests(query.status);
        return { items: rows.map(rowToProtocolRequest) };
      }
    )
  );

  // GET /permission/request/:requestId
  app.get(
    GetPermissionRequestRoute.path,
    createJsonRouteHandler(
      GetPermissionRequestRoute,
      (_ctx, { validated }) => {
        const { requestId } = validated.pathParams as { requestId: string };
        const row = permissionRepository.findRequestById(requestId);
        if (row === undefined) {
          throw new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: `Permission request not found: ${requestId}`,
            recoverable: true,
          });
        }
        return rowToProtocolRequest(row);
      }
    )
  );

  // POST /permission/request/:requestId/decision
  app.post(
    DecidePermissionRoute.path,
    createJsonRouteHandler(
      DecidePermissionRoute,
      async (_ctx, { validated }) => {
        const { requestId } = validated.pathParams as { requestId: string };
        const body = validated.body as {
          decision: "allow" | "deny";
          scope?: "once" | "session" | "project";
          reason?: string;
        };

        // Validate the permission request exists.
        const requestRow = permissionRepository.findRequestById(requestId);
        if (requestRow === undefined) {
          throw new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: `Permission request not found: ${requestId}`,
            recoverable: true,
          });
        }

        // 409 if the request is already resolved.
        if (
          requestRow.status === "approved" ||
          requestRow.status === "denied" ||
          requestRow.status === "expired"
        ) {
          throw new ApiError({
            status: 409,
            code: "CONFLICT",
            message: `Permission request ${requestId} is already ${requestRow.status}.`,
            recoverable: false,
          });
        }

        const decisionId = ulid();
        const now = new Date().toISOString();

        // 1. Persist the decision.
        const decisionRow = permissionRepository.createDecision({
          id: decisionId,
          requestId,
          decision: body.decision,
          decidedBy: "user",
          scope: body.scope ?? null,
          reason: body.reason ?? null,
          createdAt: now,
          metadataJson: null,
        });

        // 2. Update the request status.
        const newStatus = body.decision === "allow" ? "approved" : "denied";
        permissionRepository.updateRequest(requestId, { status: newStatus });

        // 3. Emit permission.decided SSE event.
        const decidedEvent: EventEnvelope = {
          id: ulid(),
          type: EventName.PERMISSION_DECIDED,
          sessionId: requestRow.sessionId ?? undefined,
          runId: requestRow.runId ?? undefined,
          timestamp: now,
          payload: {
            requestId,
            decision: body.decision,
            decidedBy: "user",
          },
        };
        eventBus.publish(decidedEvent);

        // 4. Record one permission.decided ledger entry (the definitive record
        //    for user-submitted decisions). SessionRunner does not duplicate this.
        ledgerRepository.create({
          id: ulid(),
          // sessionId is notNull in the ledger schema; use fallback if missing.
          sessionId: requestRow.sessionId ?? "unknown",
          runId: requestRow.runId ?? null,
          eventType: "permission.decided",
          eventCategory: "permission",
          actor: "user",
          summary: `Permission decided by user: ${body.decision}`,
          payloadJson: JSON.stringify({
            requestId,
            decision: body.decision,
            decidedBy: "user",
            scope: body.scope,
          }),
          redactionStatus: "none",
          createdAt: now,
        });

        // 5. Resolve the gate — unblocks the suspended core runtime.
        // Returns false if the run was already aborted (safe to ignore).
        permissionGate.resolve(requestId, body.decision);

        return rowToProtocolDecision(decisionRow);
      }
    )
  );

  // GET /permission/policy/effective
  app.get(
    GetEffectivePolicyRoute.path,
    createJsonRouteHandler(GetEffectivePolicyRoute, () => {
      const policy = permissionEngine.getEffectivePolicy();
      return { policy: policy as unknown as Record<string, unknown> };
    })
  );
}

// ── Row → protocol mappers ────────────────────────────────────────────────────

function rowToProtocolRequest(
  row: import("@agent-workbench/storage").PermissionRequestRow
): import("@agent-workbench/protocol").PermissionRequest {
  return {
    id: row.id,
    sessionId: row.sessionId ?? undefined,
    runId: row.runId ?? undefined,
    toolCallId: row.toolCallId ?? undefined,
    agentId: row.agentId ?? undefined,
    toolName: row.toolName,
    riskLevel: row.riskLevel as import("@agent-workbench/protocol").RiskLevel,
    reason: row.reason ?? undefined,
    targetPaths: row.targetPathsJson
      ? (JSON.parse(row.targetPathsJson) as string[])
      : undefined,
    command: row.command ?? undefined,
    diffSummary: row.diffSummaryJson ?? undefined,
    dryRunSummary: row.dryRunSummaryJson ?? undefined,
    status: row.status as import("@agent-workbench/protocol").PermissionRequestStatus,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt ?? undefined,
  };
}

function rowToProtocolDecision(
  row: import("@agent-workbench/storage").PermissionDecisionRow
): import("@agent-workbench/protocol").PermissionDecision {
  return {
    id: row.id,
    requestId: row.requestId,
    decision: row.decision as import("@agent-workbench/protocol").PermissionDecisionValue,
    decidedBy: row.decidedBy ?? undefined,
    scope: row.scope as import("@agent-workbench/protocol").PermissionDecision["scope"],
    reason: row.reason ?? undefined,
    createdAt: row.createdAt,
  };
}
