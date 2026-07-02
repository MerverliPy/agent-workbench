/**
 * Lightweight error reporter with session context.
 *
 * Collects errors with trace ID, session ID, run ID, and structured metadata.
 * Can be swapped for Sentry/GlitchTip/OpenTelemetry SDK later.
 */

export interface ErrorReport {
  readonly id: string;
  readonly message: string;
  readonly stack?: string;
  readonly traceId?: string;
  readonly sessionId?: string;
  readonly runId?: string;
  readonly spanName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly timestamp: string;
  readonly level: "error" | "warning" | "info";
}

export class ErrorReporter {
  private errors: ErrorReport[] = [];
  private readonly maxErrors: number;

  constructor(options?: { maxErrors?: number }) {
    this.maxErrors = options?.maxErrors ?? 1000;
  }

  /**
   * Report an error with optional context.
   */
  report(error: Error, context?: {
    traceId?: string;
    sessionId?: string;
    runId?: string;
    spanName?: string;
    metadata?: Record<string, unknown>;
    level?: "error" | "warning" | "info";
  }): ErrorReport {
    const report: ErrorReport = {
      id: crypto.randomUUID().slice(0, 12),
      message: error.message,
      ...(error.stack !== undefined ? { stack: error.stack } : {}),
      ...(context?.traceId !== undefined ? { traceId: context.traceId } : {}),
      ...(context?.sessionId !== undefined ? { sessionId: context.sessionId } : {}),
      ...(context?.runId !== undefined ? { runId: context.runId } : {}),
      ...(context?.spanName !== undefined ? { spanName: context.spanName } : {}),
      ...(context?.metadata !== undefined ? { metadata: context.metadata } : {}),
      timestamp: new Date().toISOString(),
      level: context?.level ?? "error",
    };

    if (this.errors.length >= this.maxErrors) {
      this.errors.shift();
    }
    this.errors.push(report);
    return report;
  }

  /** Get all reported errors. */
  getReports(): readonly ErrorReport[] {
    return this.errors;
  }

  /** Get errors filtered by session. */
  getSessionErrors(sessionId: string): ErrorReport[] {
    return this.errors.filter((r) => r.sessionId === sessionId);
  }

  /** Get recent errors. */
  getRecentErrors(limit = 50): ErrorReport[] {
    return [...this.errors].slice(-limit).reverse();
  }

  /** Clear all errors. */
  clear(): void {
    this.errors = [];
  }
}
