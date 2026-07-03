/**
 * Collab routes — session export/import endpoints.
 *
 * Phase 27: Export a full session to JSON and import from a JSON file.
 *
 * GET  /session/:sessionId/export   — Export session as JSON
 * POST /session/import              — Import session from JSON body
 */

import { exportSession, importSession } from "@agent-workbench/collab";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { handleAppError } from "../middleware/error-handler";

export function registerCollabRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const repos = {
    sessionRepository: services.sessionRepository,
    messageRepository: services.messageRepository,
    toolCallRepository: services.toolCallRepository,
    permissionRepository: services.permissionRepository,
    ledgerRepository: services.ledgerRepository,
    summaryRepository: services.summaryRepository,
  };

  // ── GET /session/:sessionId/export — Export session ─────────────────────
  app.get("/session/:sessionId/export", async (c) => {
    try {
      const sessionId = c.req.param("sessionId");
      const includeToolOutputs = c.req.query("includeToolOutputs") !== "false";
      const maxLen = Number(c.req.query("maxToolOutputLength")) || 5000;

      const data = await exportSession(sessionId, repos, {
        includeToolOutputs,
        maxToolOutputLength: Math.min(maxLen, 50000),
      });

      c.header(
        "Content-Disposition",
        `attachment; filename="session-${sessionId.slice(0, 8)}.json"`,
      );
      return c.json(data);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Session not found")) {
        return c.json(
          new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: err.message,
            recoverable: true,
          }),
          404,
        );
      }
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "EXPORT_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "EXPORT_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });

  // ── POST /session/import — Import session from JSON ────────────────────
  app.post("/session/import", async (c) => {
    try {
      const body = await c.req.json();
      if (!body?.formatVersion || !body.session) {
        return c.json(
          new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message:
              "Invalid session export format. Must include formatVersion and session.",
            recoverable: true,
          }),
          400,
        );
      }

      const newId = await importSession(body, repos);
      return c.json({ id: newId, message: "Session imported successfully." });
    } catch (err) {
      if (err instanceof SyntaxError) {
        return c.json(
          new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message: "Invalid JSON body.",
            recoverable: true,
          }),
          400,
        );
      }
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "IMPORT_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "IMPORT_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });
}
