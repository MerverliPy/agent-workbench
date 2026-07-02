import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PluginRegistry, type PluginManifest } from "@agent-workbench/plugin-sdk";
import { ToolRegistry } from "@agent-workbench/tools";
import { ProviderRegistry } from "@agent-workbench/models";
import { loadToolPlugin, loadAllPlugins } from "@agent-workbench/server/public";

describe("plugin-loader", () => {
  let tmpDir: string;
  let registry: PluginRegistry;
  let toolRegistry: ToolRegistry;
  let providerRegistry: ProviderRegistry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "plugin-loader-test-"));
    registry = new PluginRegistry(tmpDir);
    toolRegistry = new ToolRegistry();
    providerRegistry = new ProviderRegistry();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
    return {
      name: "test-plugin",
      displayName: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
      main: "index.js",
      enabled: true,
      provides: { tools: [], providers: [], panels: [], hooks: [] },
      ...overrides,
    };
  }

  function createPluginDir(
    dirName: string,
    manifest: PluginManifest,
    sourceCode: string,
  ): string {
    const pluginDir = join(tmpDir, dirName);
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(join(pluginDir, "plugin.json"), JSON.stringify(manifest, null, 2));
    writeFileSync(join(pluginDir, "index.js"), sourceCode);
    return pluginDir;
  }

  // ── Tool plugin loading ───────────────────────────────────────────────

  describe("loadToolPlugin", () => {
    it("loads and registers tools from a tool plugin", async () => {
      const pluginDir = createPluginDir(
        "test-tool-plugin",
        makeManifest({
          name: "test-tool-plugin",
          provides: { tools: ["my-tool"], providers: [], panels: [], hooks: [] },
        }),
        `
export default {
  name: "test-tool-plugin",
  version: "1.0.0",
  tools: [
    {
      name: "my-tool",
      description: "A test tool",
      parameters: { type: "string" },
      isMutation: false,
      riskLevel: "low",
      execute: async (input) => ({ content: "hello " + input.name, success: true }),
    },
  ],
};
`,
      );

      const manifest = registry.loadManifest(pluginDir);
      const result = await loadToolPlugin(manifest, toolRegistry, pluginDir);

      expect(result).toBe(true);
      const tools = toolRegistry.list();
      expect(tools.map((t) => t.name)).toContain("my-tool");
    });

    it("returns false for plugin with no tools", async () => {
      const pluginDir = createPluginDir(
        "empty-tool-plugin",
        makeManifest({ name: "empty-tool", provides: { tools: [], providers: [], panels: [], hooks: [] } }),
        `export default { name: "empty", version: "1.0.0", tools: null };`,
      );

      const manifest = registry.loadManifest(pluginDir);
      const result = await loadToolPlugin(manifest, toolRegistry, pluginDir);

      expect(result).toBe(false);
    });

    it("skips invalid tools but loads valid ones", async () => {
      const pluginDir = createPluginDir(
        "mixed-tool-plugin",
        makeManifest({
          name: "mixed-tool",
          provides: { tools: ["good-tool", "bad-tool"], providers: [], panels: [], hooks: [] },
        }),
        `
export default {
  name: "mixed-tool",
  version: "1.0.0",
  tools: [
    {
      name: "good-tool",
      description: "Works fine",
      parameters: {},
      isMutation: false,
      riskLevel: "low",
      execute: async () => ({ content: "ok", success: true }),
    },
    { name: null, description: "No execute function" },
  ],
};
`,
      );

      const manifest = registry.loadManifest(pluginDir);
      const result = await loadToolPlugin(manifest, toolRegistry, pluginDir);

      expect(result).toBe(true);
      const tools = toolRegistry.list();
      expect(tools.map((t) => t.name)).toContain("good-tool");
    });
  });

  // ── Bulk loading ─────────────────────────────────────────────────────

  describe("loadAllPlugins", () => {
    it("loads enabled plugins and skips disabled ones", async () => {
      const enabledDir = createPluginDir(
        "enabled-plugin",
        makeManifest({
          name: "enabled-plugin",
          enabled: true,
          provides: { tools: ["enabled-tool"], providers: [], panels: [], hooks: [] },
        }),
        `
export default {
  name: "enabled-plugin",
  version: "1.0.0",
  tools: [{
    name: "enabled-tool",
    description: "Enabled only",
    parameters: {},
    isMutation: false,
    riskLevel: "low",
    execute: async () => ({ content: "enabled", success: true }),
  }],
};
`,
      );

      const disabledDir = createPluginDir(
        "disabled-plugin",
        makeManifest({
          name: "disabled-plugin",
          enabled: false,
          provides: { tools: ["disabled-tool"], providers: [], panels: [], hooks: [] },
        }),
        `export default { name: "disabled", version: "1.0.0", tools: [] };`,
      );

      registry.register(
        registry.loadManifest(enabledDir),
        "local:enabled-plugin",
        enabledDir,
      );
      registry.register(
        registry.loadManifest(disabledDir),
        "local:disabled-plugin",
        disabledDir,
      );
      // Mark the disabled one
      registry.disable("disabled-plugin");

      const result = await loadAllPlugins({ pluginRegistry: registry, toolRegistry, providerRegistry });
      expect(result.loaded).toBeGreaterThanOrEqual(1);
      expect(result.failed).toBe(0);

      const tools = toolRegistry.list();
      expect(tools.map((t) => t.name)).toContain("enabled-tool");
      expect(tools.map((t) => t.name)).not.toContain("disabled-tool");
    });

    it("handles empty plugin list gracefully", async () => {
      const result = await loadAllPlugins({ pluginRegistry: registry, toolRegistry, providerRegistry });
      expect(result.loaded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });
});
