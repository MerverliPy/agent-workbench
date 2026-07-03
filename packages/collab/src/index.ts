/**
 * @agent-workbench/collab — Session sharing and collaboration.
 *
 * Phase 27: Provides session export/import for sharing and backup.
 *
 * ## Usage
 *
 * ```ts
 * import { exportSession, importSession } from "@agent-workbench/collab";
 *
 * // Export a session to JSON
 * const data = await exportSession(sessionId, repos);
 * fs.writeFileSync("session-backup.json", JSON.stringify(data, null, 2));
 *
 * // Import a session from JSON
 * const raw = fs.readFileSync("session-backup.json", "utf-8");
 * const newId = await importSession(JSON.parse(raw), repos);
 * ```
 */

export type { EnterSessionOptions, SessionPresence } from "./presence";
export { PresenceManager } from "./presence";
export type {
  ReviewItem,
  ReviewStatus,
  SubmitReviewOptions,
} from "./review-queue";
export { ReviewQueue } from "./review-queue";
export type {
  ExportedLedgerEntry,
  ExportedMessage,
  ExportedPermission,
  ExportedToolCall,
  ExportOptions,
  Repositories,
  SessionExport,
} from "./session-export";
export { exportSession, importSession } from "./session-export";
export type {
  CreateShareOptions,
  ShareRecord,
  ShareResult,
} from "./share-manager";
export { ShareManager } from "./share-manager";
export type {
  JoinSessionOptions,
  SharedSessionRole,
  SharedSessionUser,
} from "./shared-session";
export { SharedSessionManager } from "./shared-session";
