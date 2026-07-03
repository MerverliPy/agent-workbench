import type {
  ProviderEntry,
  ProviderModelEntry,
} from "@agent-workbench/models";
import type {
  Model as ProtocolModel,
  ModelProvider as ProtocolModelProvider,
} from "@agent-workbench/protocol";
import {
  GetProviderRoute,
  ListProviderModelsRoute,
  ListProvidersRoute,
} from "@agent-workbench/protocol";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

export function registerProviderRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { providerRegistry } = services;

  app.get(
    ListProvidersRoute.path,
    createJsonRouteHandler(ListProvidersRoute, () => {
      const items = providerRegistry.listMetadata();
      const result: { items: ProtocolModelProvider[] } = {
        items: items.map((entry: ProviderEntry) => ({
          id: entry.id,
          name: entry.name,
          status: entry.status,
          ...(entry.description !== undefined
            ? { description: entry.description }
            : {}),
        })),
      };
      return result;
    }),
  );

  app.get(
    GetProviderRoute.path,
    createJsonRouteHandler(GetProviderRoute, (_ctx, { validated }) => {
      const { providerId } = validated.pathParams as { providerId: string };
      const entry = providerRegistry.getMetadata(providerId);
      if (entry === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Provider not found: ${providerId}`,
          recoverable: true,
        });
      }
      return {
        id: entry.id,
        name: entry.name,
        status: entry.status,
        ...(entry.description !== undefined
          ? { description: entry.description }
          : {}),
      };
    }),
  );

  app.get(
    ListProviderModelsRoute.path,
    createJsonRouteHandler(ListProviderModelsRoute, (_ctx, { validated }) => {
      const { providerId } = validated.pathParams as { providerId: string };
      const entry = providerRegistry.getMetadata(providerId);
      if (entry === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Provider not found: ${providerId}`,
          recoverable: true,
        });
      }
      const models = providerRegistry.listModels(providerId);
      const result: { items: ProtocolModel[] } = {
        items: models.map((m: ProviderModelEntry) => ({
          id: m.id,
          providerId: m.providerId,
          name: m.name,
          capabilities: m.capabilities,
          ...(m.contextLimit !== undefined
            ? { contextLimit: m.contextLimit }
            : {}),
        })),
      };
      return result;
    }),
  );
}
