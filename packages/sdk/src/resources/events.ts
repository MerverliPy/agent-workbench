import type { EventEnvelope } from "@agent-workbench/protocol";
import {
  type ModelStreamCompletePayload,
  type ModelStreamDeltaPayload,
  type ModelStreamErrorPayload,
  STREAM_EVENT_TYPES,
} from "@agent-workbench/protocol";
import type { HttpTransport } from "../transport/http";
import {
  type EventCallback,
  type EventFilter,
  SseTransport,
} from "../transport/sse";

export class EventResource {
  private sse: SseTransport;
  private connected = false;

  constructor(_transport: HttpTransport, baseUrl: string) {
    this.sse = new SseTransport({ url: `${baseUrl}/global/event` });
  }

  on(eventType: string, callback: EventCallback): void {
    this.sse.on(eventType, callback);
  }

  off(eventType: string, callback: EventCallback): void {
    this.sse.off(eventType, callback);
  }

  onAny(callback: EventCallback): void {
    this.sse.on("*", callback);
  }

  setFilter(fn: EventFilter): void {
    this.sse.setFilter(fn);
  }

  async connect(signal?: AbortSignal): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    return this.sse.connect(signal);
  }

  disconnect(): void {
    this.connected = false;
    this.sse.disconnect();
  }

  // ── Streaming helpers (Phase 16) ──────────────────────────────────────────

  onStreamDelta(callback: (payload: ModelStreamDeltaPayload) => void): void {
    this.sse.on(STREAM_EVENT_TYPES.DELTA, (event: EventEnvelope) => {
      callback(event.payload as ModelStreamDeltaPayload);
    });
  }

  onStreamComplete(
    callback: (payload: ModelStreamCompletePayload) => void,
  ): void {
    this.sse.on(STREAM_EVENT_TYPES.COMPLETE, (event: EventEnvelope) => {
      callback(event.payload as ModelStreamCompletePayload);
    });
  }

  onStreamError(callback: (payload: ModelStreamErrorPayload) => void): void {
    this.sse.on(STREAM_EVENT_TYPES.ERROR, (event: EventEnvelope) => {
      callback(event.payload as ModelStreamErrorPayload);
    });
  }

  offStreamDelta(callback: EventCallback): void {
    this.sse.off(STREAM_EVENT_TYPES.DELTA, callback);
  }

  offStreamComplete(callback: EventCallback): void {
    this.sse.off(STREAM_EVENT_TYPES.COMPLETE, callback);
  }

  offStreamError(callback: EventCallback): void {
    this.sse.off(STREAM_EVENT_TYPES.ERROR, callback);
  }
}
