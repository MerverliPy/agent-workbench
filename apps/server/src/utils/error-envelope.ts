import { ErrorEnvelope } from "@agent-workbench/protocol";

export interface ErrorEnvelopeOptions {
  readonly code: string;
  readonly message: string;
  readonly requestId: string | undefined;
  readonly details: unknown;
  readonly recoverable: boolean | undefined;
}

export function createErrorEnvelope(options: ErrorEnvelopeOptions) {
  const error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
    recoverable?: boolean;
  } = {
    code: options.code,
    message: options.message,
  };

  if (options.requestId !== undefined) {
    error.requestId = options.requestId;
  }

  if (options.details !== undefined) {
    error.details = options.details;
  }

  if (options.recoverable !== undefined) {
    error.recoverable = options.recoverable;
  }

  return ErrorEnvelope.parse({ error });
}
