import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const EventStreamParams = z.object({
  sessionId: z.string().optional(),
  types: z.array(z.string()).optional(),
});
export type EventStreamParams = z.infer<typeof EventStreamParams>;

export const EventRoute = {
  method: "GET" as const,
  path: "/global/event",
  query: EventStreamParams,
  response: z.undefined(),
  errors: [ErrorEnvelope],
  isStream: true as const,
} as const;
