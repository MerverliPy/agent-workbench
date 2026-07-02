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
export { exportSession, importSession } from "./session-export";
export type {
  SessionExport,
  ExportedMessage,
  ExportedToolCall,
  ExportedPermission,
  ExportedLedgerEntry,
  ExportOptions,
  Repositories,
} from "./session-export";
