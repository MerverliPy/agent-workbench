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
      };
      let rows = sessionRepository.list();
      if (query.status !== undefined) {
        rows = rows.filter((r) => r.status === query.status);
      }
      if (query.projectPath !== undefined) {
        rows = rows.filter((r) => r.projectPath === query.projectPath);
      }
      return { items: rows.map(rowToProtocol) };
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
        activeAgent?: string;
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
  app.post(SummarizeSessionRoute.path, async (ctx) => {
    throw new ApiError({
      status: 501,
      code: "NOT_IMPLEMENTED",
      message: "session.summarize is not implemented (Phase 12)",
      recoverable: true,
    });
  });

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
    activeAgent: row.activeAgent ?? undefined,
    status: row.status as import("@agent-workbench/protocol").SessionStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastRunAt: row.lastRunAt ?? undefined,
  };
}
