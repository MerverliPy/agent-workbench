import {
  CreateWorkspaceRoute,
  DeleteWorkspaceRoute,
  GetWorkspaceRoute,
  ListWorkspacesRoute,
  UpdateWorkspaceRoute,
} from "@agent-workbench/protocol";
import type { Hono } from "hono";
import { ulid } from "ulid";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

export function registerWorkspaceRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { workspaceRepository } = services as ServerServices & {
    workspaceRepository: import("@agent-workbench/storage").WorkspaceRepository;
  };

  // POST /workspace
  app.post(
    CreateWorkspaceRoute.path,
    createJsonRouteHandler(CreateWorkspaceRoute, (_ctx, { validated }) => {
      const body = validated.body as {
        name: string;
        rootPath: string;
        description?: string;
        tags?: string[];
      };
      const now = new Date().toISOString();
      const id = ulid();
      const row = workspaceRepository.create({
        id,
        name: body.name,
        rootPath: body.rootPath,
        description: body.description ?? null,
        archived: false,
        tagsJson: body.tags ? JSON.stringify(body.tags) : null,
        createdAt: now,
        updatedAt: now,
      });
      return rowToProtocol(row);
    }),
  );

  // GET /workspace
  app.get(
    ListWorkspacesRoute.path,
    createJsonRouteHandler(ListWorkspacesRoute, (_ctx, { validated }) => {
      const query = (validated.query ?? {}) as { archived?: boolean };
      const rows = workspaceRepository.list(query.archived ?? false);
      return { items: rows.map(rowToProtocol) };
    }),
  );

  // GET /workspace/:workspaceId
  app.get(
    GetWorkspaceRoute.path,
    createJsonRouteHandler(GetWorkspaceRoute, (_ctx, { validated }) => {
      const { workspaceId } = validated.pathParams as {
        workspaceId: string;
      };
      const row = workspaceRepository.findById(workspaceId);
      if (!row) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Workspace not found: ${workspaceId}`,
          recoverable: true,
        });
      }
      return rowToProtocol(row);
    }),
  );

  // PATCH /workspace/:workspaceId
  app.patch(
    UpdateWorkspaceRoute.path,
    createJsonRouteHandler(UpdateWorkspaceRoute, (_ctx, { validated }) => {
      const { workspaceId } = validated.pathParams as {
        workspaceId: string;
      };
      const body = validated.body as {
        name?: string;
        rootPath?: string;
        description?: string;
        archived?: boolean;
        tags?: string[];
      };
      const existing = workspaceRepository.findById(workspaceId);
      if (!existing) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Workspace not found: ${workspaceId}`,
          recoverable: true,
        });
      }

      const patch: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (body.name !== undefined) patch.name = body.name;
      if (body.rootPath !== undefined) patch.rootPath = body.rootPath;
      if (body.description !== undefined) patch.description = body.description;
      if (body.archived !== undefined) patch.archived = body.archived;
      if (body.tags !== undefined) patch.tagsJson = JSON.stringify(body.tags);

      const updated = workspaceRepository.update(
        workspaceId,
        patch as Parameters<typeof workspaceRepository.update>[1],
      );
      if (!updated) {
        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: "Failed to update workspace",
          recoverable: false,
        });
      }
      return rowToProtocol(updated);
    }),
  );

  // DELETE /workspace/:workspaceId
  app.delete(
    DeleteWorkspaceRoute.path,
    createJsonRouteHandler(DeleteWorkspaceRoute, (_ctx, { validated }) => {
      const { workspaceId } = validated.pathParams as {
        workspaceId: string;
      };
      const deleted = workspaceRepository.delete(workspaceId);
      if (!deleted) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Workspace not found: ${workspaceId}`,
          recoverable: true,
        });
      }
      return { deleted: true };
    }),
  );
}

function rowToProtocol(
  row: import("@agent-workbench/storage").WorkspaceRow,
): import("@agent-workbench/protocol").Workspace {
  let tags: string[] | undefined;
  if (row.tagsJson) {
    try {
      tags = JSON.parse(row.tagsJson);
    } catch {
      tags = [];
    }
  }
  return {
    id: row.id,
    name: row.name,
    rootPath: row.rootPath,
    description: row.description ?? undefined,
    archived: row.archived ?? false,
    tags,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
