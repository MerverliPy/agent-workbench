import { z } from "zod/v4";
import { ErrorEnvelope } from "../schemas/error-envelope";
import { Workspace, CreateWorkspaceRequest, UpdateWorkspaceRequest } from "../schemas/workspace";
import { Ulid, Pagination } from "../schemas/common";

export const WorkspaceIdParams = z.object({
  workspaceId: z.string().min(1),
});

export const CreateWorkspaceRoute = {
  method: "POST" as const,
  path: "/workspace",
  body: CreateWorkspaceRequest,
  response: Workspace,
  errors: [ErrorEnvelope],
} as const;

export const ListWorkspacesRoute = {
  method: "GET" as const,
  path: "/workspace",
  query: Pagination.extend({
    archived: z.boolean().optional(),
  }).optional(),
  response: z.object({ items: z.array(Workspace), nextCursor: Ulid.optional() }),
  errors: [ErrorEnvelope],
} as const;

export const GetWorkspaceRoute = {
  method: "GET" as const,
  path: "/workspace/:workspaceId",
  pathParams: WorkspaceIdParams,
  response: Workspace,
  errors: [ErrorEnvelope],
} as const;

export const UpdateWorkspaceRoute = {
  method: "PATCH" as const,
  path: "/workspace/:workspaceId",
  pathParams: WorkspaceIdParams,
  body: UpdateWorkspaceRequest,
  response: Workspace,
  errors: [ErrorEnvelope],
} as const;

export const DeleteWorkspaceRoute = {
  method: "DELETE" as const,
  path: "/workspace/:workspaceId",
  pathParams: WorkspaceIdParams,
  response: z.object({ deleted: z.boolean() }),
  errors: [ErrorEnvelope],
} as const;
