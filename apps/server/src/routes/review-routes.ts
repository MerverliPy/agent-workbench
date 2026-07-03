/**
 * Review routes — submit, list, and act on code review items.
 *
 * Phase 27: Enables collaborative code review within agent-workbench.
 *
 * POST   /session/:sessionId/review         — Submit code for review (auth required)
 * GET    /review/pending                     — List all pending reviews (auth required)
 * GET    /session/:sessionId/reviews         — List reviews for a session (auth required)
 * GET    /review/:reviewId                   — Get review details (auth required)
 * POST   /review/:reviewId/approve           — Approve a review (auth required)
 * POST   /review/:reviewId/reject            — Reject a review (auth required)
 * POST   /review/:reviewId/changes           — Request changes on a review (auth required)
 */

import { Scope } from "@agent-workbench/auth";
import type { SubmitReviewOptions } from "@agent-workbench/collab";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { requireScope } from "../middleware/auth-scope";
import { handleAppError } from "../middleware/error-handler";

export function registerReviewRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { reviewQueue, sessionRepository } = services;

  // ── POST /session/:sessionId/review — Submit for review ─────────────────
  app.post(
    "/session/:sessionId/review",
    requireScope(Scope.REVIEW_SUBMIT),
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

        const body = (await c.req.json().catch(() => ({}))) as {
          title?: string;
          description?: string;
          diffContent?: string;
          filePath?: string;
        };

        if (!body.title || !body.diffContent || !body.filePath) {
          return c.json(
            new ApiError({
              status: 400,
              code: "BAD_REQUEST",
              message: "Missing required fields: title, diffContent, filePath.",
              recoverable: true,
            }),
            400,
          );
        }

        const authContext = c.get("auth" as never) as
          | { subject?: string }
          | undefined;
        const submittedBy = authContext?.subject ?? "anonymous";

        const opts: SubmitReviewOptions = {
          title: body.title!,
          diffContent: body.diffContent!,
          filePath: body.filePath!,
          ...(body.description ? { description: body.description } : {}),
        };

        const item = reviewQueue.submit(sessionId, submittedBy, opts);

        return c.json(item, 201);
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "REVIEW_SUBMIT_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "REVIEW_SUBMIT_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );

  // ── GET /review/pending — List all pending reviews ──────────────────────
  app.get("/review/pending", async (c) => {
    try {
      const items = reviewQueue.listPending();
      return c.json({ items, count: items.length });
    } catch (err) {
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "REVIEW_LIST_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "REVIEW_LIST_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });

  // ── GET /session/:sessionId/reviews — List reviews for a session ────────
  app.get("/session/:sessionId/reviews", async (c) => {
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

      const items = reviewQueue.listBySession(sessionId);
      return c.json({ sessionId, items, count: items.length });
    } catch (err) {
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "REVIEW_LIST_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "REVIEW_LIST_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });

  // ── GET /review/:reviewId — Get review details ──────────────────────────
  app.get("/review/:reviewId", async (c) => {
    try {
      const reviewId = c.req.param("reviewId");
      const item = reviewQueue.get(reviewId);

      if (!item) {
        return c.json(
          new ApiError({
            status: 404,
            code: "NOT_FOUND",
            message: `Review not found: ${reviewId}`,
            recoverable: true,
          }),
          404,
        );
      }

      return c.json(item);
    } catch (err) {
      return handleAppError(
        err instanceof Error
          ? new ApiError({
              status: 500,
              code: "REVIEW_GET_FAILED",
              message: err.message,
              recoverable: false,
            })
          : new ApiError({
              status: 500,
              code: "REVIEW_GET_FAILED",
              message: "Unknown error",
              recoverable: false,
            }),
        c,
      );
    }
  });

  // ── POST /review/:reviewId/approve — Approve ────────────────────────────
  app.post(
    "/review/:reviewId/approve",
    requireScope(Scope.REVIEW_DECIDE),
    async (c) => {
      try {
        const reviewId = c.req.param("reviewId");
        const authContext = c.get("auth" as never) as
          | { subject?: string }
          | undefined;
        const reviewerId = authContext?.subject ?? "anonymous";

        const body = (await c.req.json().catch(() => ({}))) as {
          comment?: string;
        };

        const item = reviewQueue.approve(reviewId, reviewerId, body.comment);
        if (!item) {
          return c.json(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: `Review not found: ${reviewId}`,
              recoverable: true,
            }),
            404,
          );
        }

        return c.json(item);
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "REVIEW_APPROVE_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "REVIEW_APPROVE_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );

  // ── POST /review/:reviewId/reject — Reject ──────────────────────────────
  app.post(
    "/review/:reviewId/reject",
    requireScope(Scope.REVIEW_DECIDE),
    async (c) => {
      try {
        const reviewId = c.req.param("reviewId");
        const authContext = c.get("auth" as never) as
          | { subject?: string }
          | undefined;
        const reviewerId = authContext?.subject ?? "anonymous";

        const body = (await c.req.json().catch(() => ({}))) as {
          comment?: string;
        };

        const item = reviewQueue.reject(reviewId, reviewerId, body.comment);
        if (!item) {
          return c.json(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: `Review not found: ${reviewId}`,
              recoverable: true,
            }),
            404,
          );
        }

        return c.json(item);
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "REVIEW_REJECT_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "REVIEW_REJECT_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );

  // ── POST /review/:reviewId/changes — Request changes ────────────────────
  app.post(
    "/review/:reviewId/changes",
    requireScope(Scope.REVIEW_DECIDE),
    async (c) => {
      try {
        const reviewId = c.req.param("reviewId");
        const authContext = c.get("auth" as never) as
          | { subject?: string }
          | undefined;
        const reviewerId = authContext?.subject ?? "anonymous";

        const body = (await c.req.json().catch(() => ({}))) as {
          comment?: string;
        };

        if (!body.comment || body.comment.trim().length === 0) {
          return c.json(
            new ApiError({
              status: 400,
              code: "BAD_REQUEST",
              message: "Comment is required when requesting changes.",
              recoverable: true,
            }),
            400,
          );
        }

        const item = reviewQueue.requestChanges(
          reviewId,
          reviewerId,
          body.comment,
        );
        if (!item) {
          return c.json(
            new ApiError({
              status: 404,
              code: "NOT_FOUND",
              message: `Review not found: ${reviewId}`,
              recoverable: true,
            }),
            404,
          );
        }

        return c.json(item);
      } catch (err) {
        return handleAppError(
          err instanceof Error
            ? new ApiError({
                status: 500,
                code: "REVIEW_CHANGES_FAILED",
                message: err.message,
                recoverable: false,
              })
            : new ApiError({
                status: 500,
                code: "REVIEW_CHANGES_FAILED",
                message: "Unknown error",
                recoverable: false,
              }),
          c,
        );
      }
    },
  );
}
