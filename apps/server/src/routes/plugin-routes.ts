import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";

/**
 * Phase 26 plugin management routes.
 *
 * GET    /plugins          — list installed plugins
 * GET    /plugins/:name    — get plugin details
 * POST   /plugins/:name/enable   — enable a plugin
 * POST   /plugins/:name/disable  — disable a plugin
 */
export function registerPluginRoutes(
  app: Hono<ServerAppBindings>,
  services: ServerServices,
): void {
  const { pluginRegistry } = services;

  // ── List all plugins ──────────────────────────────────────────────────────

  app.get("/plugins", (ctx) => {
    const plugins = pluginRegistry.list();
    return ctx.json({
      items: plugins.map((p) => ({
        name: p.name,
        version: p.version,
        source: p.source,
        enabled: p.enabled,
        installedAt: p.installedAt,
        lastError: p.lastError,
      })),
    });
  });

  // ── Get a single plugin ───────────────────────────────────────────────────

  app.get("/plugins/:name", (ctx) => {
    const name = ctx.req.param("name");
    if (!name) {
      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Plugin name is required",
        recoverable: true,
      });
    }

    const plugin = pluginRegistry.get(name);
    if (!plugin) {
      throw new ApiError({
        status: 404,
        code: "NOT_FOUND",
        message: `Plugin not found: ${name}`,
        recoverable: true,
      });
    }

    return ctx.json(plugin);
  });

  // ── Enable a plugin ───────────────────────────────────────────────────────

  app.post("/plugins/:name/enable", (ctx) => {
    const name = ctx.req.param("name");
    if (!name) {
      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Plugin name is required",
        recoverable: true,
      });
    }

    const updated = pluginRegistry.enable(name);
    return ctx.json({ enabled: true, plugin: updated });
  });

  // ── Disable a plugin ──────────────────────────────────────────────────────

  app.post("/plugins/:name/disable", (ctx) => {
    const name = ctx.req.param("name");
    if (!name) {
      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message: "Plugin name is required",
        recoverable: true,
      });
    }

    const updated = pluginRegistry.disable(name);
    return ctx.json({ enabled: false, plugin: updated });
  });
}
