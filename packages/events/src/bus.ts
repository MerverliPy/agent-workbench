import type { EventEnvelope } from "@agent-workbench/protocol";

export type EventHandler = (event: EventEnvelope) => void;

/**
 * A simple in-process event bus for streaming runtime events from core to
 * server (and ultimately to SSE subscribers). Single-threaded Bun async model
 * means no lock contention; publish is synchronous fan-out.
 */
export class EventBus {
  private readonly handlers = new Set<EventHandler>();

  /**
   * Register a handler. Returns an unsubscribe function.
   */
  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Publish an event to all currently subscribed handlers.
   * Errors thrown by individual handlers are caught and logged so they cannot
   * interrupt delivery to other subscribers.
   */
  publish(event: EventEnvelope): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        console.error("[EventBus] subscriber threw during publish", err);
      }
    }
  }

  /** Number of active subscribers (useful for diagnostics). */
  get subscriberCount(): number {
    return this.handlers.size;
  }
}
