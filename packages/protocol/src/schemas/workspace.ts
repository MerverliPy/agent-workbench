import { z } from "zod/v4";
import { Timestamp, Ulid } from "./common";

/**
 * Workspace — a project-level config container that groups sessions.
 * A workspace typically maps to a Git repo or project directory.
 */
export const Workspace = z.object({
  id: Ulid,
  name: z.string().min(1),
  /** Root path of the project on the host filesystem. */
  rootPath: z.string(),
  description: z.string().optional(),
  /** Active flag — archived workspaces are hidden by default. */
  archived: z.boolean().optional(),
  /** User-defined tags for organization. */
  tags: z.array(z.string()).optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Workspace = z.infer<typeof Workspace>;

export const CreateWorkspaceRequest = z.object({
  name: z.string().min(1),
  rootPath: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequest>;

export const UpdateWorkspaceRequest = z.object({
  name: z.string().min(1).optional(),
  rootPath: z.string().optional(),
  description: z.string().optional(),
  archived: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequest>;

/**
 * Session group — a lightweight tag-based grouping of sessions.
 * Sessions can belong to multiple groups via their `tags` array.
 */
export const SessionGroup = z.object({
  id: Ulid,
  name: z.string().min(1),
  /** Tag value that sessions must have to be in this group. */
  tag: z.string().min(1),
  workspaceId: Ulid,
  createdAt: Timestamp,
});
export type SessionGroup = z.infer<typeof SessionGroup>;
