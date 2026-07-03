import { describe, expect, it } from "bun:test";
import type { PluginManifest } from "@agent-workbench/plugin-sdk";
import { validatePluginPermissions } from "@agent-workbench/server/public";

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

describe("validatePluginPermissions", () => {
  it("allows plugins with no permissions declared", () => {
    const manifest = makeManifest();
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("allows plugins with only read permissions", () => {
    const manifest = makeManifest({
      permissions: { filesystemRead: true },
    });
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("warns on filesystemWrite permission", () => {
    const manifest = makeManifest({
      permissions: { filesystemWrite: true },
    });
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("filesystemWrite");
  });

  it("warns on network permission", () => {
    const manifest = makeManifest({
      permissions: { network: true },
    });
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("network");
  });

  it("warns on subprocess permission", () => {
    const manifest = makeManifest({
      permissions: { subprocess: true },
    });
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("subprocess");
  });

  it("warns on multiple risky permissions", () => {
    const manifest = makeManifest({
      permissions: { filesystemWrite: true, network: true, subprocess: true },
    });
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    expect(result.warnings).toHaveLength(3);
  });

  it("defaults missing permission fields to false", () => {
    // Only one field declared, others default to false
    const manifest = makeManifest({
      permissions: { filesystemRead: true },
    });
    const result = validatePluginPermissions(manifest);
    expect(result.allowed).toBe(true);
    // filesystemRead is not a warning, so no warnings
    expect(result.warnings).toEqual([]);
  });
});
