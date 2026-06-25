import { EventEnvelope } from "@agent-workbench/protocol";
import { SdkError } from "./errors";

export type EventCallback = (event: EventEnvelope) => void;
export type EventFilter = (event: EventEnvelope) => boolean;
export type ErrorCallback = (error: Error) => void;

export interface SseTransportOptions {
  url: string;
}

export class SseTransport {
  private url: string;
  private abortController: AbortController | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private filter: EventFilter | null = null;
  private errorHandler: ErrorCallback | null = null;
  private buffer = "";

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

  setErrorHandler(handler: ErrorCallback): void {
    this.errorHandler = handler;
  }

  async connect(signal?: AbortSignal): Promise<void> {
    this.abortController = new AbortController();
    const abortSignal = this.abortController.signal;

    const onExternalAbort = () => abortSignal.aborted || this.abortController?.abort();
    signal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await fetch(this.url, {
        headers: { Accept: "text/event-stream" },
        signal: abortSignal,
      });

      if (!response.ok) {
        throw new SdkError(`SSE connection failed: HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new SdkError("SSE response body is not readable");
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        this.buffer += decoder.decode(value, { stream: true });
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() ?? "";

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
    } finally {
      signal?.removeEventListener("abort", onExternalAbort);
    }
  }

  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.buffer = "";
  }

  private dispatch(type: string, data: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      this.errorHandler?.(new SdkError("Failed to parse SSE event data as JSON"));
      return;
    }

    const raw = parsed as Record<string, unknown>;
    const result = EventEnvelope.safeParse({
      ...raw,
      type: raw.type ?? type,
    });

    if (!result.success) {
      this.errorHandler?.(new SdkError(`Malformed SSE event: ${result.error?.issues?.map((i) => i.message).join(", ")}`));
      return;
    }

    const event = result.data;

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
  }
}
