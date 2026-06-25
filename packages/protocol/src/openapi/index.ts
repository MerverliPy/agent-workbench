import { z } from "zod/v4";
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { HealthRoute } from "../routes/health";
import { EventRoute } from "../routes/event";
import {
  CreateSessionRoute,
  ListSessionsRoute,
  GetSessionRoute,
  UpdateSessionRoute,
  AbortSessionRoute,
  SummarizeSessionRoute,
  DeleteSessionRoute,
} from "../routes/session";
import {
  SubmitMessageRoute,
  ListMessagesRoute,
  GetMessageRoute,
} from "../routes/message";
import {
  GetConfigRoute,
  GetEffectiveConfigRoute,
  ValidateConfigRoute,
} from "../routes/config";
import {
  ListProvidersRoute,
  GetProviderRoute,
  ListProviderModelsRoute,
} from "../routes/provider";
import {
  ListFilesRoute,
  ReadFileRoute,
  GetFileDiffRoute,
  GetFileTreeRoute,
} from "../routes/file";
import {
  ListPermissionRequestsRoute,
  GetPermissionRequestRoute,
  DecidePermissionRoute,
  GetEffectivePolicyRoute,
} from "../routes/permission";
import { ListToolsRoute, GetToolRoute } from "../routes/tool";
import { PrefillPromptRoute, FocusRoute, GetTuiStateRoute } from "../routes/tui";
import { CreateTokenRoute, GetAuthStatusRoute } from "../routes/auth";
import { ErrorEnvelope } from "../schemas/error-envelope";

function registerRoute(
  registry: OpenAPIRegistry,
  route: {
    method: string;
    path: string;
    response: z.ZodType;
    body?: z.ZodType;
    params?: z.ZodType;
  },
) {
  const pathConfig: Parameters<typeof registry.registerPath>[0] = {
    method: route.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete",
    path: route.path,
    responses: {
      200: {
        description: "Success",
        content: {
          "application/json": {
            schema: route.response,
          },
        },
      },
    },
  };
  if (route.body) {
    pathConfig.request = {
      body: {
        content: { "application/json": { schema: route.body } },
      },
    };
  }
  registry.registerPath(pathConfig);
}

export function createOpenApiDocument(title: string, version: string) {
  const registry = new OpenAPIRegistry();

  registry.register("ErrorEnvelope", ErrorEnvelope);

  registerRoute(registry, HealthRoute);
  registerRoute(registry, EventRoute);
  registerRoute(registry, CreateSessionRoute);
  registerRoute(registry, ListSessionsRoute);
  registerRoute(registry, GetSessionRoute);
  registerRoute(registry, UpdateSessionRoute);
  registerRoute(registry, AbortSessionRoute);
  registerRoute(registry, SummarizeSessionRoute);
  registerRoute(registry, DeleteSessionRoute);
  registerRoute(registry, SubmitMessageRoute);
  registerRoute(registry, ListMessagesRoute);
  registerRoute(registry, GetMessageRoute);
  registerRoute(registry, GetConfigRoute);
  registerRoute(registry, GetEffectiveConfigRoute);
  registerRoute(registry, ValidateConfigRoute);
  registerRoute(registry, ListProvidersRoute);
  registerRoute(registry, GetProviderRoute);
  registerRoute(registry, ListProviderModelsRoute);
  registerRoute(registry, ListFilesRoute);
  registerRoute(registry, ReadFileRoute);
  registerRoute(registry, GetFileDiffRoute);
  registerRoute(registry, GetFileTreeRoute);
  registerRoute(registry, ListPermissionRequestsRoute);
  registerRoute(registry, GetPermissionRequestRoute);
  registerRoute(registry, DecidePermissionRoute);
  registerRoute(registry, GetEffectivePolicyRoute);
  registerRoute(registry, ListToolsRoute);
  registerRoute(registry, GetToolRoute);
  registerRoute(registry, PrefillPromptRoute);
  registerRoute(registry, FocusRoute);
  registerRoute(registry, GetTuiStateRoute);
  registerRoute(registry, CreateTokenRoute);
  registerRoute(registry, GetAuthStatusRoute);

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title,
      version,
      description: "agent-workbench local API",
    },
    servers: [{ url: "http://localhost:3000", description: "Local development" }],
  }) as unknown as Record<string, unknown>;
}
