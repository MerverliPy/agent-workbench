import { z } from "zod/v4";

export const ErrorDetail = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
  recoverable: z.boolean().optional(),
});
export type ErrorDetail = z.infer<typeof ErrorDetail>;

export const ErrorEnvelope = z.object({
  error: ErrorDetail,
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;
