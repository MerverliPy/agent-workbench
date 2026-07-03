import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Hono } from "hono";
import type { ServerAppBindings, ServerServices } from "../context";
import { ApiError } from "../errors";
import { createLogger } from "../utils/logger";

const logger = createLogger("plugin-routes");

/**
 * Phase 26 plugin management routes.
 *
 * GET    /plugins                 — list installed plugins
 * GET    /plugins/:name           — get plugin details
 * POST   /plugins                 — install a plugin
 * POST   /plugins/:name/enable    — enable a plugin
 * POST   /plugins/:name/disable   — disable a plugin
 * DELETE /plugins/:name           — uninstall a plugin
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

  // ── Install a plugin ──────────────────────────────────────────────────────

  app.post("/plugins", async (ctx) => {
    const body = (await ctx.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body.source !== "string") {
      throw new ApiError({
        status: 400,
        code: "BAD_REQUEST",
        message:
          "Request body must include 'source' (e.g. 'local:/path/to/plugin')",
        recoverable: true,
      });
    }

    const source = body.source as string;
    const pluginsDir = pluginRegistry.getPluginsDir();

    // ── Local path install ──────────────────────────────────────────────
    if (source.startsWith("local:")) {
      const localPath = source.slice("local:".length);
      if (!existsSync(localPath)) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: `Plugin directory not found: ${localPath}`,
          recoverable: true,
        });
      }

      // Validate manifest
      let manifest;
      try {
        manifest = pluginRegistry.loadManifest(localPath);
      } catch (err) {
        throw new ApiError({
          status: 400,
          code: "BAD_REQUEST",
          message: `Invalid plugin manifest: ${err instanceof Error ? err.message : String(err)}`,
          recoverable: true,
        });
      }

      // Check for duplicate
      if (pluginRegistry.get(manifest.name)) {
        throw new ApiError({
          status: 409,
          code: "CONFLICT",
          message: `Plugin already installed: ${manifest.name}`,
          recoverable: true,
        });
      }

      // Copy plugin to plugins directory
      const installDir = join(pluginsDir, manifest.name);
      try {
        mkdirSync(installDir, { recursive: true });
        cpSync(localPath, installDir, { recursive: true });
        logger.info(`Installed plugin from ${localPath} → ${installDir}`);
      } catch (err) {
        throw new ApiError({
          status: 500,
          code: "INTERNAL_ERROR",
          message: `Failed to copy plugin: ${err instanceof Error ? err.message : String(err)}`,
          recoverable: false,
        });
      }

      // Register
      const record = pluginRegistry.register(manifest, source, installDir);
      return ctx.json(record, 201);
    }

    // ── npm install (placeholder) ───────────────────────────────────────
    if (source.startsWith("npm:")) {
      throw new ApiError({
        status: 501,
        code: "NOT_IMPLEMENTED",
        message:
          "npm plugin installation is not yet supported. Use 'local:' source.",
        recoverable: true,
      });
    }

    // ── git install (placeholder) ───────────────────────────────────────
    if (source.startsWith("git:") || source.startsWith("github:")) {
      throw new ApiError({
        status: 501,
        code: "NOT_IMPLEMENTED",
        message:
          "Git plugin installation is not yet supported. Use 'local:' source.",
        recoverable: true,
      });
    }

    throw new ApiError({
      status: 400,
      code: "BAD_REQUEST",
      message:
        "Unsupported source type. Use 'local:', 'npm:', or 'git:' prefix.",
      recoverable: true,
    });
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

  // ── Uninstall a plugin ───────────────────────────────────────────────────

  app.delete("/plugins/:name", (ctx) => {
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

    // Remove plugin directory
    try {
      rmSync(plugin.installPath, { recursive: true, force: true });
      logger.info(`Removed plugin directory: ${plugin.installPath}`);
    } catch (err) {
      logger.warn(
        `Failed to remove plugin directory ${plugin.installPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Unregister
    pluginRegistry.unregister(name);
    return ctx.json({ uninstalled: true, name });
  });
}
