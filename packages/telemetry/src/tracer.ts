/**
 * Lightweight OpenTelemetry-like tracing without external dependencies.
 *
 * Provides span creation, parent-child relationships, and structured
 * attributes for model calls, tool executions, and permission checks.
 * Can be replaced with full OpenTelemetry SDK later without API changes.
 */

export type SpanStatus = "ok" | "error" | "unset";

export interface Span {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly status: SpanStatus;
  readonly startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  error?: string;
}

export interface TraceOptions {
  name: string;
  parentSpanId?: string;
  attributes?: Record<string, unknown>;
}

export type TraceHandler<T> = (span: Span) => Promise<T>;

/**
 * Simple in-memory tracer that produces structured spans.
 * Span data can be exported via metrics-exporter or viewed via the dashboard API.
 */
export class Tracer {
  private spans: InternalSpan[] = [];
  private readonly maxSpans: number;

  constructor(options?: { maxSpans?: number }) {
    this.maxSpans = options?.maxSpans ?? 10_000;
  }

  /**
   * Start a new trace span and execute the handler within it.
   * The span is automatically closed when the handler completes or throws.
   */
  async trace<T>(
    options: TraceOptions,
    handler: TraceHandler<T>,
  ): Promise<T> {
    const span = this.startSpan(options);
    try {
      const result = await handler(span);
      this.endSpan(span, "ok");
      return result;
    } catch (err) {
      span.error = err instanceof Error ? err.message : String(err);
      this.endSpan(span, "error");
      throw err;
    }
  }

  /**
   * Start a span without automatic lifecycle management.
   * Caller must call endSpan() manually.
   */
  startSpan(options: TraceOptions): Span {
    const traceId = generateId();
    const spanId = generateId();

    const span: InternalSpan = {
      spanId,
      traceId: this.spans.length > 0
        ? (this.spans[this.spans.length - 1]?.traceId ?? traceId)
        : traceId,
      name: options.name,
      status: "unset",
      startTime: performance.now(),
      attributes: options.attributes ?? {},
    };
    if (options.parentSpanId !== undefined) {
      span.parentSpanId = options.parentSpanId;
    }

    if (this.spans.length >= this.maxSpans) {
      this.spans.shift();
    }
    this.spans.push(span);
    return span;
  }

  /** Close a span with a final status. */
  endSpan(span: Span, status: SpanStatus): void {
    (span as InternalSpan).status = status;
    span.endTime = performance.now();
  }

  /** Get the duration of a completed span in milliseconds. */
  getDuration(span: Span): number | undefined {
    if (span.endTime === undefined) return undefined;
    return span.endTime - span.startTime;
  }

  /** Get all recorded spans. */
  getSpans(): readonly Span[] {
    return this.spans;
  }

  /** Get spans filtered by trace ID. */
  getTrace(traceId: string): Span[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  /** Get recent spans, optionally filtered by name. */
  getRecentSpans(limit = 100, name?: string): Span[] {
    let result = [...this.spans];
    if (name !== undefined) {
      result = result.filter((s) => s.name === name);
    }
    return result.slice(-limit).reverse();
  }

  /** Clear all spans. */
  clear(): void {
    this.spans = [];
  }

  /** Get span count. */
  get size(): number {
    return this.spans.length;
  }
}

/** Mutable internal span type (allows status writes). */
interface InternalSpan {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  status: SpanStatus;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  error?: string;
}

/** Generate a short unique span/trace ID. */
function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}
