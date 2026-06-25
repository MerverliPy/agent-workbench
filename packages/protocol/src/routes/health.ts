import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const HealthResponse = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
  version: z.string().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const HealthRoute = {
  method: "GET" as const,
  path: "/global/health",
  response: HealthResponse,
  errors: [ErrorEnvelope],
} as const;
