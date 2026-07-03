import {
  GetMessageRoute,
  ListMessagesRoute,
  SubmitMessageRoute,
} from "@agent-workbench/protocol";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

/**
 * Register real Phase 6 message routes.
 *
 * - SubmitMessage: runs the model/tool loop synchronously and returns the
 *   assistant message.
 * - ListMessages: returns all messages for a session.
 * - GetMessage: returns a single message by ID.
 */
export function registerMessageRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { sessionRunner, messageRepository, sessionRepository } = services;

  // POST /session/:sessionId/message
  app.post(
    SubmitMessageRoute.path,
    createJsonRouteHandler(SubmitMessageRoute, async (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const body = validated.body as { content: string };

      // Verify session exists.
      const session = sessionRepository.findById(sessionId);
      if (session === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Session not found: ${sessionId}`,
          recoverable: true,
        });
      }

      // Run the model/tool loop.
      // biome-ignore lint/suspicious/noImplicitAnyLet: type inferred across multiple code paths
      let result;
      try {
        result = await sessionRunner.run(sessionId, body.content);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown runner error";
        // Concurrency violation (active run) → 409
        if (message.includes("already has an active run")) {
          throw new ApiError({
            status: 409,
            code: "CONFLICT",
            message,
            recoverable: true,
          });
        }
        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message,
          recoverable: false,
        });
      }

      // Return the assistant message if one was produced.
      if (result.assistantMessageId !== undefined) {
        const msg = messageRepository.findById(result.assistantMessageId);
        if (msg !== undefined) {
          return rowToProtocol(msg);
        }
      }

      // Aborted or failed run with no assistant message.
      throw new ApiError({
        status: 500,
        code: "RUN_FAILED",
        message: result.error ?? `Run ${result.status} without a response`,
        recoverable: result.status === "aborted",
      });
    }),
  );

  // GET /session/:sessionId/message
  app.get(
    ListMessagesRoute.path,
    createJsonRouteHandler(ListMessagesRoute, (_ctx, { validated }) => {
      const { sessionId } = validated.pathParams as { sessionId: string };
      const session = sessionRepository.findById(sessionId);
      if (session === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Session not found: ${sessionId}`,
          recoverable: true,
        });
      }
      const rows = messageRepository.listBySession(sessionId);
      return { items: rows.map(rowToProtocol) };
    }),
  );

  // GET /session/:sessionId/message/:messageId
  app.get(
    GetMessageRoute.path,
    createJsonRouteHandler(GetMessageRoute, (_ctx, { validated }) => {
      const { messageId } = validated.pathParams as {
        sessionId: string;
        messageId: string;
      };
      const msg = messageRepository.findById(messageId);
      if (msg === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Message not found: ${messageId}`,
          recoverable: true,
        });
      }
      return rowToProtocol(msg);
    }),
  );
}

/** Convert a storage message row to the protocol Message shape. */
function rowToProtocol(
  row: import("@agent-workbench/storage").MessageRow,
): import("@agent-workbench/protocol").Message {
  return {
    id: row.id,
    sessionId: row.sessionId,
    runId: row.runId ?? undefined,
    role: row.role as import("@agent-workbench/protocol").MessageRole,
    content: row.content,
    contentFormat:
      (row.contentFormat as import("@agent-workbench/protocol").ContentFormat) ??
      "text",
    parentMessageId: row.parentMessageId ?? undefined,
    createdAt: row.createdAt,
    tokenCount: row.tokenCount ?? undefined,
  };
}
