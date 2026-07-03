/// <reference types="bun" />
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginManifest } from "@agent-workbench/plugin-sdk";
import type { TestDb } from "../../helpers/test-db";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";

let testDb: TestDb;

beforeAll(() => {
  testDb = createTestDb();
  // Nuke persistent plugin registry from prior test runs.
  const cleanServer = createTestServer({
    storage: testDb.connection,
    modelTurns: [],
  });
  const plugins = cleanServer.services.pluginRegistry.list();
  for (const p of plugins) {
    cleanServer.services.pluginRegistry.unregister(p.name);
  }
});

afterAll(() => {
  testDb.cleanup();
});

describe("Plugin routes — /plugins", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "plugin-routes-test-"));
  });

  afterEach(async () => {
    // Clean up the persistent plugin registry between tests.
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });
    const plugins = server.services.pluginRegistry.list();
    for (const p of plugins) {
      server.services.pluginRegistry.unregister(p.name);
    }
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

  function createPluginDir(dirName: string, manifest: PluginManifest): string {
    const pluginDir = join(tmpDir, dirName);
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, "plugin.json"),
      JSON.stringify(manifest, null, 2),
    );
    writeFileSync(
      join(pluginDir, "index.js"),
      "export default { name: 'test', version: '1.0.0', tools: [] };",
    );
    return pluginDir;
  }

  it("lists installed plugins", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    // Register a plugin
    const pluginDir = createPluginDir("test-plugin", makeManifest());
    server.services.pluginRegistry.register(
      server.services.pluginRegistry.loadManifest(pluginDir),
      "local:test-plugin",
      pluginDir,
    );

    const res = await server.app.request("/plugins", { method: "GET" });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
    expect((body.items[0] as Record<string, unknown>).name).toBe("test-plugin");
  });

  it("returns empty list when no plugins installed", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request("/plugins", { method: "GET" });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  it("gets a plugin by name", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "my-plugin",
      makeManifest({ name: "my-plugin" }),
    );
    server.services.pluginRegistry.register(
      server.services.pluginRegistry.loadManifest(pluginDir),
      "local:my-plugin",
      pluginDir,
    );

    const res = await server.app.request("/plugins/my-plugin", {
      method: "GET",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.name).toBe("my-plugin");
    expect(body.enabled).toBe(true);
    expect(body.source).toBe("local:my-plugin");
  });

  it("returns 404 for unknown plugin", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request("/plugins/nonexistent", {
      method: "GET",
    });
    expect(res.status).toBe(404);
  });

  it("enables a disabled plugin", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "toggle-plugin",
      makeManifest({ name: "toggle-plugin", enabled: false }),
    );
    server.services.pluginRegistry.register(
      server.services.pluginRegistry.loadManifest(pluginDir),
      "local:toggle",
      pluginDir,
    );

    const res = await server.app.request("/plugins/toggle-plugin/enable", {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.enabled).toBe(true);
    expect((body.plugin as Record<string, unknown>).enabled).toBe(true);
  });

  it("disables an enabled plugin", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "toggle-plugin",
      makeManifest({ name: "toggle-plugin", enabled: true }),
    );
    server.services.pluginRegistry.register(
      server.services.pluginRegistry.loadManifest(pluginDir),
      "local:toggle",
      pluginDir,
    );

    const res = await server.app.request("/plugins/toggle-plugin/disable", {
      method: "POST",
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.enabled).toBe(false);
    expect((body.plugin as Record<string, unknown>).enabled).toBe(false);
  });

  it("filters to only list fields in the response", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "fields-test",
      makeManifest({ name: "fields-test" }),
    );
    server.services.pluginRegistry.register(
      server.services.pluginRegistry.loadManifest(pluginDir),
      "local:fields-test",
      pluginDir,
    );

    const res = await server.app.request("/plugins", { method: "GET" });
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
    };
    const item = body.items[0]!;

    // Only the fields from the route response, not raw PluginRecord
    expect(item).toHaveProperty("name");
    expect(item).toHaveProperty("version");
    expect(item).toHaveProperty("source");
    expect(item).toHaveProperty("enabled");
    expect(item).toHaveProperty("installedAt");
    // installPath should NOT be leaked
    expect(item).not.toHaveProperty("installPath");
  });

  // ── Install / uninstall ───────────────────────────────────────────────

  it("installs a plugin from local path", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "install-target",
      makeManifest({ name: "install-target" }),
    );

    const res = await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: `local:${pluginDir}` }),
    });
    expect(res.status).toBe(201);

    const body = (await res.json()) as Record<string, unknown>;
    expect(body.name).toBe("install-target");
    expect(body.source).toBe(`local:${pluginDir}`);
    expect(body.enabled).toBe(true);

    // Verify it appears in the list
    const listRes = await server.app.request("/plugins", { method: "GET" });
    const listBody = (await listRes.json()) as { items: unknown[] };
    expect(listBody.items).toHaveLength(1);
  });

  it("rejects install with missing source", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("rejects install from nonexistent path", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "local:/nonexistent/path" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate install", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "dup-target",
      makeManifest({ name: "dup-target" }),
    );

    // First install
    await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: `local:${pluginDir}` }),
    });

    // Second install should fail
    const res = await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: `local:${pluginDir}` }),
    });
    expect(res.status).toBe(409);
  });

  it("npm and git sources return 501", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const npmRes = await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "npm:some-package" }),
    });
    expect(npmRes.status).toBe(501);

    const gitRes = await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "git:https://github.com/foo/bar" }),
    });
    expect(gitRes.status).toBe(501);
  });

  it("uninstalls a plugin and removes its directory", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const pluginDir = createPluginDir(
      "uninstall-target",
      makeManifest({ name: "uninstall-target" }),
    );

    // Install
    await server.app.request("/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: `local:${pluginDir}` }),
    });

    // Verify installed
    let listRes = await server.app.request("/plugins", { method: "GET" });
    let listBody = (await listRes.json()) as { items: unknown[] };
    expect(listBody.items).toHaveLength(1);

    // Uninstall
    const delRes = await server.app.request("/plugins/uninstall-target", {
      method: "DELETE",
    });
    expect(delRes.status).toBe(200);

    const delBody = (await delRes.json()) as Record<string, unknown>;
    expect(delBody.uninstalled).toBe(true);
    expect(delBody.name).toBe("uninstall-target");

    // Verify removed from list
    listRes = await server.app.request("/plugins", { method: "GET" });
    listBody = (await listRes.json()) as { items: unknown[] };
    expect(listBody.items).toEqual([]);
  });

  it("returns 404 when uninstalling unknown plugin", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request("/plugins/nonexistent", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});
