/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";
import type { TestDb } from "../../helpers/test-db";
import { SmartRouter } from "@agent-workbench/models";

let testDb: TestDb;

beforeAll(() => {
  testDb = createTestDb();
});

afterAll(() => {
  testDb.cleanup();
});

describe("SmartRouter — classification", () => {
  const router = new SmartRouter({} as unknown as import("@agent-workbench/models").ProviderMarketplace);

  it("classifies read prompts", () => {
    expect(router.classify("read the file src/app.ts").category).toBe("read");
    expect(router.classify("show me the contents of package.json").category).toBe("read");
    expect(router.classify("what files are in this directory").category).toBe("read");
  });

  it("classifies code generation prompts", () => {
    expect(router.classify("write a function that sorts an array").category).toBe("code_generation");
    expect(router.classify("implement a REST API endpoint for users").category).toBe("code_generation");
    expect(router.classify("create a React component for a login form").category).toBe("code_generation");
  });

  it("classifies architecture review prompts", () => {
    // Keywords: design, review, architecture, analyze, security, refactor
    expect(router.classify("review the architecture of this system").category).toBe("architecture_review");
    expect(router.classify("analyze the security implications of this design").category).toBe("architecture_review");
    expect(router.classify("review this code for security vulnerabilities").category).toBe("architecture_review");
  });

  it("classifies summarization prompts", () => {
    expect(router.classify("summarize this codebase").category).toBe("summarization");
    expect(router.classify("give me a brief summary of what this does").category).toBe("summarization");
  });

  it("defaults to read for ambiguous prompts", () => {
    expect(router.classify("hello").category).toBe("read");
    expect(router.classify("").category).toBe("read");
  });

  it("includes confidence and matched keywords in classification", () => {
    const result = router.classify("write a function to sort an array");
    expect(result.category).toBe("code_generation");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });
});

describe("SmartRouter — routing", () => {
  // Clean up marketplace providers between tests (beforeEach ensures clean start even after prior failures).
  beforeEach(async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });
    const profiles = server.services.providerMarketplace.list({ enabledOnly: false });
    for (const p of profiles) {
      server.services.providerMarketplace.deleteApiKey(p.id);
      server.services.providerMarketplace.delete(p.id);
    }
  });

  afterEach(async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });
    const profiles = server.services.providerMarketplace.list({ enabledOnly: false });
    for (const p of profiles) {
      server.services.providerMarketplace.deleteApiKey(p.id);
      server.services.providerMarketplace.delete(p.id);
    }
  });

  it("routes read tasks to cheapest matching provider", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const { smartRouter, providerMarketplace } = server.services;

    const cheap = providerMarketplace.create({
      id: "router-test-cheap",
      name: "Cheap Provider",
      providerType: "openai",
      model: "gpt-4o-mini",
      tier: "preferred",
      taskCategories: ["read", "summarization"],
      costPer1KInput: 0.00015,
      costPer1KOutput: 0.0006,
      enabled: true,
    });

    providerMarketplace.create({
      id: "router-test-mid",
      name: "Mid Provider",
      providerType: "anthropic",
      model: "claude-sonnet-4-20250514",
      tier: "fallback",
      taskCategories: ["code_generation", "architecture_review"],
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015,
      enabled: true,
    });

    const decision = smartRouter.classifyAndRoute("read this file");
    expect(decision.provider.id).toBe(cheap.id);
    expect(decision.category).toBe("read");
    expect(decision.fallbackChain.length).toBeGreaterThan(0);
  });

  it("classifyAndRoute picks the best provider for code generation", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const { smartRouter, providerMarketplace } = server.services;

    const mid = providerMarketplace.create({
      id: "car-mid",
      name: "Mid Tier",
      providerType: "anthropic",
      model: "claude-sonnet-4-20250514",
      tier: "fallback",
      taskCategories: ["code_generation"],
      enabled: true,
    });

    providerMarketplace.create({
      id: "car-cheap",
      name: "Cheap Tier",
      providerType: "openai",
      model: "gpt-4o-mini",
      tier: "emergency",
      taskCategories: ["read"],
      enabled: true,
    });

    const decision = smartRouter.classifyAndRoute("implement a REST API");
    expect(decision.provider.id).toBe(mid.id);
    expect(decision.category).toBe("code_generation");
  });

  it("fallback chain excludes the selected provider", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const { smartRouter, providerMarketplace } = server.services;

    providerMarketplace.create({
      id: "fb-1",
      name: "Primary",
      providerType: "openai",
      model: "gpt-4o",
      tier: "preferred",
      taskCategories: ["code_generation"],
      enabled: true,
    });
    providerMarketplace.create({
      id: "fb-2",
      name: "Secondary",
      providerType: "anthropic",
      model: "claude-sonnet-4-20250514",
      tier: "fallback",
      taskCategories: ["code_generation"],
      enabled: true,
    });

    const decision = smartRouter.classifyAndRoute("write a function");
    const fallbackIds = decision.fallbackChain.map((p) => p.id);
    expect(fallbackIds).not.toContain(decision.provider.id);
    expect(fallbackIds.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores disabled providers in routing", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const { smartRouter, providerMarketplace } = server.services;

    providerMarketplace.create({
      id: "disabled-prov",
      name: "Disabled",
      providerType: "openai",
      model: "gpt-4o",
      tier: "preferred",
      taskCategories: ["code_generation"],
      enabled: false,
    });

    // Should throw — no enabled providers for code_generation
    expect(() => smartRouter.classifyAndRoute("write code")).toThrow();
  });

  it("prefers higher-tier providers for the same category match", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const { smartRouter, providerMarketplace } = server.services;

    providerMarketplace.create({
      id: "tier-fallback",
      name: "Fallback",
      providerType: "openai",
      model: "gpt-4o-mini",
      tier: "fallback",
      taskCategories: ["read"],
      enabled: true,
    });
    providerMarketplace.create({
      id: "tier-emergency",
      name: "Emergency",
      providerType: "ollama",
      model: "llama3",
      tier: "emergency",
      taskCategories: ["read"],
      enabled: true,
    });

    const decision = smartRouter.classifyAndRoute("read a file");
    // Prefer fallback over emergency (higher tier)
    expect(decision.provider.id).toBe("tier-fallback");
  });
});
