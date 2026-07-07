/**
 * GDPR data subject rights endpoints.
 *
 * Phase 30: Right to Access (Art. 15) and Right to Erasure (Art. 17).
 *
 * GET  /data/export  — Export all personal data (sessions, messages, audit trail)
 * POST /data/delete  — Delete all personal data
 *
 * Uses database.repository methods for reads and raw SQLite for deletes
 * (repositories don't expose delete-by-session methods).
 */

import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { handleAppError } from "../middleware/error-handler";

export function registerDataRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const {
    sessionRepository,
    messageRepository,
    ledgerRepository,
    summaryRepository,
    planRepository,
    toolCallRepository,
    permissionRepository,
    workspaceRepository,
    rawDb,
  } = services;

  // ── GET /data/export — Right to Access (Art. 15) ─────────────────────────

  app.get("/data/export", async (c) => {
    try {
      const sessions = sessionRepository.list();
      const workspaces = workspaceRepository.list(true);

      // Gather child data per session
      const msgRows: Record<string, unknown>[] = [];
      const ledgerRows: Record<string, unknown>[] = [];
      const summaryRows: Record<string, unknown>[] = [];
      const planRows: Record<string, unknown>[] = [];
      const toolCallRows: Record<string, unknown>[] = [];

      for (const session of sessions) {
        msgRows.push(...messageRepository.listBySession(session.id));
        ledgerRows.push(...ledgerRepository.listBySession(session.id));
        summaryRows.push(...summaryRepository.listBySession(session.id));
        planRows.push(...planRepository.listBySession(session.id));
        toolCallRows.push(...toolCallRepository.listBySession(session.id));
      }

      // Permission requests (may not all have sessionIds)
      const allPermissionRequests = permissionRepository.listRequests();

      return c.json({
        exportedAt: new Date().toISOString(),
        data: {
          sessions,
          messages: msgRows,
          ledger: ledgerRows,
          summaries: summaryRows,
          plans: planRows,
          toolCalls: toolCallRows,
          permissionRequests: allPermissionRequests,
          workspaces,
        },
      });
    } catch (err) {
      return handleAppError(
        new ApiError({
          status: 500,
          code: "EXPORT_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to export data",
          recoverable: false,
        }),
        c,
      );
    }
  });

  // ── POST /data/delete — Right to Erasure (Art. 17) ──────────────────────

  app.post("/data/delete", async (c) => {
    try {
      // Delete in order: child tables first, then parent tables
      rawDb.run("DELETE FROM messages");
      rawDb.run("DELETE FROM tool_calls");
      rawDb.run("DELETE FROM plans");
      rawDb.run("DELETE FROM summaries");
      rawDb.run("DELETE FROM run_ledger");
      rawDb.run("DELETE FROM permission_decisions");
      rawDb.run("DELETE FROM permission_requests");
      rawDb.run("DELETE FROM sessions");
      rawDb.run("DELETE FROM workspaces");
      rawDb.run("DELETE FROM cache_entries");
      rawDb.run("DELETE FROM file_changes");
      rawDb.run("DELETE FROM config_snapshots");

      return c.json({
        deleted: true,
        deletedAt: new Date().toISOString(),
      });
    } catch (err) {
      return handleAppError(
        new ApiError({
          status: 500,
          code: "DELETE_FAILED",
          message:
            err instanceof Error
              ? err.message
              : "Failed to delete data",
          recoverable: false,
        }),
        c,
      );
    }
  });
}
