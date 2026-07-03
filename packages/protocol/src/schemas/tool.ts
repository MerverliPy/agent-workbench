import { z } from "zod/v4";
import { Timestamp, Ulid } from "./common";

export const ToolCallStatus = z.enum([
  "requested",
  "permission_pending",
  "running",
  "completed",
  "failed",
  "denied",
  "aborted",
]);
export type ToolCallStatus = z.infer<typeof ToolCallStatus>;

export const ToolDefinition = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.unknown(),
  outputSchema: z.unknown().optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinition>;

export const ToolCall = z.object({
  id: Ulid,
  sessionId: Ulid,
  runId: Ulid.optional(),
  messageId: Ulid.optional(),
  toolName: z.string(),
  status: ToolCallStatus,
  input: z.unknown(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  startedAt: Timestamp.optional(),
  completedAt: Timestamp.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ToolCall = z.infer<typeof ToolCall>;

export const ToolResult = z.object({
  toolCallId: Ulid,
  result: z.unknown(),
  error: z.string().optional(),
  completedAt: Timestamp,
});
export type ToolResult = z.infer<typeof ToolResult>;
