/**
 * Structured request/response logging.
 *
 * Produces JSON log lines with consistent fields for parsing by
 * log aggregators (Loki, Datadog, etc.).
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly method?: string;
  readonly path?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly error?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface LoggerOptions {
  /** Minimum level to emit. */
  level?: LogLevel;
  /** Whether to include pretty-print for development. */
  pretty?: boolean;
  /** Output stream (default: stdout). */
  output?: {
    write: (line: string) => void;
  };
}

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Structured JSON logger.
 *
 * Emits log lines as JSON objects for machine parsing,
 * or human-readable format in development.
 */
export class RequestLogger {
  private readonly minLevel: number;
  private readonly pretty: boolean;
  private readonly output: { write: (line: string) => void };

  constructor(options?: LoggerOptions) {
    this.minLevel = options?.level ? LEVEL_VALUES[options.level] : 0;
    this.pretty = options?.pretty ?? false;
    this.output = options?.output ?? process.stdout;
  }

  debug(message: string, meta?: Partial<LogEntry>): void {
    this.emit("debug", message, meta);
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    this.emit("info", message, meta);
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    this.emit("warn", message, meta);
  }

  error(message: string, meta?: Partial<LogEntry>): void {
    this.emit("error", message, meta);
  }

  /** Log an HTTP request completion. */
  logRequest(entry: {
    requestId: string;
    method: string;
    path: string;
    statusCode: number;
    durationMs: number;
    error?: string;
  }): void {
    const level = entry.statusCode >= 500 ? "error" as const
      : entry.statusCode >= 400 ? "warn" as const
      : "info" as const;

    this.emit(level, `${entry.method} ${entry.path} ${entry.statusCode}`, {
      requestId: entry.requestId,
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
      ...(entry.error !== undefined ? { error: entry.error } : {}),
    });
  }

  // ── Private ────────────────────────────────────────────────────────────

  private emit(level: LogLevel, message: string, meta?: Partial<LogEntry>): void {
    if (LEVEL_VALUES[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta?.requestId !== undefined ? { requestId: meta.requestId } : {}),
      ...(meta?.sessionId !== undefined ? { sessionId: meta.sessionId } : {}),
      ...(meta?.method !== undefined ? { method: meta.method } : {}),
      ...(meta?.path !== undefined ? { path: meta.path } : {}),
      ...(meta?.statusCode !== undefined ? { statusCode: meta.statusCode } : {}),
      ...(meta?.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
      ...(meta?.error !== undefined ? { error: meta.error } : {}),
      ...(meta?.metadata !== undefined ? { metadata: meta.metadata } : {}),
    };

    if (this.pretty) {
      const color = level === "error" ? "\x1b[31m"
        : level === "warn" ? "\x1b[33m"
        : level === "info" ? "\x1b[36m"
        : "\x1b[90m";
      const reset = "\x1b[0m";
      const prefix = `${color}[${level.toUpperCase().padEnd(5)}]${reset}`;
      this.output.write(`${prefix} ${entry.timestamp.slice(11, 23)} ${message}`);
      if (entry.durationMs !== undefined) {
        this.output.write(` ${entry.durationMs}ms`);
      }
      if (entry.error !== undefined) {
        this.output.write(` error="${entry.error}"`);
      }
      this.output.write("\n");
    } else {
      this.output.write(JSON.stringify(entry) + "\n");
    }
  }
}
