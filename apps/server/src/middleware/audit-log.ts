import { AuditTrail, type AuditEntry } from "@agent-workbench/compliance";
import type { MiddlewareHandler } from "hono";
import type { ServerAppBindings } from "../context";

/**
 * Global audit trail instance used by the HTTP middleware and route handlers.
 * SHA-256 chain-hashed entries via compliance AuditTrail.
 */
export const auditTrail = new AuditTrail();

/**
 * Middleware that creates an immutable audit trail of all security-relevant
 * HTTP requests. Uses SHA-256 chain-hashed entries via compliance AuditTrail.
 * Backed by AuditTrail.verify() for tamper detection.
 */
export function auditLogMiddleware(
  _bufferSize?: number,
): MiddlewareHandler<ServerAppBindings> {
  return async (context, next) => {
    const start = Date.now();
    const requestId = context.get("requestId");

    try {
      await next();
    } finally {
      const authCtx = context.get("auth");
      const userId = authCtx?.subject ?? "anonymous";
      // nosemgrep: type-coercion
      const statusCode = (context.res as any)?.status ?? 0;

      auditTrail.append({
        actor: userId,
        action: `${context.req.method} ${context.req.path}`,
        resource: context.req.path,
        details: {
          requestId,
          statusCode,
          durationMs: Date.now() - start,
        },
      });
    }
  };
}

/** Read the current verified audit trail. */
export function readAuditLog(): AuditEntry[] {
  return [...auditTrail.all()] as AuditEntry[];
}

/** Export the full audit trail for backup/persistence. */
export function exportAuditTrail(): AuditEntry[] {
  return [...auditTrail.all()] as AuditEntry[];
}

/** Verify the integrity of the entire audit chain. */
export function verifyAuditTrail(): ReturnType<AuditTrail["verify"]> {
  return auditTrail.verify();
}
