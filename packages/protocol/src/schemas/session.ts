import { z } from "zod/v4";
import { AgentId } from "./agent";
import { Timestamp, Ulid } from "./common";

export const SessionStatus = z.enum([
  "active",
  "idle",
  "aborted",
  "archived",
  "deleted",
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const Session = z.object({
  id: Ulid,
  projectPath: z.string(),
  title: z.string().optional(),
  activeAgent: AgentId.optional(),
  status: SessionStatus,
  /** Optional workspace ID for grouping sessions by project. */
  workspaceId: Ulid.optional(),
  /** User-defined tags for grouping/filtering sessions. */
  tags: z.array(z.string()).optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastRunAt: Timestamp.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type Session = z.infer<typeof Session>;

export const CreateSessionRequest = z.object({
  projectPath: z.string(),
  title: z.string().optional(),
  workspaceId: Ulid.optional(),
  tags: z.array(z.string()).optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const UpdateSessionRequest = z.object({
  title: z.string().optional(),
  activeAgent: AgentId.optional(),
  status: SessionStatus.optional(),
  workspaceId: Ulid.optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequest>;
