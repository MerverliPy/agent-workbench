import { z } from "zod/v4";
import { Ulid } from "./common";

/**
 * Event payload for a streaming content delta from the model.
 * Emitted for each incremental text chunk during streaming.
 */
export const ModelStreamDeltaPayload = z.object({
  runId: Ulid,
  delta: z.string(),
});
export type ModelStreamDeltaPayload = z.infer<typeof ModelStreamDeltaPayload>;

/**
 * Event payload emitted when streaming completes successfully.
 * Carries the full accumulated content and final metadata.
 */
export const ModelStreamCompletePayload = z.object({
  runId: Ulid,
  content: z.string(),
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
    })
    .optional(),
  stopReason: z.string().optional(),
});
export type ModelStreamCompletePayload = z.infer<
  typeof ModelStreamCompletePayload
>;

/**
 * Event payload emitted when streaming is aborted or fails.
 */
export const ModelStreamErrorPayload = z.object({
  runId: Ulid,
  message: z.string(),
});
export type ModelStreamErrorPayload = z.infer<typeof ModelStreamErrorPayload>;

/** Event type strings for streaming model responses. */
export const STREAM_EVENT_TYPES = {
  DELTA: "model.stream_delta",
  COMPLETE: "model.stream_complete",
  ERROR: "model.stream_error",
} as const;
