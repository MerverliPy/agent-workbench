import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ServerAppBindings } from "../context";
import { ApiError } from "../errors";
import { createErrorEnvelope } from "../utils/error-envelope";

function requestIdFromContext(context: Context<ServerAppBindings>): string | undefined {
  try {
    return context.get("requestId");
  } catch {
    return undefined;
  }
}

export function handleAppError(error: unknown, context: Context<ServerAppBindings>) {
  const requestId = requestIdFromContext(context);

  if (error instanceof ApiError) {
    return context.json(
      createErrorEnvelope({
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
        recoverable: error.recoverable,
      }),
      { status: error.status as 400 | 404 | 500 | 501 }
    );
  }

  if (error instanceof HTTPException) {
    return context.json(
      createErrorEnvelope({
        code: "HTTP_ERROR",
        message: error.message || "HTTP error",
        requestId,
        details: undefined,
        recoverable: error.status < 500,
      }),
      { status: error.status as 400 | 404 | 500 | 501 }
    );
  }

  if (
    error instanceof Error &&
    "code" in error &&
    "status" in error &&
    typeof error.code === "string" &&
    typeof error.status === "number"
  ) {
    return context.json(
      createErrorEnvelope({
        code: error.code,
        message: error.message,
        requestId,
        details: undefined,
        recoverable: error.status < 500,
      }),
      { status: error.status as 400 | 404 | 500 | 501 }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  return context.json(
    createErrorEnvelope({
      code: "INTERNAL_ERROR",
      message,
      requestId,
      details: undefined,
      recoverable: false,
    }),
    { status: 500 }
  );
}
