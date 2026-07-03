import { z } from "zod/v4";

/**
 * Plugin manifest schema — metadata about a plugin.
 * Stored as plugin.json in the plugin's directory.
 */
export const PluginManifest = z.object({
  /** Unique plugin identifier (npm-like: scope/name). */
  name: z.string().min(1).max(128),
  /** Human-readable display name. */
  displayName: z.string().min(1).max(256),
  /** Semantic version. */
  version: z.string().min(1).max(64),
  /** Short description. */
  description: z.string().min(1).max(1024),
  /** Author name or organization. */
  author: z.string().min(1).max(256).optional(),
  /** License identifier (SPDX). */
  license: z.string().min(1).max(128).optional(),
  /** Minimum agent-workbench version required. */
  minWorkbenchVersion: z.string().min(1).max(64).optional(),
  /** Plugin entry point relative to plugin directory. */
  main: z.string().min(1).max(512),
  /** Whether the plugin is enabled. */
  enabled: z.boolean(),
  /** Extension points provided by this plugin. */
  provides: z.object({
    /** List of tool names this plugin adds. */
    tools: z.array(z.string()),
    /** List of provider IDs this plugin adds. */
    providers: z.array(z.string()),
    /** List of panel IDs this plugin adds. */
    panels: z.array(z.string()),
    /** List of hook IDs this plugin registers. */
    hooks: z.array(z.string()),
  }),
  /** Permissions the plugin requires (Phase 26 sandboxing). */
  permissions: z
    .object({
      /** Whether the plugin needs filesystem read access. */
      filesystemRead: z.boolean().optional(),
      /** Whether the plugin needs filesystem write access. */
      filesystemWrite: z.boolean().optional(),
      /** Whether the plugin needs network access. */
      network: z.boolean().optional(),
      /** Whether the plugin needs to spawn subprocesses. */
      subprocess: z.boolean().optional(),
    })
    .optional(),
});

export type PluginManifest = z.infer<typeof PluginManifest>;

/**
 * Plugin installation record — tracks what's installed.
 */
export const PluginRecord = z.object({
  /** Plugin identifier (matches manifest name). */
  name: z.string(),
  /** Current installed version. */
  version: z.string(),
  /** Installation source (npm package, git URL, local path). */
  source: z.string(),
  /** Absolute path to the installed plugin directory. */
  installPath: z.string(),
  /** When the plugin was installed. */
  installedAt: z.string(),
  /** Whether the plugin is currently enabled. */
  enabled: z.boolean(),
  /** Last error message if the plugin failed to load. */
  lastError: z.string().optional(),
});

export type PluginRecord = z.infer<typeof PluginRecord>;
