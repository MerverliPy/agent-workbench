import type { Hono } from "hono";
import {
  ListProviderProfilesRoute,
  GetProviderProfileRoute,
  CreateProviderProfileRoute,
  UpdateProviderProfileRoute,
  DeleteProviderProfileRoute,
  TestProviderConnectionRoute,
} from "@agent-workbench/protocol";
import { ulid } from "ulid";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createJsonRouteHandler } from "./helpers";

interface ProfileCreateBody {
  id?: string;
  name: string;
  providerType: string;
  model: string;
  baseUrl?: string;
  tier?: string;
  taskCategories?: string[];
  contextLimit?: number;
  costPer1KInput?: number;
  costPer1KOutput?: number;
  supportsStreaming?: boolean;
  enabled?: boolean;
  apiKey?: string;
}

interface ProfileUpdateBody {
  name?: string;
  providerType?: string;
  model?: string;
  baseUrl?: string;
  tier?: string;
  taskCategories?: string[];
  contextLimit?: number;
  costPer1KInput?: number;
  costPer1KOutput?: number;
  supportsStreaming?: boolean;
  enabled?: boolean;
  apiKey?: string;
}

export function registerMarketplaceRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { providerMarketplace, smartRouter, costTracker, providerHealthMonitor } = services;

  // ── List all provider profiles ────────────────────────────────────────────

  app.get(
    ListProviderProfilesRoute.path,
    createJsonRouteHandler(ListProviderProfilesRoute, () => {
      const items = providerMarketplace.list({ enabledOnly: false });
      return { items };
    }),
  );

  // ── Get a single provider profile ─────────────────────────────────────────

  app.get(
    GetProviderProfileRoute.path,
    createJsonRouteHandler(GetProviderProfileRoute, (_ctx, { validated }) => {
      const { id } = validated.pathParams as { id: string };
      const profile = providerMarketplace.get(id);
      if (profile === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Provider profile not found: ${id}`,
          recoverable: true,
        });
      }
      return profile;
    }),
  );

  // ── Create a provider profile ─────────────────────────────────────────────

  app.post(
    CreateProviderProfileRoute.path,
    createJsonRouteHandler(CreateProviderProfileRoute, (_ctx, { validated }) => {
      const body = validated.body as ProfileCreateBody;
      const id = body.id ?? `provider-${ulid().toLowerCase()}`;

      const profile = providerMarketplace.create({
        id,
        name: body.name,
        providerType: body.providerType,
        model: body.model,
        ...(body.baseUrl !== undefined ? { baseUrl: body.baseUrl } : {}),
        ...(body.tier !== undefined ? { tier: body.tier } : {}),
        ...(body.taskCategories !== undefined
          ? { taskCategories: body.taskCategories }
          : {}),
        ...(body.contextLimit !== undefined
          ? { contextLimit: body.contextLimit }
          : {}),
        ...(body.costPer1KInput !== undefined
          ? { costPer1KInput: body.costPer1KInput }
          : {}),
        ...(body.costPer1KOutput !== undefined
          ? { costPer1KOutput: body.costPer1KOutput }
          : {}),
        ...(body.supportsStreaming !== undefined
          ? { supportsStreaming: body.supportsStreaming }
          : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.apiKey !== undefined ? { apiKey: body.apiKey } : {}),
      });

      if (body.apiKey && body.apiKey.length > 0) {
        providerMarketplace.setApiKey(profile.id, body.apiKey);
      }

      return profile;
    }),
  );

  // ── Update a provider profile ─────────────────────────────────────────────

  app.patch(
    UpdateProviderProfileRoute.path,
    createJsonRouteHandler(UpdateProviderProfileRoute, (_ctx, { validated }) => {
      const { id } = validated.pathParams as { id: string };
      const body = validated.body as ProfileUpdateBody;

      const existing = providerMarketplace.get(id);
      if (existing === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Provider profile not found: ${id}`,
          recoverable: true,
        });
      }

      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.providerType !== undefined) patch.providerType = body.providerType;
      if (body.model !== undefined) patch.model = body.model;
      if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl;
      if (body.tier !== undefined) patch.tier = body.tier;
      if (body.taskCategories !== undefined) patch.taskCategories = body.taskCategories;
      if (body.contextLimit !== undefined) patch.contextLimit = body.contextLimit;
      if (body.costPer1KInput !== undefined) patch.costPer1KInput = body.costPer1KInput;
      if (body.costPer1KOutput !== undefined) patch.costPer1KOutput = body.costPer1KOutput;
      if (body.supportsStreaming !== undefined) patch.supportsStreaming = body.supportsStreaming;
      if (body.enabled !== undefined) patch.enabled = body.enabled;
      if (body.apiKey !== undefined) patch.apiKey = body.apiKey;

      const profile = providerMarketplace.update(id, patch);

      if (body.apiKey !== undefined) {
        if (body.apiKey.length > 0) {
          providerMarketplace.setApiKey(profile.id, body.apiKey);
        } else {
          providerMarketplace.deleteApiKey(profile.id);
        }
      }

      return profile;
    }),
  );

  // ── Delete a provider profile ─────────────────────────────────────────────

  app.delete(
    DeleteProviderProfileRoute.path,
    createJsonRouteHandler(DeleteProviderProfileRoute, (_ctx, { validated }) => {
      const { id } = validated.pathParams as { id: string };
      providerMarketplace.deleteApiKey(id);
      const deleted = providerMarketplace.delete(id);
      if (!deleted) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Provider profile not found: ${id}`,
          recoverable: true,
        });
      }
      return { deleted: true };
    }),
  );

  // ── Test a provider connection ────────────────────────────────────────────

  app.post(
    TestProviderConnectionRoute.path,
    createJsonRouteHandler(TestProviderConnectionRoute, async (_ctx, { validated }) => {
      const { id } = validated.pathParams as { id: string };
      const profile = providerMarketplace.get(id);
      if (profile === undefined) {
        throw new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: `Provider profile not found: ${id}`,
          recoverable: true,
        });
      }

      try {
        const status = await providerHealthMonitor.checkProvider(profile);
        return {
          ok: status.status === "healthy" || status.status === "unknown",
          latencyMs: status.lastLatencyMs,
          error: status.lastError,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );
}
