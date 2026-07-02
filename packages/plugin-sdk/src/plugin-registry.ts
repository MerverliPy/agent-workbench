import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import type { PluginManifest } from "./plugin-manifest";
import type { PluginRecord } from "./plugin-manifest";
import { PluginManifest as PluginManifestSchema } from "./plugin-manifest";

/**
 * Plugin registry — manages installed plugins.
 *
 * Plugins are stored under ~/.agent-workbench/plugins/.
 * Each plugin has its own directory with plugin.json (manifest)
 * and source files. The registry tracks installation state.
 */
export class PluginRegistry {
  private readonly pluginsDir: string;
  private readonly registryPath: string;

  constructor(pluginsDir?: string) {
    this.pluginsDir = pluginsDir ?? resolve(homedir(), ".agent-workbench", "plugins");
    this.registryPath = join(this.pluginsDir, "plugin.json");
    this.ensureDir();
  }

  /** List all installed plugins. */
  list(): PluginRecord[] {
    const records = this.readRegistry();
    return Object.values(records);
  }

  /** Get a plugin by name. */
  get(name: string): PluginRecord | undefined {
    const records = this.readRegistry();
    return records[name];
  }

  /** Register a plugin (after installation). */
  register(manifest: PluginManifest, source: string, installPath: string): PluginRecord {
    const records = this.readRegistry();

    if (records[manifest.name] !== undefined) {
      throw new Error(`Plugin already installed: ${manifest.name}`);
    }

    const record: PluginRecord = {
      name: manifest.name,
      version: manifest.version,
      source,
      installPath,
      installedAt: new Date().toISOString(),
      enabled: manifest.enabled,
    };

    records[manifest.name] = record;
    this.writeRegistry(records);
    return record;
  }

  /** Enable a plugin. */
  enable(name: string): PluginRecord {
    const records = this.readRegistry();
    const record = records[name];
    if (record === undefined) {
      throw new Error(`Plugin not found: ${name}`);
    }
    record.enabled = true;
    this.writeRegistry(records);
    return record;
  }

  /** Disable a plugin. */
  disable(name: string): PluginRecord {
    const records = this.readRegistry();
    const record = records[name];
    if (record === undefined) {
      throw new Error(`Plugin not found: ${name}`);
    }
    record.enabled = false;
    this.writeRegistry(records);
    return record;
  }

  /** Unregister (remove) a plugin. */
  unregister(name: string): boolean {
    const records = this.readRegistry();
    if (records[name] === undefined) return false;
    delete records[name];
    this.writeRegistry(records);
    return true;
  }

  /** Load and validate a plugin manifest from a directory. */
  loadManifest(pluginDir: string): PluginManifest {
    const manifestPath = join(pluginDir, "plugin.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }
    const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as unknown;
    return PluginManifestSchema.parse(raw);
  }

  /** Get the plugins directory path. */
  getPluginsDir(): string {
    return this.pluginsDir;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private ensureDir(): void {
    if (!existsSync(this.pluginsDir)) {
      mkdirSync(this.pluginsDir, { recursive: true });
    }
  }

  private readRegistry(): Record<string, PluginRecord> {
    if (!existsSync(this.registryPath)) {
      return {};
    }
    try {
      const raw = JSON.parse(readFileSync(this.registryPath, "utf-8")) as unknown;
      return raw as Record<string, PluginRecord>;
    } catch {
      return {};
    }
  }

  private writeRegistry(records: Record<string, PluginRecord>): void {
    writeFileSync(this.registryPath, JSON.stringify(records, null, 2), "utf-8");
  }
}
