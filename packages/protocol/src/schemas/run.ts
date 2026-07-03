import { z } from "zod/v4";
import { Timestamp, Ulid } from "./common";

export const RunStatus = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "aborted",
]);
export type RunStatus = z.infer<typeof RunStatus>;

export const Run = z.object({
  id: Ulid,
  sessionId: Ulid,
  status: RunStatus,
  createdAt: Timestamp,
  completedAt: Timestamp.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Run = z.infer<typeof Run>;
