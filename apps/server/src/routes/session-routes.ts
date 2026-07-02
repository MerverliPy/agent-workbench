import { ulid } from "ulid";
import type { Hono } from "hono";
import {
  CreateSessionRoute,
  GetSessionRoute,
  ListSessionsRoute,
  UpdateSessionRoute,
  AbortSessionRoute,
  SummarizeSessionRoute,
  DeleteSessionRoute,
} from "@agent-workbench/protocol";
import { RunLedger } from "@agent-workbench/core";
import { EventName } from "@agent-workbench/events";
import type { EventEnvelope } from "@agent-workbench/protocol";
import { ApiError } from "../errors";
import type { ServerAppBindings, ServerServices } from "../context";
import { createJsonRouteHandler } from "./helpers";

/**
 * Register real Phase 6 session routes.
 *
 * Handles create/list/get/update/abort/delete.
 * SummarizeSession remains unimplemented (Phase 12 token health).
 */
export function registerSessionRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices
): void {
  const { sessionRepository, sessionRunner } = services;

  // POST /session
  app.post(
    CreateSessionRoute.path,
    createJsonRouteHandler(CreateSessionRoute, async (_ctx, { validated }) => {
      const body = validated.body as { projectPath: string; title?: string };
      const now = new Date().toISOString();
      const id = ulid();
      const row = sessionRepository.create({
        id,
        projectPath: body.projectPath,
        title: body.title ?? null,
        activeAgent: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
        lastRunAt: null,
        metadataJson: null,
      });
      return rowToProtocol(row);
    })
  );

  // GET /session
  app.get(
    ListSessionsRoute.path,
    createJsonRouteHandler(ListSessionsRoute, (_ctx, { validated }) => {
      const query = validated.query as {
        status?: string;
        projectPath?: string;
        cursor?: string;
        limit?: number;
      };
      const rows = sessionRepository.listPaginated({
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.projectPath !== undefined
          ? { projectPath: query.projectPath }
          : {}),
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
      });
      const nextCursor =
        rows.length === query.limit ? rows[rows.length - 1]?.id : undefined;
      return { items: rows.map(rowToProtocol), nextCursor };
    })
  );

  // GET /session/:sessionId
  app.get(
    GetSessionRoute.path,
    createJsonRouteHandler(GetSessionRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const row = sessionRepository.findById(sessionId);
      if (row === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Session not found: ${sessionId}`,
          recoverable: true,
        });
      }
      return rowToProtocol(row);
    })
  );

  // PATCH /session/:sessionId
  app.patch(
    UpdateSessionRoute.path,
    createJsonRouteHandler(UpdateSessionRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const body = validated.body as {
        title?: string;
        activeAgent?: "build" | "plan";
        status?: string;
      };
      const existing = sessionRepository.findById(sessionId);
      if (existing === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Session not found: ${sessionId}`,
          recoverable: true,
        });
      }

      // Phase 11: capture previous agent before update for event/ledger.
      const previousAgentId = existing.activeAgent;
      const agentChanged =
        body.activeAgent !== undefined &&
        body.activeAgent !== existing.activeAgent;

      const updated = sessionRepository.update(sessionId, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.activeAgent !== undefined
          ? { activeAgent: body.activeAgent }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date().toISOString(),
      });
      if (updated === undefined) {
        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Failed to update session",
          recoverable: false,
        });
      }

      // Phase 11: emit and ledger after successful persistence.
      if (agentChanged && body.activeAgent !== undefined) {
        const agentProfile = services.agentRegistry.get(body.activeAgent);
        if (agentProfile !== undefined) {
          const now = new Date().toISOString();
          const event: EventEnvelope = {
            id: ulid(),
            type: EventName.AGENT_SELECTED,
            sessionId,
            runId: undefined,
            timestamp: now,
            payload: {
              agentId: body.activeAgent,
              previousAgentId: previousAgentId ?? null,
              promptVersion: agentProfile.promptVersion,
            },
          };
          services.eventBus.publish(event);

          const ledger = new RunLedger(
            services.ledgerRepository,
            sessionId,
            undefined
          );
          ledger.recordAgentSelected(body.activeAgent, agentProfile.promptVersion);
        }
      }

      return rowToProtocol(updated);
    })
  );

  // POST /session/:sessionId/abort
  app.post(
    AbortSessionRoute.path,
    createJsonRouteHandler(AbortSessionRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const existing = sessionRepository.findById(sessionId);
      if (existing === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Session not found: ${sessionId}`,
          recoverable: true,
        });
      }
      // Abort any active run for this session.
      sessionRunner.abort(sessionId);
      const updated = sessionRepository.update(sessionId, {
        status: "aborted",
        updatedAt: new Date().toISOString(),
      });
      return rowToProtocol(updated ?? existing);
    })
  );

  // POST /session/:sessionId/summarize — Phase 12
  app.post(
    SummarizeSessionRoute.path,
    createJsonRouteHandler(SummarizeSessionRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const result = services.sessionRunner.summarizeSession(sessionId);
      return result;
    })
  );

  // DELETE /session/:sessionId
  app.delete(
    DeleteSessionRoute.path,
    createJsonRouteHandler(DeleteSessionRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const existing = sessionRepository.findById(sessionId);
      if (existing === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Session not found: ${sessionId}`,
          recoverable: true,
        });
      }
      // Soft-delete via status update (no hard delete schema yet).
      sessionRepository.update(sessionId, {
        status: "deleted",
        updatedAt: new Date().toISOString(),
      });
      return { deleted: true };
    })
  );
}

/** Convert a storage session row to the protocol Session shape. */
function rowToProtocol(
  row: import("@agent-workbench/storage").SessionRow
): import("@agent-workbench/protocol").Session {
  return {
    id: row.id,
    projectPath: row.projectPath,
    title: row.title ?? undefined,
    activeAgent: (row.activeAgent as "build" | "plan" | undefined) ?? undefined,
    status: row.status as import("@agent-workbench/protocol").SessionStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt ?? undefined,
  };
}
