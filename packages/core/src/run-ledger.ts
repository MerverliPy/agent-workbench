import { ulid } from "ulid";
import type { LedgerRepository } from "@agent-workbench/storage";

/** Provisional ledger event categories for Phase 6 (docs/13). */
const Category = {
  SESSION: "session",
  RUN: "run",
  MODEL: "model",
  TOOL: "tool",
  ERROR: "error",
} as const;

/** Provisional actor values (docs/13). */
const Actor = {
  SYSTEM: "system",
  AGENT: "agent",
  MODEL: "model",
  TOOL: "tool",
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
