import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ProviderMarketplace, SmartRouter } from "@agent-workbench/models";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function makeTempDir(): string {
  const dir = join(tmpdir(), `aw-router-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function setupMarketplace(dir: string): ProviderMarketplace {
  const mp = new ProviderMarketplace(dir);

  // Cheapest — good for read/summarize
  mp.create({
    id: "cheap",
    name: "Cheap Model",
    providerType: "openai",
    model: "gpt-4o-mini",
    tier: "preferred",
    taskCategories: ["read", "summarization"],
    costPer1KInput: 0.00015,
    costPer1KOutput: 0.0006,
  });

  // Mid-tier — good for code generation
  mp.create({
    id: "mid",
    name: "Mid Tier",
    providerType: "anthropic",
    model: "claude-sonnet-4-20250514",
    tier: "preferred",
    taskCategories: ["code_generation", "read"],
    costPer1KInput: 0.003,
    costPer1KOutput: 0.015,
  });

  // Strongest — good for architecture review
  mp.create({
    id: "strong",
    name: "Strong Model",
    providerType: "openai",
    model: "gpt-4o",
    tier: "fallback",
    taskCategories: ["architecture_review", "code_generation"],
    costPer1KInput: 0.0025,
    costPer1KOutput: 0.01,
  });

  return mp;
}

describe("SmartRouter", () => {
  let tmpDir: string;
  let marketplace: ProviderMarketplace;
  let router: SmartRouter;

  beforeEach(() => {
    tmpDir = makeTempDir();
    marketplace = setupMarketplace(tmpDir);
    router = new SmartRouter(marketplace);
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* best-effort */ }
  });

  describe("classify", () => {
    it("classifies read prompts correctly", () => {
      const result = router.classify("show me the contents of that file");
      expect(result.category).toBe("read");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it("classifies code generation prompts correctly", () => {
      const result = router.classify("create a new function that sorts the array");
      expect(result.category).toBe("code_generation");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("classifies summarization prompts correctly", () => {
      const result = router.classify("summarize the key points from this document");
      expect(result.category).toBe("summarization");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("classifies architecture review prompts correctly", () => {
      const result = router.classify("review the architecture of this system design");
      expect(result.category).toBe("architecture_review");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("defaults to 'read' for ambiguous prompts", () => {
      const result = router.classify("hello world");
      expect(result.category).toBe("read");
    });
  });

  describe("route", () => {
    it("selects cheapest provider for read tasks", () => {
      const decision = router.classifyAndRoute("show me the git log");
      // The cheap model (gpt-4o-mini) should win for read due to preferred tier + cheapest cost
      expect(decision.provider.id).toBe("cheap");
      expect(decision.category).toBe("read");
    });

    it("selects mid-tier provider for code generation", () => {
      const decision = router.classifyAndRoute("implement a binary search tree");
      // Mid-tier (claude) has code_generation in categories and preferred tier
      expect(decision.provider.id).toBe("mid");
      expect(decision.category).toBe("code_generation");
    });

    it("builds a fallback chain excluding the selected provider", () => {
      const decision = router.classifyAndRoute("what is in this directory");
      expect(decision.fallbackChain.length).toBeGreaterThan(0);
      // The selected provider should NOT be in the fallback chain
      expect(decision.fallbackChain.find((p) => p.id === decision.provider.id)).toBeUndefined();
    });

    it("throws when no enabled providers exist", () => {
      const emptyDir = makeTempDir();
      const emptyMp = new ProviderMarketplace(emptyDir);
      const emptyRouter = new SmartRouter(emptyMp);
      expect(() => emptyRouter.classifyAndRoute("test")).toThrow("No enabled provider profiles");
      try { rmSync(emptyDir, { recursive: true, force: true }); } catch {}
    });
  });

  describe("getDefaultCost", () => {
    it("returns known model costs", () => {
      const costs = SmartRouter.getDefaultCost("gpt-4o");
      expect(costs.input).toBeGreaterThan(0);
      expect(costs.output).toBeGreaterThan(0);
    });

    it("returns default costs for unknown models", () => {
      const costs = SmartRouter.getDefaultCost("unknown-model-v99");
      expect(costs.input).toBe(0.002);
      expect(costs.output).toBe(0.008);
    });
  });
});
