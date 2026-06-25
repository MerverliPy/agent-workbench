import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const GlobalInfoResponse = z.object({
  version: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  uptime: z.number(),
  serverTime: z.string().datetime(),
  capabilities: z.array(z.string()).optional(),
});
export type GlobalInfoResponse = z.infer<typeof GlobalInfoResponse>;

export const GlobalInfoRoute = {
  method: "GET" as const,
  path: "/global/info",
  response: GlobalInfoResponse,
  errors: [ErrorEnvelope],
} as const;
