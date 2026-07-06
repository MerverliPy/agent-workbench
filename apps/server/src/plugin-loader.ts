/**
 * Plugin loader — discovers and loads plugins from the plugin registry.
 *
 * Responsible for dynamically importing plugin entry points, registering
 * their tools, providers, panels, and hooks with the appropriate registries.
 */

import { join } from "node:path";
import type {
  ModelMessage,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelToolCall,
  ProviderRegistry,
} from "@agent-workbench/models";
import type {
  HookPlugin,
  PanelPlugin,
  PluginManifest,
  PluginModelMessage,
  PluginModelProvider,
  PluginRecord,
  PluginRegistry,
  ProviderPlugin,
  ToolPlugin,
} from "@agent-workbench/plugin-sdk";
import type { ToolRegistry } from "@agent-workbench/tools";
import { createLogger } from "./utils/logger";

const logger = createLogger("plugin-loader");

/** Shape of a default-exported module after dynamic import. */
interface DynamicModule {
  default?: Record<string, unknown>;
  name?: string;
  version?: string;
  tools?: unknown[];
  providers?: unknown[];
  panels?: unknown[];
  hooks?: unknown[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve manifest.main relative to the plugin's install path. */
function resolveMain(manifest: PluginManifest, installPath: string): string {
  return join(installPath, manifest.main);
}

/** Convert PluginModelMessage[] to ModelMessage[] for the models package. */
function _toModelMessages(
  pluginMessages: PluginModelMessage[],
): ModelMessage[] {
  return pluginMessages.map((m) => {
    const msg = {
      role: m.role as ModelMessage["role"],
      content: m.content,
    } as unknown as Record<string, unknown>;
    if (m.toolCallId !== undefined) {
      msg.tool_call_id = m.toolCallId;
    }
    if (m.toolCalls !== undefined) {
      msg.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        input: tc.arguments, // Plugin uses "arguments", model uses "input"
      }));
    }
    return msg as unknown as ModelMessage;
  });
}

/** Convert plugin tool calls to model tool calls. */
function toModelToolCalls(
  pluginCalls: Array<{
    readonly id: string;
    readonly name: string;
    readonly arguments: Record<string, unknown>;
  }>,
): ModelToolCall[] {
  return pluginCalls.map((tc) => ({
    id: tc.id,
    name: tc.name,
    input: tc.arguments,
  }));
}

// ── Tool plugin loading ─────────────────────────────────────────────────────

/**
 * Load a single tool plugin and register its tools with the tool registry.
 */
export async function loadToolPlugin(
  manifest: PluginManifest,
  toolRegistry: ToolRegistry,
  installPath: string,
): Promise<boolean> {
  try {
    const entryPath = resolveMain(manifest, installPath);
    const mod = (await import(entryPath)) as DynamicModule;
    const plugin = (mod.default ?? mod) as unknown as ToolPlugin;

    if (!plugin.tools || !Array.isArray(plugin.tools)) {
      logger.warn(`Tool plugin ${manifest.name} has no tools array`);
      return false;
    }

    for (const tool of plugin.tools) {
      if (!tool.name || typeof tool.execute !== "function") {
        logger.warn(
          `Skipping invalid tool in plugin ${manifest.name}: missing name or execute`,
        );
        continue;
      }

      toolRegistry.registerInline(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters,
        },
        {
          execute: (input: unknown, _context) =>
            tool.execute(input as Record<string, unknown>),
        },
      );
    }

    logger.info(
      `Loaded tool plugin: ${manifest.name} (${plugin.tools.length} tools)`,
    );
    return true;
  } catch (err) {
    logger.error(
      `Failed to load tool plugin ${manifest.name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ── Provider plugin loading ─────────────────────────────────────────────────

/** Adapter that wraps a PluginModelProvider as a ModelProvider. */
function adaptPluginProvider(provider: PluginModelProvider): ModelProvider {
  const call = async (request: ModelRequest): Promise<ModelResponse> => {
    const messages: PluginModelMessage[] = request.messages.map(
      (m) =>
        ({
          role: m.role,
          content: m.content,
        }) as PluginModelMessage,
    );

    const result = await provider.call(messages);
    const response: ModelResponse = {
      kind:
        result.toolCalls && result.toolCalls.length > 0
          ? {
              type: "tool_calls" as const,
              calls: toModelToolCalls(result.toolCalls),
            }
          : { type: "text" as const, content: result.content },
    };
    if (result.usage !== undefined) {
      response.usage = result.usage;
    }
    return response;
  };

  let streamFn: ModelProvider["stream"];
  if (provider.stream) {
    streamFn = async function* (
      request: ModelRequest,
    ): AsyncIterable<ModelStreamChunk> {
      const messages: PluginModelMessage[] = request.messages.map(
        (m) =>
          ({
            role: m.role,
            content: m.content,
          }) as PluginModelMessage,
      );

      const stream = provider.stream!(messages);
      for await (const chunk of stream) {
        yield {
          content: chunk.delta,
          done: chunk.done,
        };
      }
    };
  }

  const providerObj: ModelProvider = { call };
  if (streamFn !== undefined) {
    providerObj.stream = streamFn;
  }
  return providerObj;
}

/**
 * Load a single provider plugin and register its providers with the provider registry.
 */
export async function loadProviderPlugin(
  manifest: PluginManifest,
  providerRegistry: ProviderRegistry,
  installPath: string,
): Promise<boolean> {
  try {
    const entryPath = resolveMain(manifest, installPath);
    const mod = (await import(entryPath)) as DynamicModule;
    const plugin = (mod.default ?? mod) as unknown as ProviderPlugin;

    if (!plugin.providers || !Array.isArray(plugin.providers)) {
      logger.warn(`Provider plugin ${manifest.name} has no providers array`);
      return false;
    }

    for (const provider of plugin.providers) {
      if (!provider.id || typeof provider.call !== "function") {
        logger.warn(
          `Skipping invalid provider in plugin ${manifest.name}: missing id or call`,
        );
        continue;
      }

      const adapted = adaptPluginProvider(provider);
      providerRegistry.registerPluginProvider(provider.id, adapted, {
        name: provider.name,
        description: `Plugin provider: ${provider.name}`,
        modelId: provider.id,
        modelName: provider.name,
      });
    }

    logger.info(
      `Loaded provider plugin: ${manifest.name} (${plugin.providers.length} providers)`,
    );
    return true;
  } catch (err) {
    logger.error(
      `Failed to load provider plugin ${manifest.name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ── Hook plugin loading ─────────────────────────────────────────────────────

type HookHandler = (ctx: Record<string, unknown>) => Promise<{
  allow: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}>;

/** In-memory store of registered hooks (keyed by event -> hook id -> handler). */
const hookRegistry = new Map<string, Map<string, HookHandler>>();

/**
 * Load a single hook plugin and register its hooks.
 */
export async function loadHookPlugin(
  manifest: PluginManifest,
  installPath: string,
): Promise<boolean> {
  try {
    const entryPath = resolveMain(manifest, installPath);
    const mod = (await import(entryPath)) as DynamicModule;
    const plugin = (mod.default ?? mod) as unknown as HookPlugin;

    if (!plugin.hooks || !Array.isArray(plugin.hooks)) {
      logger.warn(`Hook plugin ${manifest.name} has no hooks array`);
      return false;
    }

    for (const hook of plugin.hooks) {
      if (!hook.id || !hook.event || typeof hook.handler !== "function") {
        logger.warn(
          `Skipping invalid hook in plugin ${manifest.name}: missing id, event, or handler`,
        );
        continue;
      }

      if (!hookRegistry.has(hook.event)) {
        hookRegistry.set(hook.event, new Map());
      }
      // Wrap the typed handler to accept Record<string, unknown>
      const wrappedHandler: HookHandler = async (ctx) => {
        const result = await hook.handler(
          ctx as unknown as import("@agent-workbench/plugin-sdk").HookContext,
        );
        return {
          allow: result.allow,
          ...(result.reason !== undefined ? { reason: result.reason } : {}),
          ...(result.data !== undefined ? { data: result.data } : {}),
        };
      };
      hookRegistry.get(hook.event)?.set(hook.id, wrappedHandler);
    }

    logger.info(
      `Loaded hook plugin: ${manifest.name} (${plugin.hooks.length} hooks)`,
    );
    return true;
  } catch (err) {
    logger.error(
      `Failed to load hook plugin ${manifest.name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/** Execute all registered hooks for a lifecycle event. */
export async function executeHooks(
  event: string,
  context: Record<string, unknown>,
): Promise<{
  allowed: boolean;
  blocks: Array<{ id: string; reason?: string }>;
  modifiedData: Record<string, unknown>;
}> {
  const hooks = hookRegistry.get(event);
  let modifiedData = { ...context };
  const blocks: Array<{ id: string; reason?: string }> = [];

  if (!hooks || hooks.size === 0) {
    return { allowed: true, blocks, modifiedData };
  }

  for (const [hookId, handler] of hooks) {
    try {
      const result = await handler(modifiedData);
      if (!result.allow) {
        blocks.push({
          id: hookId,
          ...(result.reason !== undefined ? { reason: result.reason } : {}),
        });
      }
      if (result.data) {
        modifiedData = { ...modifiedData, ...result.data };
      }
    } catch (err) {
      logger.warn(
        `Hook ${hookId} threw: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { allowed: blocks.length === 0, blocks, modifiedData };
}

// ── Plugin sandboxing ───────────────────────────────────────────────────────

/** Permission flags declared by a plugin manifest. */
export interface PluginPermissions {
  readonly filesystemRead: boolean;
  readonly filesystemWrite: boolean;
  readonly network: boolean;
  readonly subprocess: boolean;
}

/** Default permissions when none declared — most restrictive. */
const DEFAULT_PERMISSIONS: PluginPermissions = {
  filesystemRead: false,
  filesystemWrite: false,
  network: false,
  subprocess: false,
};

/** Extract declared permissions from a manifest, with defaults. */
function getPluginPermissions(manifest: PluginManifest): PluginPermissions {
  const declared = manifest.permissions;
  if (!declared) return DEFAULT_PERMISSIONS;
  return {
    filesystemRead: declared.filesystemRead ?? false,
    filesystemWrite: declared.filesystemWrite ?? false,
    network: declared.network ?? false,
    subprocess: declared.subprocess ?? false,
  };
}

/** Whether the server allows unsafe (unrestricted) plugin execution. */
const ALLOW_UNSAFE_PLUGINS =
  process.env.AGENT_WORKBENCH_UNSAFE_PLUGINS === "1" ||
  process.env.AGENT_WORKBENCH_UNSAFE_PLUGINS === "true";

/**
 * Validate a plugin's declared permissions against sandbox policy.
 * Returns a list of warnings; if the list is non-empty, the plugin
 * may be rejected depending on the server's sandbox policy.
 */
export function validatePluginPermissions(manifest: PluginManifest): {
  allowed: boolean;
  warnings: string[];
} {
  const perms = getPluginPermissions(manifest);
  const warnings: string[] = [];

  if (ALLOW_UNSAFE_PLUGINS) {
    return {
      allowed: true,
      warnings: ["Unsafe plugin mode enabled — all plugins allowed."],
    };
  }

  if (perms.filesystemWrite) {
    warnings.push(
      `Plugin "${manifest.name}" requests filesystemWrite — this allows file mutations.`,
    );
  }
  if (perms.network) {
    warnings.push(
      `Plugin "${manifest.name}" requests network access — this allows outbound connections.`,
    );
  }
  if (perms.subprocess) {
    warnings.push(
      `Plugin "${manifest.name}" requests subprocess access — this allows command execution.`,
    );
  }

  // For Phase 26, we warn but allow. Future phases will block risky plugins.
  if (warnings.length > 0) {
    for (const w of warnings) {
      logger.warn(w);
    }
  }

  return { allowed: true, warnings };
}

/**
 * Create a sandboxed import wrapper that validates the plugin's declared
 * permissions before executing. This is a soft sandbox — it warns on
 * risky permissions but does not enforce syscall-level isolation.
 */
function _createSandboxedImport(manifest: PluginManifest, installPath: string) {
  validatePluginPermissions(manifest); // ensures warnings are logged

  return async (): Promise<DynamicModule> => {
    const entryPath = join(installPath, manifest.main);
    const mod = (await import(entryPath)) as DynamicModule;

    // Log declared vs actual extension points for auditing
    const plugin = (mod.default ?? mod) as Record<string, unknown>;
    const actual = {
      hasTools: Array.isArray(plugin.tools),
      hasProviders: Array.isArray(plugin.providers),
      hasHooks: Array.isArray(plugin.hooks),
      hasPanels: Array.isArray(plugin.panels),
    };

    logger.info(
      `Plugin ${manifest.name}: declared=[tools:${manifest.provides.tools.length}, ` +
        `providers:${manifest.provides.providers.length}, ` +
        `hooks:${manifest.provides.hooks.length}, ` +
        `panels:${manifest.provides.panels.length}], ` +
        `actual=[tools:${actual.hasTools}, providers:${actual.hasProviders}, ` +
        `hooks:${actual.hasHooks}, panels:${actual.hasPanels}]`,
    );

    return mod;
  };
}

// ── Panel plugin loading ────────────────────────────────────────────────────

/** In-memory store of registered panels (keyed by panel id). */
const panelRegistry = new Map<
  string,
  {
    id: string;
    title: string;
    icon: string;
    surfaces: string[];
    requiresAuth: boolean;
  }
>();

/**
 * Load a single panel plugin and register its panels.
 */
export async function loadPanelPlugin(
  manifest: PluginManifest,
  installPath: string,
): Promise<boolean> {
  try {
    const entryPath = resolveMain(manifest, installPath);
    const mod = (await import(entryPath)) as DynamicModule;
    const plugin = (mod.default ?? mod) as unknown as PanelPlugin;

    if (!plugin.panels || !Array.isArray(plugin.panels)) {
      logger.warn(`Panel plugin ${manifest.name} has no panels array`);
      return false;
    }

    for (const panel of plugin.panels) {
      if (!panel.id || !panel.title) {
        logger.warn(
          `Skipping invalid panel in plugin ${manifest.name}: missing id or title`,
        );
        continue;
      }

      panelRegistry.set(panel.id, {
        id: panel.id,
        title: panel.title,
        icon: panel.icon,
        surfaces: panel.surfaces as string[],
        requiresAuth: panel.requiresAuth ?? false,
      });
    }

    logger.info(
      `Loaded panel plugin: ${manifest.name} (${plugin.panels.length} panels)`,
    );
    return true;
  } catch (err) {
    logger.error(
      `Failed to load panel plugin ${manifest.name}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/** Get all registered panels. */
export function getRegisteredPanels(): Array<{
  id: string;
  title: string;
  icon: string;
  surfaces: string[];
  requiresAuth: boolean;
}> {
  return Array.from(panelRegistry.values());
}

// ── Bulk loading ────────────────────────────────────────────────────────────

export interface PluginLoadOptions {
  pluginRegistry: PluginRegistry;
  toolRegistry: ToolRegistry;
  providerRegistry: ProviderRegistry;
}

/**
 * Load all enabled plugins from the registry.
 * Dispatches to the appropriate loader based on the manifest's `provides` field.
 */
export async function loadAllPlugins(
  options: PluginLoadOptions,
): Promise<{ loaded: number; failed: number }> {
  const { pluginRegistry, toolRegistry, providerRegistry } = options;
  const plugins = pluginRegistry.list().filter((p: PluginRecord) => p.enabled);
  let loaded = 0;
  let failed = 0;

  for (const record of plugins) {
    try {
      const manifest = pluginRegistry.loadManifest(record.installPath);
      let pluginLoaded = false;
      const installPath = record.installPath;

      // Phase 26: validate sandbox permissions
      const perms = validatePluginPermissions(manifest);
      if (!perms.allowed) {
        logger.warn(
          `Plugin ${manifest.name} blocked by sandbox policy: ${perms.warnings.join("; ")}`,
        );
        failed++;
        continue;
      }

      // Load tools
      if (manifest.provides.tools.length > 0) {
        const ok = await loadToolPlugin(manifest, toolRegistry, installPath);
        if (ok) {
          pluginLoaded = true;
          loaded++;
        } else {
          failed++;
        }
      }

      // Load providers
      if (manifest.provides.providers.length > 0) {
        const ok = await loadProviderPlugin(
          manifest,
          providerRegistry,
          installPath,
        );
        if (ok) {
          pluginLoaded = true;
          loaded++;
        } else {
          failed++;
        }
      }

      // Load hooks
      if (manifest.provides.hooks.length > 0) {
        const ok = await loadHookPlugin(manifest, installPath);
        if (ok) {
          pluginLoaded = true;
          loaded++;
        } else {
          failed++;
        }
      }

      // Load panels
      if (manifest.provides.panels.length > 0) {
        const ok = await loadPanelPlugin(manifest, installPath);
        if (ok) {
          pluginLoaded = true;
          loaded++;
        } else {
          failed++;
        }
      }

      if (!pluginLoaded) {
        logger.warn(`Plugin ${manifest.name} has no loadable extension points`);
      }
    } catch (err) {
      logger.warn(
        `Skipping plugin ${record.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
      failed++;
    }
  }

  logger.info(`Plugin scan complete: ${loaded} loaded, ${failed} failed`);
  return { loaded, failed };
}
