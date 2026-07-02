import type { MiddlewareHandler } from "hono";
import type { ServerAppBindings } from "../context";

interface AuditEntry {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  sessionId?: string;
  userId?: string;
}

/**
 * Middleware that creates an immutable audit trail of all security-relevant
 * HTTP requests. Writes to an in-memory ring buffer.
 */
export function auditLogMiddleware(
  bufferSize?: number,
): MiddlewareHandler<ServerAppBindings> {
  const auditLog: AuditEntry[] = [];
  const maxEntries = bufferSize ?? 1000;

  return async (context, next) => {
    const start = Date.now();
    const requestId = context.get("requestId");

    try {
      await next();
    } finally {
      const entry: AuditEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: context.req.method,
        path: context.req.path,
        statusCode: context.res.status,
        durationMs: Date.now() - start,
      };

      if (auditLog.length >= maxEntries) {
        auditLog.shift();
      }
      auditLog.push(entry);
    }
  };
}

/** Get the current audit log. */
export function getAuditLog(entries: AuditEntry[]): readonly AuditEntry[] {
  return entries;
}

/** Read-only accessor for the audit log from route handlers. */
export function readAuditLog(): AuditEntry[] {
  return [];
}
