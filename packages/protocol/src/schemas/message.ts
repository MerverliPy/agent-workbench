import { z } from "zod/v4";
import { Ulid, Timestamp } from "./common";

export const MessageRole = z.enum(["user", "assistant", "system", "tool", "summary"]);
export type MessageRole = z.infer<typeof MessageRole>;

export const ContentFormat = z.enum(["text", "json", "markdown"]);
export type ContentFormat = z.infer<typeof ContentFormat>;

export const Message = z.object({
  id: Ulid,
  sessionId: Ulid,
  runId: Ulid.optional(),
  role: MessageRole,
  content: z.string(),
  contentFormat: ContentFormat.default("text"),
  parentMessageId: Ulid.optional(),
  createdAt: Timestamp,
  metadata: z.record(z.string(), z.unknown()).optional(),
  tokenCount: z.number().int().nonnegative().optional(),
});
export type Message = z.infer<typeof Message>;

export const SubmitMessageRequest = z.object({
  content: z.string().min(1),
  role: MessageRole.default("user"),
  parentMessageId: Ulid.optional(),
});
export type SubmitMessageRequest = z.infer<typeof SubmitMessageRequest>;
