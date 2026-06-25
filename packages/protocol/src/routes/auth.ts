import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";

export const AuthTokenRequest = z.object({
  secret: z.string(),
});
export type AuthTokenRequest = z.infer<typeof AuthTokenRequest>;

export const AuthTokenResponse = z.object({
  token: z.string(),
  expiresAt: z.string().datetime().optional(),
});
export type AuthTokenResponse = z.infer<typeof AuthTokenResponse>;

export const AuthStatusResponse = z.object({
  authenticated: z.boolean(),
  method: z.string().optional(),
});

export const CreateTokenRoute = {
  method: "POST" as const,
  path: "/auth/token",
  body: AuthTokenRequest,
  response: AuthTokenResponse,
  errors: [ErrorEnvelope],
} as const;

export const GetAuthStatusRoute = {
  method: "GET" as const,
  path: "/auth/status",
  response: AuthStatusResponse,
  errors: [ErrorEnvelope],
} as const;
