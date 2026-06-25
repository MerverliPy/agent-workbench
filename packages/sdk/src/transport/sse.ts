import type { EventEnvelope } from "@agent-workbench/protocol";
import { SdkError } from "./errors";

export type EventCallback = (event: EventEnvelope) => void;
export type EventFilter = (event: EventEnvelope) => boolean;

export interface SseTransportOptions {
  url: string;
  signal?: AbortSignal;
}

export class SseTransport {
  private url: string;
  private abortController: AbortController | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private filter: EventFilter | null = null;

  constructor(options: SseTransportOptions) {
    this.url = options.url;
  }

  on(eventType: string, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
  }

  off(eventType: string, callback: EventCallback): void {
    this.listeners.get(eventType)?.delete(callback);
  }

  setFilter(fn: EventFilter): void {
    this.filter = fn;
  }

  async connect(signal?: AbortSignal): Promise<void> {
    this.abortController = new AbortController();
    const combinedSignal = signal
      ? AbortSignal.any?.([signal, this.abortController.signal]) ?? this.abortController.signal
      : this.abortController.signal;

    try {
      const response = await fetch(this.url, {
        headers: { Accept: "text/event-stream" },
        signal: combinedSignal,
      });

      if (!response.ok) {
        throw new SdkError(`SSE connection failed: HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new SdkError("SSE response body is not readable");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentType = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            currentData += line.slice(6);
          } else if (line === "" && currentData) {
            this.dispatch(currentType, currentData);
            currentType = "";
            currentData = "";
          }
        }
      }
    } catch (error) {
      if (error instanceof SdkError) throw error;
      if (error instanceof DOMException && (error as DOMException).name === "AbortError") return;
      throw new SdkError("SSE connection failed", error);
    }
  }

  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private dispatch(type: string, data: string): void {
    try {
      const parsed = JSON.parse(data);
      const event: EventEnvelope = {
        id: parsed.id,
        type: parsed.type ?? type,
        sessionId: parsed.sessionId,
        runId: parsed.runId,
        timestamp: parsed.timestamp,
        payload: parsed.payload,
      };

      if (this.filter && !this.filter(event)) return;

      const callbacks = this.listeners.get(event.type);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(event);
        }
      }

      const wildcardCallbacks = this.listeners.get("*");
      if (wildcardCallbacks) {
        for (const cb of wildcardCallbacks) {
          cb(event);
        }
      }
    } catch {
      // skip unparseable events
    }
  }
}
