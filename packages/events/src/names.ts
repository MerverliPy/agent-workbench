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
} as const;

export type EventNameValue = (typeof EventName)[keyof typeof EventName];
