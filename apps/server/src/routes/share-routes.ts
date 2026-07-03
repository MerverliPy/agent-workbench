/**
 * Share routes — generate, access, and revoke session share links.
 *
 * Phase 27: Enables view-only session sharing via time-limited tokens.
 *
 * POST   /session/:sessionId/share        — Generate a share link (auth required)
 * GET    /share/:token                     — Access a shared session (public)
 * GET    /session/:sessionId/shares        — List active shares (auth required)
 * DELETE /share/:token                     — Revoke a share (auth required)
 */

import { Scope } from "@agent-workbench/auth";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { requireScope } from "../middleware/auth-scope";
import { handleAppError } from "../middleware/error-handler";

export function registerShareRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const {
    shareManager,
    sessionRepository,
    messageRepository,
    toolCallRepository,
  } = services;

  // Helpers for building repos
  const _repos = {
    sessionRepository,
    messageRepository,
    toolCallRepository,
    permissionRepository: services.permissionRepository,
    ledgerRepository: services.ledgerRepository,
    summaryRepository: services.summaryRepository,
  };

  // ── POST /session/:sessionId/share — Generate share link ────────────────
  app.post(
    "/session/:sessionId/share",
    requireScope(Scope.SHARE_CREATE),
    async (c) => {
      try {
        const sessionId = c.req.param("sessionId");

        // Verify the session exists
        const session = sessionRepository.findById(sessionId);
        if (!session) {
          return c.json(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: `Session not found: ${sessionId}`,
              recoverable: true,
            }),
            404,
          );
        }

        const body = (await c.req.json().catch(() => ({}))) as {
          label?: string;
          expiresInMs?: number;
        };
        const authContext = c.get("auth" as never) as
          | { subject?: string }
          | undefined;
        const createdBy = authContext?.subject ?? "anonymous";

        const options: Record<string, unknown> = {};
        if (body.label !== undefined) options.label = body.label;
        if (body.expiresInMs !== undefined)
          options.expiresInMs = body.expiresInMs;

        const result = shareManager.create(sessionId, createdBy, options);

        return c.json(result, 201);
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "SHARE_CREATE_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "SHARE_CREATE_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );

  // ── GET /share/:token — Access a shared session ─────────────────────────
  app.get("/share/:token", async (c) => {
    try {
      const token = c.req.param("token");
      const result = shareManager.validate(token);

      if (!result) {
        return c.json(
          new ApiError({
            status: 404,
            code: "SHARE_NOT_FOUND",
            message: "Share link is invalid, expired, or has been revoked.",
            recoverable: true,
          }),
          404,
        );
      }

      // Return view-only session data (messages + metadata, no tool outputs)
      const session = sessionRepository.findById(result.sessionId);
      if (!session) {
        return c.json(
          new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: "Session not found.",
            recoverable: true,
          }),
          404,
        );
      }

      const messages = messageRepository.listBySession(result.sessionId);
      const toolCalls = toolCallRepository.listBySession(result.sessionId);

      return c.json({
        share: {
          label: result.label,
          expiresAt: result.expiresAt,
        },
        session: {
          id: session.id,
          projectPath: session.projectPath,
          title: session.title,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        messages: messages
          .filter((m) => m.role !== "summary")
          .map((m) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
        toolCalls: toolCalls.map((tc) => ({
          toolName: tc.toolName,
          status: tc.status,
          createdAt: tc.startedAt ?? tc.completedAt ?? "",
        })),
        // View-only: no tool output content, no permission decisions
      });
    } catch (err) {
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "SHARE_ACCESS_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "SHARE_ACCESS_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });

  // ── GET /session/:sessionId/shares — List active shares ─────────────────
  app.get(
    "/session/:sessionId/shares",
    requireScope(Scope.SHARE_READ),
    async (c) => {
      try {
        const sessionId = c.req.param("sessionId");

        const session = sessionRepository.findById(sessionId);
        if (!session) {
          return c.json(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: `Session not found: ${sessionId}`,
              recoverable: true,
            }),
            404,
          );
        }

        const shares = shareManager.listBySession(sessionId);
        return c.json({ sessionId, shares });
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "SHARE_LIST_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "SHARE_LIST_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );

  // ── DELETE /share/:token — Revoke a share ───────────────────────────────
  app.delete("/share/:token", requireScope(Scope.SHARE_CREATE), async (c) => {
    try {
      const token = c.req.param("token");
      const record = shareManager.get(token);

      if (!record) {
        return c.json(
          new ApiError({
            status: 404,
            code: "SHARE_NOT_FOUND",
            message: "Share token not found.",
            recoverable: true,
          }),
          404,
        );
      }

      shareManager.revoke(token);
      return c.json({
        message: "Share revoked.",
        token,
        sessionId: record.sessionId,
      });
    } catch (err) {
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "SHARE_REVOKE_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "SHARE_REVOKE_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });

  // ── GET /session/:sessionId/presence — Active users ──────────────────────
  app.get(
    "/session/:sessionId/presence",
    requireScope(Scope.PRESENCE_READ),
    async (c) => {
      try {
        const sessionId = c.req.param("sessionId");

        const session = services.sessionRepository.findById(sessionId);
        if (!session) {
          return c.json(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: `Session not found: ${sessionId}`,
              recoverable: true,
            }),
            404,
          );
        }

        const presence = services.presenceManager.getPresence(sessionId);
        return c.json(presence);
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "PRESENCE_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "PRESENCE_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );
}
