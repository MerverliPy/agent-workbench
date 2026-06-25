import { ulid } from "ulid";
import type { EventBus } from "@agent-workbench/events";
import { EventName } from "@agent-workbench/events";
import type { EventEnvelope } from "@agent-workbench/protocol";
import type { ModelUsage } from "@agent-workbench/models";

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
