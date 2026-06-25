import type { HttpTransport } from "../transport/http";
import { SseTransport, type EventCallback, type EventFilter } from "../transport/sse";
import type { EventEnvelope } from "@agent-workbench/protocol";

export class EventResource {
  private sse: SseTransport;
  private connected = false;

  constructor(
    private transport: HttpTransport,
    private baseUrl: string,
  ) {
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
}
