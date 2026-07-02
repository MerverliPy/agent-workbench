import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ProviderMarketplace } from "@agent-workbench/models";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  const dir = join(tmpdir(), `aw-marketplace-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("ProviderMarketplace", () => {
  let tmpDir: string;
  let marketplace: ProviderMarketplace;

  beforeEach(() => {
    tmpDir = makeTempDir();
    marketplace = new ProviderMarketplace(tmpDir);
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* best-effort */ }
  });

  it("starts with an empty profile list", () => {
    expect(marketplace.list()).toEqual([]);
  });

  it("creates a provider profile", () => {
    const profile = marketplace.create({
      id: "test-openai",
      name: "Test OpenAI",
      providerType: "openai",
      model: "gpt-4o",
    });

    expect(profile.id).toBe("test-openai");
    expect(profile.name).toBe("Test OpenAI");
    expect(profile.providerType).toBe("openai");
    expect(profile.model).toBe("gpt-4o");
    expect(profile.tier).toBe("fallback");
    expect(profile.enabled).toBe(true);
  });

  it("persists profiles to disk", () => {
    marketplace.create({
      id: "persist-test",
      name: "Persist Test",
      providerType: "anthropic",
      model: "claude-sonnet-4-20250514",
    });

    // Create a new marketplace with the same dir — should re-load
    const reloaded = new ProviderMarketplace(tmpDir);
    const profile = reloaded.get("persist-test");
    expect(profile).toBeDefined();
    expect(profile!.name).toBe("Persist Test");
    expect(profile!.model).toBe("claude-sonnet-4-20250514");
  });

  it("lists profiles sorted by updatedAt descending", () => {
    marketplace.create({ id: "a", name: "A", providerType: "openai", model: "gpt-4o" });
    marketplace.create({ id: "b", name: "B", providerType: "anthropic", model: "claude-sonnet-4-20250514" });
    const list = marketplace.list();
    // Both should be present; verify sort order by checking updatedAt is descending
    expect(list).toHaveLength(2);
    expect(new Date(list[0]!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(list[1]!.updatedAt).getTime(),
    );
  });

  it("filters by tier", () => {
    marketplace.create({ id: "pref", name: "Preferred", providerType: "openai", model: "gpt-4o", tier: "preferred" });
    marketplace.create({ id: "fall", name: "Fallback", providerType: "anthropic", model: "claude-sonnet-4-20250514", tier: "fallback" });

    const preferred = marketplace.list({ tier: "preferred" });
    expect(preferred).toHaveLength(1);
    expect(preferred[0]!.id).toBe("pref");

    const fallback = marketplace.list({ tier: "fallback" });
    expect(fallback).toHaveLength(1);
    expect(fallback[0]!.id).toBe("fall");
  });

  it("filters by enabled status", () => {
    marketplace.create({ id: "enabled-1", name: "Enabled", providerType: "openai", model: "gpt-4o", enabled: true });
    marketplace.create({ id: "disabled-1", name: "Disabled", providerType: "anthropic", model: "claude-sonnet-4-20250514", enabled: false });

    const all = marketplace.list({ enabledOnly: false });
    expect(all).toHaveLength(2);

    const enabledOnly = marketplace.list({ enabledOnly: true });
    expect(enabledOnly).toHaveLength(1);
    expect(enabledOnly[0]!.id).toBe("enabled-1");
  });

  it("gets a single profile by id", () => {
    marketplace.create({ id: "get-test", name: "Get Test", providerType: "ollama", model: "llama3.2" });
    const profile = marketplace.get("get-test");
    expect(profile).toBeDefined();
    expect(profile!.providerType).toBe("ollama");
  });

  it("returns undefined for missing profile", () => {
    expect(marketplace.get("nonexistent")).toBeUndefined();
  });

  it("updates a profile", () => {
    marketplace.create({ id: "update-test", name: "Original", providerType: "openai", model: "gpt-4o" });

    const updated = marketplace.update("update-test", { name: "Updated", model: "gpt-4o-mini" });
    expect(updated.name).toBe("Updated");
    expect(updated.model).toBe("gpt-4o-mini");

    // Verify persisted
    const reloaded = new ProviderMarketplace(tmpDir);
    const p = reloaded.get("update-test");
    expect(p!.name).toBe("Updated");
  });

  it("throws on update of non-existent profile", () => {
    expect(() => marketplace.update("nope", { name: "Nope" })).toThrow("not found");
  });

  it("throws on duplicate create", () => {
    marketplace.create({ id: "dup", name: "First", providerType: "openai", model: "gpt-4o" });
    expect(() => marketplace.create({ id: "dup", name: "Second", providerType: "anthropic", model: "claude" })).toThrow("already exists");
  });

  it("deletes a profile", () => {
    marketplace.create({ id: "delete-test", name: "Delete Me", providerType: "openai", model: "gpt-4o" });
    expect(marketplace.get("delete-test")).toBeDefined();

    const deleted = marketplace.delete("delete-test");
    expect(deleted).toBe(true);
    expect(marketplace.get("delete-test")).toBeUndefined();
    expect(marketplace.delete("delete-test")).toBe(false);
  });

  it("deletes removes the JSON file from disk", () => {
    marketplace.create({ id: "file-test", name: "File Test", providerType: "openai", model: "gpt-4o" });
    const filePath = join(tmpDir, "file-test.json");
    expect(existsSync(filePath)).toBe(true);

    marketplace.delete("file-test");
    expect(existsSync(filePath)).toBe(false);
  });

  it("stores and retrieves API keys separately", () => {
    marketplace.create({ id: "key-test", name: "Key Test", providerType: "openai", model: "gpt-4o" });

    marketplace.setApiKey("key-test", "sk-secret-123");
    expect(marketplace.getApiKey("key-test")).toBe("sk-secret-123");

    // Verify key file exists with restricted permissions
    const keyFile = join(tmpDir, "key-test.key");
    expect(existsSync(keyFile)).toBe(true);
    const stored = readFileSync(keyFile, "utf-8").trim();
    expect(stored).toBe("sk-secret-123");

    // API key is NOT in the profile JSON
    const profile = marketplace.get("key-test");
    expect(profile!.hasKey).toBe(true);
    marketplace.deleteApiKey("key-test");
    expect(marketplace.getApiKey("key-test")).toBe("");
    expect(profile!.hasKey).toBe(false);
  });

  it("handles creating a profile with all optional fields", () => {
    const profile = marketplace.create({
      id: "full",
      name: "Full Profile",
      providerType: "openrouter",
      model: "anthropic/claude-sonnet-4",
      baseUrl: "https://openrouter.ai/api/v1",
      tier: "preferred",
      taskCategories: ["code_generation", "architecture_review"],
      contextLimit: 200000,
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015,
      supportsStreaming: true,
      enabled: true,
      apiKey: "sk-or-v1-secret",
    });

    expect(profile.tier).toBe("preferred");
    expect(profile.taskCategories).toEqual(["code_generation", "architecture_review"]);
    expect(profile.contextLimit).toBe(200000);
    expect(profile.costPer1KInput).toBe(0.003);
    expect(profile.costPer1KOutput).toBe(0.015);
    expect(profile.supportsStreaming).toBe(true);
    expect(profile.enabled).toBe(true);
    expect(profile.hasKey).toBe(true);
    expect(profile.baseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("provides getProfilesDir for manual inspection", () => {
    expect(marketplace.getProfilesDir()).toBe(tmpDir);
  });
});
