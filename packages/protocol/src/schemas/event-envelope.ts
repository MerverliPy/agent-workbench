import { z } from "zod/v4";
import { Ulid, Timestamp } from "./common";

export const EventEnvelope = z.object({
  id: Ulid,
  type: z.string(),
  sessionId: Ulid.optional(),
  runId: Ulid.optional(),
  timestamp: Timestamp,
  payload: z.unknown(),
});
export type EventEnvelope = z.infer<typeof EventEnvelope>;
