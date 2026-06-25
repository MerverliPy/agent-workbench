import { z } from "zod/v4";
import { Ulid, Pagination } from "../schemas/common";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { Message, SubmitMessageRequest, MessageRole } from "../schemas/message";

export const MessageListParams = Pagination.extend({
  role: MessageRole.optional(),
});

export const SubmitMessageRoute = {
  method: "POST" as const,
  path: "/session/:sessionId/message",
  body: SubmitMessageRequest,
  response: Message,
  errors: [ErrorEnvelope],
} as const;

export const ListMessagesRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/message",
  params: MessageListParams,
  response: z.object({ items: z.array(Message), nextCursor: Ulid.optional() }),
  errors: [ErrorEnvelope],
} as const;

export const GetMessageRoute = {
  method: "GET" as const,
  path: "/session/:sessionId/message/:messageId",
  response: Message,
  errors: [ErrorEnvelope],
} as const;
