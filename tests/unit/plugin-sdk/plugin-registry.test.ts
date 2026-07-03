import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type PluginManifest,
  PluginRegistry,
} from "@agent-workbench/plugin-sdk";

describe("PluginRegistry", () => {
  let tmpDir: string;
  let registry: PluginRegistry;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "plugin-registry-test-"));
    registry = new PluginRegistry(tmpDir);
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

  it("starts with an empty plugin list", () => {
    expect(registry.list()).toEqual([]);
  });

  it("registers a plugin", () => {
    const manifest = makeManifest();
    const record = registry.register(
      manifest,
      "npm:test-plugin",
      "/tmp/test-plugin",
    );

    expect(record.name).toBe("test-plugin");
    expect(record.version).toBe("1.0.0");
    expect(record.source).toBe("npm:test-plugin");
    expect(record.installPath).toBe("/tmp/test-plugin");
    expect(record.enabled).toBe(true);
    expect(record.installedAt).toBeDefined();
  });

  it("persists registrations across instances", () => {
    const manifest = makeManifest();
    registry.register(manifest, "npm:test-plugin", "/tmp/test-plugin");

    // Create a new registry pointing to the same dir
    const registry2 = new PluginRegistry(tmpDir);
    const plugins = registry2.list();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe("test-plugin");
  });

  it("throws on duplicate registration", () => {
    registry.register(makeManifest(), "npm:a", "/tmp/a");
    expect(() => registry.register(makeManifest(), "npm:b", "/tmp/b")).toThrow(
      "already installed",
    );
  });

  it("gets a plugin by name", () => {
    registry.register(
      makeManifest({ name: "my-plugin" }),
      "npm:my-plugin",
      "/tmp/my",
    );
    const plugin = registry.get("my-plugin");
    expect(plugin).toBeDefined();
    expect(plugin?.name).toBe("my-plugin");
  });

  it("returns undefined for unknown plugin", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("enables a disabled plugin", () => {
    registry.register(
      makeManifest({ name: "toggle-me", enabled: false }),
      "npm:toggle",
      "/tmp/toggle",
    );
    expect(registry.get("toggle-me")?.enabled).toBe(false);

    const enabled = registry.enable("toggle-me");
    expect(enabled.enabled).toBe(true);
  });

  it("disables an enabled plugin", () => {
    registry.register(
      makeManifest({ name: "toggle-me", enabled: true }),
      "npm:toggle",
      "/tmp/toggle",
    );

    const disabled = registry.disable("toggle-me");
    expect(disabled.enabled).toBe(false);
  });

  it("throws on enable of unknown plugin", () => {
    expect(() => registry.enable("nonexistent")).toThrow("not found");
  });

  it("throws on disable of unknown plugin", () => {
    expect(() => registry.disable("nonexistent")).toThrow("not found");
  });

  it("unregisters a plugin", () => {
    registry.register(
      makeManifest({ name: "remove-me" }),
      "npm:remove",
      "/tmp/remove",
    );
    expect(registry.list()).toHaveLength(1);

    const result = registry.unregister("remove-me");
    expect(result).toBe(true);
    expect(registry.list()).toEqual([]);
  });

  it("returns false when unregistering unknown plugin", () => {
    expect(registry.unregister("nonexistent")).toBe(false);
  });

  it("lists all registered plugins", () => {
    registry.register(makeManifest({ name: "a" }), "npm:a", "/tmp/a");
    registry.register(makeManifest({ name: "b" }), "npm:b", "/tmp/b");
    registry.register(makeManifest({ name: "c" }), "npm:c", "/tmp/c");

    const plugins = registry.list();
    expect(plugins).toHaveLength(3);

    const names = plugins.map((p) => p.name).sort();
    expect(names).toEqual(["a", "b", "c"]);
  });

  it("provides the plugins directory path", () => {
    expect(registry.getPluginsDir()).toBe(tmpDir);
  });

  it("records installation timestamps", () => {
    const before = new Date().toISOString();
    const record = registry.register(makeManifest(), "npm:ts", "/tmp/ts");
    const after = new Date().toISOString();

    expect(record.installedAt >= before).toBe(true);
    expect(record.installedAt <= after).toBe(true);
  });
});
