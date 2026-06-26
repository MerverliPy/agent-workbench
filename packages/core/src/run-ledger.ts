import { ulid } from "ulid";
import type { LedgerRepository } from "@agent-workbench/storage";

/** Provisional ledger event categories for Phase 6 (docs/13). */
const Category = {
  SESSION: "session",
  RUN: "run",
  MODEL: "model",
  TOOL: "tool",
  PERMISSION: "permission",
  DIFF: "diff",
  FILE: "file",
  SHELL: "shell",
  AGENT: "agent",
  ERROR: "error",
} as const;

/** Provisional actor values (docs/13). */
const Actor = {
  SYSTEM: "system",
  AGENT: "agent",
  MODEL: "model",
  TOOL: "tool",
  USER: "user",
  POLICY: "policy",
} as const;

/**
 * Typed wrapper around LedgerRepository for Phase 6 runtime events.
 *
 * All event names are provisional — see LEDGER-001 in docs/13_RUN_LEDGER_MODEL.md.
 *
 * The sessionId and runId are bound at construction time. For events not
 * associated with a specific run (e.g. session lifecycle events), use a
 * RunLedger constructed with an empty runId.
 */
export class RunLedger {
  constructor(
    private readonly repo: LedgerRepository,
    private readonly sessionId: string,
    private readonly runId: string | undefined
  ) {}

  // ── Session ──────────────────────────────────────────────────────────────

  recordSessionCreated(): void {
    this.record(
      "session.created",
      Category.SESSION,
      Actor.SYSTEM,
      "Session created"
    );
  }

  recordSessionAborted(): void {
    this.record(
      "session.aborted",
      Category.SESSION,
      Actor.SYSTEM,
      "Session aborted"
    );
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  recordRunStarted(): void {
    this.record(
      "run.started",
      Category.RUN,
      Actor.SYSTEM,
      "Run started"
    );
  }

  recordRunCompleted(assistantMessageId?: string): void {
    this.record(
      "run.completed",
      Category.RUN,
      Actor.SYSTEM,
      "Run completed",
      assistantMessageId !== undefined ? { assistantMessageId } : undefined
    );
  }

  recordRunAborted(reason?: string): void {
    this.record(
      "run.aborted",
      Category.RUN,
      Actor.SYSTEM,
      "Run aborted",
      reason !== undefined ? { reason } : undefined
    );
  }

  recordRunFailed(error: string): void {
    this.record(
      "run.failed",
      Category.RUN,
      Actor.SYSTEM,
      `Run failed: ${error}`,
      { error }
    );
  }

  recordMaxIterationsExceeded(iterations: number): void {
    this.record(
      "run.max_iterations_exceeded",
      Category.RUN,
      Actor.SYSTEM,
      `Run aborted: max iterations (${iterations}) exceeded`,
      { iterations }
    );
  }

  // ── Model calls ───────────────────────────────────────────────────────────

  recordModelCallStarted(iteration: number): void {
    this.record(
      "model.call_started",
      Category.MODEL,
      Actor.MODEL,
      `Model call started (iteration ${iteration})`,
      { iteration }
    );
  }

  recordModelCallCompleted(
    iteration: number,
    usage?: { inputTokens?: number; outputTokens?: number }
  ): void {
    this.record(
      "model.call_completed",
      Category.MODEL,
      Actor.MODEL,
      `Model call completed (iteration ${iteration})`,
      { iteration, usage }
    );
  }

  recordModelCallFailed(iteration: number, error: string): void {
    this.record(
      "model.call_failed",
      Category.MODEL,
      Actor.MODEL,
      `Model call failed (iteration ${iteration}): ${error}`,
      { iteration, error }
    );
  }

  // ── Tool calls ────────────────────────────────────────────────────────────

  recordToolCallRequested(toolCallId: string, toolName: string): void {
    this.record(
      "tool.requested",
      Category.TOOL,
      Actor.AGENT,
      `Tool requested: ${toolName}`,
      { toolCallId, toolName }
    );
  }

  recordToolCallStarted(toolCallId: string, toolName: string): void {
    this.record(
      "tool.started",
      Category.TOOL,
      Actor.TOOL,
      `Tool started: ${toolName}`,
      { toolCallId, toolName }
    );
  }

  recordToolCallCompleted(toolCallId: string, toolName: string): void {
    this.record(
      "tool.completed",
      Category.TOOL,
      Actor.TOOL,
      `Tool completed: ${toolName}`,
      { toolCallId, toolName }
    );
  }

  recordToolCallFailed(
    toolCallId: string,
    toolName: string,
    error: string
  ): void {
    this.record(
      "tool.failed",
      Category.TOOL,
      Actor.TOOL,
      `Tool failed: ${toolName}: ${error}`,
      { toolCallId, toolName, error }
    );
  }

  // ── Errors ────────────────────────────────────────────────────────────────

  recordError(summary: string, detail?: unknown): void {
    this.record("error", Category.ERROR, Actor.SYSTEM, summary, detail);
  }

  // ── Permissions (Phase 8) ─────────────────────────────────────────────────

  /**
   * Record that a permission request was created and sent to the user.
   * Called by SessionRunner when the engine returns "ask".
   */
  recordPermissionRequested(
    requestId: string,
    toolName: string,
    riskLevel: string
  ): void {
    this.record(
      "permission.requested",
      Category.PERMISSION,
      Actor.SYSTEM,
      `Permission requested for tool: ${toolName}`,
      { requestId, toolName, riskLevel }
    );
  }

  /**
   * Record a permission decision (allow or deny).
   *
   * The server decision route also records permission.decided for user-submitted
   * decisions. This method is called by SessionRunner only for policy-level
   * auto-decisions (deny from engine without user prompt). The server route
   * handles the user-submitted case to avoid duplicate ledger entries.
   */
  recordPermissionDecidedByPolicy(
    requestId: string,
    decision: string,
    reason: string
  ): void {
    this.record(
      "permission.decided",
      Category.PERMISSION,
      Actor.POLICY,
      `Permission decided by policy: ${decision}`,
      { requestId, decision, decidedBy: "policy", reason }
    );
  }

  /**
   * Record a policy-level deny (engine returned "deny" directly, no ask).
   * Called by SessionRunner before blocking tool execution.
   */
  recordPermissionDeniedByPolicy(
    requestId: string,
    toolName: string,
    reason: string
  ): void {
    this.record(
      "permission.denied",
      Category.PERMISSION,
      Actor.POLICY,
      `Tool denied by policy: ${toolName}`,
      { requestId, toolName, reason }
    );
  }

  /**
   * Record a user-submitted deny (ask-gate resolved to deny).
   * Called by SessionRunner after gate.waitForDecision() returns "deny".
   */
  recordPermissionDeniedByUser(
    requestId: string,
    toolName: string
  ): void {
    this.record(
      "permission.denied",
      Category.PERMISSION,
      Actor.USER,
      `Tool denied by user: ${toolName}`,
      { requestId, toolName }
    );
  }

  /**
   * Record that a tool call was blocked (no execution).
   * Supplements the existing recordToolCallFailed to specifically mark denial.
   */
  recordToolCallDenied(
    toolCallId: string,
    toolName: string,
    reason: string
  ): void {
    this.record(
      "tool.denied",
      Category.TOOL,
      Actor.POLICY,
      `Tool call denied: ${toolName}`,
      { toolCallId, toolName, reason }
    );
  }

  // ── Diff and file mutation (Phase 9) ──────────────────────────────────────

  /**
   * Record that a diff preview was generated for a mutation tool, before
   * the permission gate fires (docs/14 §7, docs/13 §7).
   */
  recordDiffPreviewCreated(
    toolCallId: string,
    toolName: string,
    path: string,
    diffPreviewId?: string
  ): void {
    this.record(
      "diff.preview_created",
      Category.DIFF,
      Actor.SYSTEM,
      `Diff preview created for ${toolName}: ${path}`,
      { toolCallId, toolName, path, diffPreviewId }
    );
  }

  /**
   * Record that a file mutation was applied successfully.
   */
  recordMutationApplied(
    toolCallId: string,
    toolName: string,
    path: string,
    changeId?: string
  ): void {
    this.record(
      "file.change_applied",
      Category.FILE,
      Actor.TOOL,
      `File mutation applied: ${toolName} → ${path}`,
      { toolCallId, toolName, path, changeId }
    );
  }

  /**
   * Record that a file mutation failed after approval.
   */
  recordMutationFailed(
    toolCallId: string,
    toolName: string,
    path: string,
    error: string
  ): void {
    this.record(
      "file.change_failed",
      Category.FILE,
      Actor.TOOL,
      `File mutation failed: ${toolName} → ${path}: ${error}`,
      { toolCallId, toolName, path, error }
    );
  }

  /**
   * Record that a revert was attempted.
   */
  recordRevertAttempted(
    toolCallId: string,
    path: string
  ): void {
    this.record(
      "file.revert_attempted",
      Category.FILE,
      Actor.TOOL,
      `File revert attempted: ${path}`,
      { toolCallId, path }
    );
  }

  /**
   * Record that a revert completed successfully.
   */
  recordRevertCompleted(
    toolCallId: string,
    path: string,
    revertedChangeId: string
  ): void {
    this.record(
      "file.revert_completed",
      Category.FILE,
      Actor.TOOL,
      `File revert completed: ${path}`,
      { toolCallId, path, revertedChangeId }
    );
  }

  /**
   * Record that a revert failed.
   */
  recordRevertFailed(
    toolCallId: string,
    path: string,
    error: string
  ): void {
    this.record(
      "file.revert_failed",
      Category.FILE,
      Actor.TOOL,
      `File revert failed: ${path}: ${error}`,
      { toolCallId, path, error }
    );
  }

  // ── Shell execution (Phase 10) ──────────────────────────────────────────

  recordShellCommandRequested(
    toolCallId: string,
    command: string
  ): void {
    this.record(
      "shell.command_requested",
      Category.SHELL,
      Actor.AGENT,
      `Shell command requested: ${command}`,
      { toolCallId, command }
    );
  }

  recordShellRiskClassified(
    toolCallId: string,
    riskLevel: string,
    matchedRules: string[]
  ): void {
    this.record(
      "shell.command_risk_classified",
      Category.SHELL,
      Actor.SYSTEM,
      `Shell command risk classified: ${riskLevel}`,
      { toolCallId, riskLevel, matchedRules }
    );
  }

  recordShellCommandStarted(
    toolCallId: string,
    command: string
  ): void {
    this.record(
      "shell.command_started",
      Category.SHELL,
      Actor.TOOL,
      `Shell command started: ${command}`,
      { toolCallId, command }
    );
  }

  recordShellOutputChunk(
    toolCallId: string,
    stream: string,
    chunkLength: number
  ): void {
    this.record(
      "shell.output_chunk",
      Category.SHELL,
      Actor.TOOL,
      `Shell ${stream} chunk (${chunkLength} bytes)`,
      { toolCallId, stream, chunkLength }
    );
  }

  recordShellCommandCompleted(
    toolCallId: string,
    exitCode: number | null,
    timedOut: boolean,
    truncated: boolean
  ): void {
    this.record(
      "shell.command_completed",
      Category.SHELL,
      Actor.TOOL,
      `Shell command completed (exit ${exitCode})`,
      { toolCallId, exitCode, timedOut, truncated }
    );
  }

  recordShellCommandFailed(
    toolCallId: string,
    error: string
  ): void {
    this.record(
      "shell.command_failed",
      Category.SHELL,
      Actor.TOOL,
      `Shell command failed: ${error}`,
      { toolCallId, error }
    );
  }

  recordShellCommandAborted(
    toolCallId: string,
    reason: string
  ): void {
    this.record(
      "shell.command_aborted",
      Category.SHELL,
      Actor.TOOL,
      `Shell command aborted: ${reason}`,
      { toolCallId, reason }
    );
  }

  // ── Agent (Phase 11) ─────────────────────────────────────────────────────

  recordAgentSelected(agentId: string, promptVersion: string): void {
    this.record(
      "agent.selected",
      Category.AGENT,
      Actor.USER,
      `Agent selected: ${agentId} (v${promptVersion})`,
      { agentId, promptVersion }
    );
  }

  recordAgentProfileApplied(agentId: string, promptVersion: string): void {
    this.record(
      "agent.profile_applied",
      Category.AGENT,
      Actor.SYSTEM,
      `Agent profile applied: ${agentId} (v${promptVersion})`,
      { agentId, promptVersion }
    );
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private record(
    eventType: string,
    eventCategory: string,
    actor: string,
    summary: string,
    payload?: unknown
  ): void {
    this.repo.create({
      id: ulid(),
      sessionId: this.sessionId,
      runId: this.runId ?? null,
      eventType,
      eventCategory,
      actor,
      summary,
      payloadJson:
        payload !== undefined ? JSON.stringify(payload) : null,
      redactionStatus: "none",
      createdAt: new Date().toISOString(),
    });
  }
}
