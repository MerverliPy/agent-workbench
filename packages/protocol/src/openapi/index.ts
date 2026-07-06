import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import type { z } from "zod/v4";
import { GetAgentRoute, ListAgentsRoute } from "../routes/agent";
import { CreateTokenRoute, GetAuthStatusRoute } from "../routes/auth";
import {
  GetConfigRoute,
  GetEffectiveConfigRoute,
  ValidateConfigRoute,
} from "../routes/config";
import { EventRoute } from "../routes/event";
import {
  GetFileDiffRoute,
  GetFileTreeRoute,
  ListFilesRoute,
  ReadFileRoute,
} from "../routes/file";
import { HealthRoute } from "../routes/health";
import { GlobalInfoRoute } from "../routes/info";
import {
  CreateProviderProfileRoute,
  DeleteProviderProfileRoute,
  GetProviderProfileRoute,
  ListProviderProfilesRoute,
  TestProviderConnectionRoute,
  UpdateProviderProfileRoute,
} from "../routes/marketplace";
import {
  GetMessageRoute,
  ListMessagesRoute,
  SubmitMessageRoute,
} from "../routes/message";
import {
  DecidePermissionRoute,
  GetEffectivePolicyRoute,
  GetPermissionRequestRoute,
  ListPermissionRequestsRoute,
} from "../routes/permission";
import {
  GetProviderRoute,
  ListProviderModelsRoute,
  ListProvidersRoute,
} from "../routes/provider";
import {
  AbortSessionRoute,
  CreateSessionRoute,
  DeleteSessionRoute,
  GetSessionRoute,
  ListSessionsRoute,
  SummarizeSessionRoute,
  UpdateSessionRoute,
} from "../routes/session";
import { GetTokenHealthRoute } from "../routes/token-health";
import { GetToolRoute, ListToolsRoute } from "../routes/tool";
import {
  FocusRoute,
  GetTuiStateRoute,
  PrefillPromptRoute,
} from "../routes/tui";
import { ErrorEnvelope } from "../schemas/error-envelope";
import type { RouteContract } from "../types";

function openApiMethod(
  method: string,
): "get" | "post" | "put" | "patch" | "delete" {
  return method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
}

function openApiPath(path: string): string {
  return path.replace(/:(\w+)/g, "{$1}");
}

function registerRoute(registry: OpenAPIRegistry, route: RouteContract) {
  const path = openApiPath(route.path);

  const responses: Record<
    string,
    { description: string; content?: Record<string, { schema: z.ZodType }> }
  > = {};

  if (route.isStream) {
    responses["200"] = {
      description: "SSE Event Stream",
      content: {
        "text/event-stream": {
          schema: route.response,
        },
      },
    };
  } else {
    responses["200"] = {
      description: "Success",
      content: {
        "application/json": {
          schema: route.response,
        },
      },
    };
  }

  for (const errorSchema of route.errors) {
    responses["400"] = {
      description: "Bad Request",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    };
    responses["500"] = {
      description: "Internal Server Error",
      content: {
        "application/json": {
          schema: errorSchema,
        },
      },
    };
  }

  const request: Record<string, unknown> = {};

  if (route.body) {
    request.body = {
      content: { "application/json": { schema: route.body } },
    };
  }

  if (route.query) {
    request.queryParams = route.query;
  }

  if (route.pathParams) {
    request.pathParams = route.pathParams;
  }

  registry.registerPath({
    method: openApiMethod(route.method),
    path,
    request:
      Object.keys(request).length > 0
        ? (request as Record<string, unknown>)
        : undefined,
    responses,
  });
}

export function createOpenApiDocument(title: string, version: string) {
  const registry = new OpenAPIRegistry();

  registry.register("ErrorEnvelope", ErrorEnvelope);

  const routes: RouteContract[] = [
    HealthRoute,
    EventRoute,
    GlobalInfoRoute,
    CreateSessionRoute,
    ListSessionsRoute,
    GetSessionRoute,
    UpdateSessionRoute,
    AbortSessionRoute,
    SummarizeSessionRoute,
    DeleteSessionRoute,
    SubmitMessageRoute,
    ListMessagesRoute,
    GetMessageRoute,
    GetConfigRoute,
    GetEffectiveConfigRoute,
    ValidateConfigRoute,
    ListProvidersRoute,
    GetProviderRoute,
    ListProviderModelsRoute,
    ListFilesRoute,
    ReadFileRoute,
    GetFileDiffRoute,
    GetFileTreeRoute,
    ListPermissionRequestsRoute,
    GetPermissionRequestRoute,
    DecidePermissionRoute,
    GetEffectivePolicyRoute,
    ListToolsRoute,
    GetToolRoute,
    ListAgentsRoute,
    GetAgentRoute,
    PrefillPromptRoute,
    FocusRoute,
    GetTuiStateRoute,
    GetTokenHealthRoute,
    CreateTokenRoute,
    GetAuthStatusRoute,
    ListProviderProfilesRoute,
    GetProviderProfileRoute,
    CreateProviderProfileRoute,
    UpdateProviderProfileRoute,
    DeleteProviderProfileRoute,
    TestProviderConnectionRoute,
  ];

  for (const route of routes) {
    registerRoute(registry, route);
  }

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title,
      version,
      description: "agent-workbench local API",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local development" },
    ],
  }) as unknown as Record<string, unknown>;
}
