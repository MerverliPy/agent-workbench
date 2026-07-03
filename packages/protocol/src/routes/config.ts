import { z } from "zod/v4";
import { Config } from "../schemas/config";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const GetConfigRoute = {
  method: "GET" as const,
  path: "/config",
  response: Config,
  errors: [ErrorEnvelope],
} as const;

export const GetEffectiveConfigRoute = {
  method: "GET" as const,
  path: "/config/effective",
  response: Config,
  errors: [ErrorEnvelope],
} as const;

export const ValidateConfigRoute = {
  method: "POST" as const,
  path: "/config/validate",
  body: Config,
  response: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
  }),
  errors: [ErrorEnvelope],
} as const;
