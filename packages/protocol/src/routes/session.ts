import { z } from "zod/v4";
import { Pagination, Ulid } from "../schemas/common";
import { ErrorEnvelope } from "../schemas/error-envelope";
import {
  CreateSessionRequest,
  Session,
  UpdateSessionRequest,
} from "../schemas/session";

export const SessionListParams = Pagination.extend({
  status: z.string().optional(),
  projectPath: z.string().optional(),
});

export const CreateSessionRoute = {
  method: "POST" as const,
  path: "/session",
  body: CreateSessionRequest,
  response: Session,
  errors: [ErrorEnvelope],
} as const;

export const ListSessionsRoute = {
  method: "GET" as const,
  path: "/session",
  query: SessionListParams,
  response: z.object({ items: z.array(Session), nextCursor: Ulid.optional() }),
  errors: [ErrorEnvelope],
} as const;

export const SessionIdParams = z.object({
  sessionId: z.string().min(1),
});

export const GetSessionRoute = {
  method: "GET" as const,
  path: "/session/:sessionId",
  pathParams: SessionIdParams,
  response: Session,
  errors: [ErrorEnvelope],
} as const;

export const UpdateSessionRoute = {
  method: "PATCH" as const,
  path: "/session/:sessionId",
  pathParams: SessionIdParams,
  body: UpdateSessionRequest,
  response: Session,
  errors: [ErrorEnvelope],
} as const;

export const AbortSessionRoute = {
  method: "POST" as const,
  path: "/session/:sessionId/abort",
  pathParams: SessionIdParams,
  response: Session,
  errors: [ErrorEnvelope],
} as const;

export const SummarizeSessionRoute = {
  method: "POST" as const,
  path: "/session/:sessionId/summarize",
  pathParams: SessionIdParams,
  response: z.object({ summary: z.string() }),
  errors: [ErrorEnvelope],
} as const;

export const DeleteSessionRoute = {
  method: "DELETE" as const,
  path: "/session/:sessionId",
  pathParams: SessionIdParams,
  response: z.object({ deleted: z.boolean() }),
  errors: [ErrorEnvelope],
} as const;
