import { z } from "zod/v4";
import { Pagination, Ulid } from "../schemas/common";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { Message, MessageRole, SubmitMessageRequest } from "../schemas/message";

export const MessageListParams = Pagination.extend({
  role: MessageRole.optional(),
});

export const SessionMessageIdParams = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().min(1),
});

export const MessageSessionIdParams = z.object({
  sessionId: z.string().min(1),
});

export const SubmitMessageRoute = {
  method: "POST" as const,
  path: "/session/:sessionId/message",
  pathParams: MessageSessionIdParams,
  body: SubmitMessageRequest,
  response: Message,
  errors: [ErrorEnvelope],
} as const;

export const ListMessagesRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/message",
  pathParams: MessageSessionIdParams,
  query: MessageListParams,
  response: z.object({ items: z.array(Message), nextCursor: Ulid.optional() }),
  errors: [ErrorEnvelope],
} as const;

export const GetMessageRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/message/:messageId",
  pathParams: SessionMessageIdParams,
  response: Message,
  errors: [ErrorEnvelope],
} as const;
