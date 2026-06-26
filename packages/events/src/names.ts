/**
 * Provisional Phase 6 runtime event-name constants.
 *
 * These names are provisional and match the categories defined in
 * docs/13_RUN_LEDGER_MODEL.md. They will be stabilised once the full event
 * contract is finalised (LEDGER-001 / ARCH-001).
 *
 * Convention: "<category>.<event>"
 */
export const EventName = {
  // Session lifecycle
  SESSION_CREATED: "session.created",
  SESSION_UPDATED: "session.updated",
  SESSION_ABORTED: "session.aborted",

  // Run lifecycle
  RUN_STARTED: "run.started",
  RUN_COMPLETED: "run.completed",
  RUN_ABORTED: "run.aborted",
  RUN_FAILED: "run.failed",

  // Model calls
  MODEL_CALL_STARTED: "model.call_started",
  MODEL_CALL_COMPLETED: "model.call_completed",
  MODEL_CALL_FAILED: "model.call_failed",

  // Tool calls
  TOOL_CALL_REQUESTED: "tool.requested",
  TOOL_CALL_STARTED: "tool.started",
  TOOL_CALL_COMPLETED: "tool.completed",
  TOOL_CALL_FAILED: "tool.failed",
  TOOL_CALL_ABORTED: "tool.aborted",

  // Message
  MESSAGE_CREATED: "message.created",

  // Permission (Phase 8)
  PERMISSION_REQUESTED: "permission.requested",
  PERMISSION_DECIDED: "permission.decided",
  PERMISSION_DENIED: "permission.denied",
  /**
   * Emitted when a pending permission request expires without a decision.
   * Structurally defined in Phase 8; active timeout enforcement is
   * PERM-EXPIRY: not implemented — see packages/permissions/src/gate.ts.
   */
  PERMISSION_EXPIRED: "permission.expired",

  // ── Diff and file mutation events (Phase 9) ──────────────────────────────
  // Event names are provisional — see LEDGER-001 in docs/13_RUN_LEDGER_MODEL.md.

  /**
   * Emitted by core after a diff preview is generated for a mutation tool,
   * before the permission gate fires. TUI uses this to open the DiffViewer.
   */
  DIFF_PREVIEW_CREATED: "diff.preview_created",

  /**
   * Emitted by core when a file mutation is proposed (permission requested).
   * Carries the tool name and target path; diff summary is in the permission
   * request payload.
   */
  FILE_CHANGE_PROPOSED: "file.change_proposed",

  /**
   * Emitted by core after a write/edit/apply_patch/revert executes
   * successfully.
   */
  FILE_CHANGE_APPLIED: "file.change_applied",

  /**
   * Emitted by core when a mutation tool execution fails after approval.
   */
  FILE_CHANGE_FAILED: "file.change_failed",

  /**
   * Emitted by core when a revert attempt starts (before execution).
   */
  FILE_REVERT_ATTEMPTED: "file.revert_attempted",

  /**
   * Emitted by core after a revert completes successfully.
   */
  FILE_REVERT_COMPLETED: "file.revert_completed",

  /**
   * Emitted by core when a revert attempt fails.
   */
  FILE_REVERT_FAILED: "file.revert_failed",

  // ── Shell execution events (Phase 10) ────────────────────────────────────
  // Event names are provisional — see LEDGER-001 in docs/13_RUN_LEDGER_MODEL.md.

  SHELL_COMMAND_REQUESTED: "shell.command_requested",
  SHELL_COMMAND_RISK_CLASSIFIED: "shell.command_risk_classified",
  SHELL_COMMAND_STARTED: "shell.command_started",
  SHELL_OUTPUT_CHUNK: "shell.output_chunk",
  SHELL_COMMAND_COMPLETED: "shell.command_completed",
  SHELL_COMMAND_FAILED: "shell.command_failed",
  SHELL_COMMAND_ABORTED: "shell.command_aborted",
} as const;

export type EventNameValue = (typeof EventName)[keyof typeof EventName];
