/**
 * Plugin loader — discovers and loads plugins from the plugin registry.
 *
 * Responsible for dynamically importing plugin entry points, registering
 * their tools with the tool registry. Provider/panel/hook support will
 * be added in future phases.
 */

import type { PluginRecord } from "@agent-workbench/plugin-sdk";
import type { PluginManifest, PluginRegistry, ToolPlugin } from "@agent-workbench/plugin-sdk";
import type { ToolRegistry } from "@agent-workbench/tools";
import { createLogger } from "./utils/logger";

const logger = createLogger("plugin-loader");

/** Shape of a default-exported tool plugin after dynamic import. */
interface DynamicToolModule {
  default?: ToolPlugin;
  name?: string;
  version?: string;
  tools?: ToolPlugin["tools"];
}

/**
 * Load a single tool plugin and register its tools with the tool registry.
 */
export async function loadToolPlugin(
  manifest: PluginManifest,
  toolRegistry: ToolRegistry,
): Promise<boolean> {
  try {
    const mod = (await import(manifest.main)) as DynamicToolModule;
    const plugin = mod.default ?? (mod as unknown as ToolPlugin);

    if (!plugin.tools || !Array.isArray(plugin.tools)) {
      logger.warn(`Tool plugin ${manifest.name} has no tools array`);
      return false;
    }

    for (const tool of plugin.tools) {
      if (!tool.name || typeof tool.execute !== "function") {
        logger.warn(`Skipping invalid tool in plugin ${manifest.name}: missing name or execute`);
        continue;
      }

      toolRegistry.registerInline(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters,
        },
        {
          execute: (input: unknown, context) => tool.execute(input as Record<string, unknown>),
        },
      );
    }

    logger.info(`Loaded tool plugin: ${manifest.name} (${plugin.tools.length} tools)`);
    return true;
  } catch (err) {
    logger.error(`Failed to load tool plugin ${manifest.name}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Load all enabled plugins from the registry.
 */
export async function loadAllPlugins(
  pluginRegistry: PluginRegistry,
  toolRegistry: ToolRegistry,
): Promise<{ loaded: number; failed: number }> {
  const plugins = pluginRegistry.list().filter((p: PluginRecord) => p.enabled);
  let loaded = 0;
  let failed = 0;

  for (const record of plugins) {
    try {
      const manifest = pluginRegistry.loadManifest(record.installPath);
      const ok = await loadToolPlugin(manifest, toolRegistry);
      if (ok) loaded++;
      else failed++;
    } catch (err) {
      logger.warn(`Skipping plugin ${record.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  logger.info(`Plugin scan complete: ${loaded} loaded, ${failed} failed`);
  return { loaded, failed };
}
