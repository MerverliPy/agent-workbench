import { ulid } from "ulid";
import type { EventBus } from "@agent-workbench/events";
import { EventName } from "@agent-workbench/events";
import type { EventEnvelope, DiffPreview } from "@agent-workbench/protocol";
import type { ModelUsage } from "@agent-workbench/models";
import type { CommandPreview } from "@agent-workbench/shell";

/**
 * Typed wrapper around EventBus for publishing Phase 6 runtime events.
 *
 * Each helper method constructs a valid EventEnvelope and publishes it. The
 * sessionId and runId are bound at construction time so callers do not need to
 * thread them through every call.
 */
export class EventPublisher {
  constructor(
    private readonly bus: EventBus,
    private readonly sessionId: string,
    private readonly runId: string
  ) {}

  // ── Run lifecycle ───────────────────────────────────────────────────────────

  publishRunStarted(): void {
    this.publish(EventName.RUN_STARTED, {});
  }

  publishRunCompleted(assistantMessageId?: string): void {
    this.publish(EventName.RUN_COMPLETED, { assistantMessageId });
  }

  publishRunAborted(reason?: string): void {
    this.publish(EventName.RUN_ABORTED, { reason });
  }

  publishRunFailed(error: string): void {
    this.publish(EventName.RUN_FAILED, { error });
  }

  // ── Model calls ─────────────────────────────────────────────────────────────

  publishModelCallStarted(iteration: number): void {
    this.publish(EventName.MODEL_CALL_STARTED, { iteration });
  }

  publishModelCallCompleted(usage?: ModelUsage): void {
    this.publish(EventName.MODEL_CALL_COMPLETED, { usage });
  }

  publishModelCallFailed(error: string): void {
    this.publish(EventName.MODEL_CALL_FAILED, { error });
  }

  // ── Tool calls ──────────────────────────────────────────────────────────────

  publishToolCallRequested(toolCallId: string, toolName: string): void {
    this.publish(EventName.TOOL_CALL_REQUESTED, { toolCallId, toolName });
  }

  publishToolCallStarted(toolCallId: string, toolName: string): void {
    this.publish(EventName.TOOL_CALL_STARTED, { toolCallId, toolName });
  }

  publishToolCallCompleted(toolCallId: string, toolName: string): void {
    this.publish(EventName.TOOL_CALL_COMPLETED, { toolCallId, toolName });
  }

  publishToolCallFailed(toolCallId: string, toolName: string, error: string): void {
    this.publish(EventName.TOOL_CALL_FAILED, { toolCallId, toolName, error });
  }

  publishToolCallAborted(toolCallId: string, toolName: string): void {
    this.publish(EventName.TOOL_CALL_ABORTED, { toolCallId, toolName });
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  publishMessageCreated(messageId: string, role: string): void {
    this.publish(EventName.MESSAGE_CREATED, { messageId, role });
  }

  // ── Permissions (Phase 8) ────────────────────────────────────────────────

  publishPermissionRequested(
    requestId: string,
    toolName: string,
    riskLevel: string,
    reason?: string,
    permissionRequest?: unknown
  ): void {
    // Include the full permission request object in the payload so the TUI
    // can render the modal without a follow-up API call.
    this.publish(EventName.PERMISSION_REQUESTED, {
      requestId,
      toolName,
      riskLevel,
      reason,
      permissionRequest,
    });
  }

  publishPermissionDecided(
    requestId: string,
    decision: string,
    decidedBy?: string
  ): void {
    this.publish(EventName.PERMISSION_DECIDED, {
      requestId,
      decision,
      decidedBy,
    });
  }

  publishPermissionDenied(
    requestId: string,
    toolName: string,
    reason?: string
  ): void {
    this.publish(EventName.PERMISSION_DENIED, {
      requestId,
      toolName,
      reason,
    });
  }

  // ── Diff and file mutation (Phase 9) ─────────────────────────────────────

  /**
   * Emitted after a diff preview is generated for a mutation tool, before
   * the permission gate fires. TUI uses this to open the DiffViewer with
   * the full preview payload.
   */
  publishDiffPreviewCreated(
    toolCallId: string,
    toolName: string,
    preview: DiffPreview
  ): void {
    this.publish(EventName.DIFF_PREVIEW_CREATED, {
      toolCallId,
      toolName,
      preview,
    });
  }

  /**
   * Emitted after a write/edit/apply_patch tool applies successfully.
   */
  publishFileChangeApplied(
    toolCallId: string,
    toolName: string,
    path: string,
    changeId?: string
  ): void {
    this.publish(EventName.FILE_CHANGE_APPLIED, {
      toolCallId,
      toolName,
      path,
      changeId,
    });
  }

  /**
   * Emitted when a mutation tool execution fails after permission approval.
   */
  publishFileChangeFailed(
    toolCallId: string,
    toolName: string,
    path: string,
    error: string
  ): void {
    this.publish(EventName.FILE_CHANGE_FAILED, {
      toolCallId,
      toolName,
      path,
      error,
    });
  }

  /**
   * Emitted when revert_last_change is dispatched (before execution).
   */
  publishFileRevertAttempted(
    toolCallId: string,
    path: string
  ): void {
    this.publish(EventName.FILE_REVERT_ATTEMPTED, {
      toolCallId,
      path,
    });
  }

  /**
   * Emitted when revert_last_change completes successfully.
   */
  publishFileRevertCompleted(
    toolCallId: string,
    path: string,
    revertedChangeId: string
  ): void {
    this.publish(EventName.FILE_REVERT_COMPLETED, {
      toolCallId,
      path,
      revertedChangeId,
    });
  }

  /**
   * Emitted when revert_last_change fails.
   */
  publishFileRevertFailed(
    toolCallId: string,
    path: string,
    error: string
  ): void {
    this.publish(EventName.FILE_REVERT_FAILED, {
      toolCallId,
      path,
      error,
    });
  }

  // ── Shell execution (Phase 10) ──────────────────────────────────────────

  publishShellCommandRequested(
    toolCallId: string,
    preview: CommandPreview
  ): void {
    this.publish(EventName.SHELL_COMMAND_REQUESTED, {
      toolCallId,
      preview,
    });
  }

  publishShellRiskClassified(
    toolCallId: string,
    riskLevel: string,
    matchedRules: string[]
  ): void {
    this.publish(EventName.SHELL_COMMAND_RISK_CLASSIFIED, {
      toolCallId,
      riskLevel,
      matchedRules,
    });
  }

  publishShellCommandStarted(toolCallId: string, command: string): void {
    this.publish(EventName.SHELL_COMMAND_STARTED, {
      toolCallId,
      command,
    });
  }

  publishShellOutputChunk(
    toolCallId: string,
    stream: "stdout" | "stderr",
    chunk: string
  ): void {
    this.publish(EventName.SHELL_OUTPUT_CHUNK, {
      toolCallId,
      stream,
      chunk,
    });
  }

  publishShellCommandCompleted(
    toolCallId: string,
    exitCode: number | null,
    timedOut: boolean,
    truncated: boolean
  ): void {
    this.publish(EventName.SHELL_COMMAND_COMPLETED, {
      toolCallId,
      exitCode,
      timedOut,
      truncated,
    });
  }

  publishShellCommandFailed(
    toolCallId: string,
    error: string
  ): void {
    this.publish(EventName.SHELL_COMMAND_FAILED, {
      toolCallId,
      error,
    });
  }

  publishShellCommandAborted(
    toolCallId: string,
    reason: string
  ): void {
    this.publish(EventName.SHELL_COMMAND_ABORTED, {
      toolCallId,
      reason,
    });
  }

  // ── Internal helper ─────────────────────────────────────────────────────────

  private publish(type: string, payload: unknown): void {
    const envelope: EventEnvelope = {
      id: ulid(),
      type,
      sessionId: this.sessionId,
      runId: this.runId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.bus.publish(envelope);
  }
}
