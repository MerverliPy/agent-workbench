import { ErrorEnvelope } from "../schemas/error-envelope";
import { TokenHealthStatus } from "../schemas/token-health";
import { SessionIdParams } from "./session";

export const GetTokenHealthRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/token-health",
  pathParams: SessionIdParams,
  response: TokenHealthStatus,
  errors: [ErrorEnvelope],
} as const;
