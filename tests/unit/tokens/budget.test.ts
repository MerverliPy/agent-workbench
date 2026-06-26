/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { calculateBudget, truncateToolOutput } from "@agent-workbench/tokens";

describe("calculateBudget", () => {
  it("returns healthy when well under limit", () => {
    const result = calculateBudget({
      messages: [{ role: "user", contentLength: 1000 }],
    });
    expect(result.level).toBe("healthy");
    expect(result.utilizationPercent).toBeLessThanOrEqual(50);
    expect(result.isEstimate).toBe(true);
    expect(result.limit).toBe(128_000);
  });

  it("returns watch when over 50% utilization", () => {
    const result = calculateBudget({
      messages: [{ role: "user", contentLength: 70_000 * 4 }],
      modelContextLimit: 128_000,
    });
    expect(result.level).toBeOneOf(["watch", "strained"]);
  });

  it("returns strained when near limit", () => {
    const result = calculateBudget({
      messages: [{ role: "user", contentLength: 100_000 * 4 }],
      modelContextLimit: 128_000,
    });
    expect(result.level).toBeOneOf(["strained", "critical"]);
  });

  it("returns critical when exceeding threshold", () => {
    const result = calculateBudget({
      messages: [{ role: "user", contentLength: 120_000 * 4 }],
      modelContextLimit: 128_000,
    });
    expect(result.level).toBeOneOf(["strained", "critical"]);
  });

  it("caps utilizationPercent at 100", () => {
    const result = calculateBudget({
      messages: [{ role: "user", contentLength: 200_000 * 4 }],
      modelContextLimit: 128_000,
    });
    expect(result.utilizationPercent).toBe(100);
  });

  it("uses default limit when not provided", () => {
    const result = calculateBudget({ messages: [] });
    expect(result.limit).toBe(128_000);
    expect(result.used).toBe(0);
  });

  it("respects custom modelContextLimit", () => {
    const result = calculateBudget({
      messages: [],
      modelContextLimit: 64_000,
    });
    expect(result.limit).toBe(64_000);
  });

  it("includes message token counts when available", () => {
    const result = calculateBudget({
      messages: [
        { role: "user", contentLength: 100, tokenCount: 500 },
      ],
    });
    expect(result.used).toBe(500);
  });

  it("includes system prompt in estimation", () => {
    const withoutPrompt = calculateBudget({ messages: [] });
    const withPrompt = calculateBudget({
      messages: [],
      systemPromptContent: "a".repeat(4000),
    });
    expect(withPrompt.used).toBeGreaterThan(withoutPrompt.used);
  });

  it("includes summary content in estimation", () => {
    const without = calculateBudget({ messages: [] });
    const withSummary = calculateBudget({
      messages: [],
      summaryContent: "a".repeat(4000),
    });
    expect(withSummary.used).toBeGreaterThan(without.used);
  });

  it("includes tool definitions in estimation", () => {
    const without = calculateBudget({ messages: [] });
    const withTools = calculateBudget({
      messages: [],
      toolDefinitions: [
        { name: "read", description: "Read a file" },
        { name: "grep", description: "Search a file" },
      ],
    });
    expect(withTools.used).toBeGreaterThan(without.used);
  });

  it("includes pending tool results in estimation", () => {
    const without = calculateBudget({ messages: [] });
    const withResults = calculateBudget({
      messages: [],
      pendingToolResults: [
        { name: "read", resultSize: 5000 },
      ],
    });
    expect(withResults.used).toBeGreaterThan(without.used);
  });
});

describe("truncateToolOutput", () => {
  it("returns unchanged content when under limit", () => {
    const result = truncateToolOutput("hello", { maxResultLength: 100 });
    expect(result.meta.truncated).toBe(false);
    expect(result.content).toBe("hello");
    expect(result.meta.originalLength).toBe(5);
  });

  it("truncates content when over limit", () => {
    const long = "a".repeat(50_000);
    const result = truncateToolOutput(long, { maxResultLength: 1000 });
    expect(result.meta.truncated).toBe(true);
    expect(result.meta.originalLength).toBe(50_000);
    expect(result.meta.truncatedLength).toBeLessThanOrEqual(1500);
    expect(result.content).toContain("omitted");
  });

  it("preserves start and end excerpts", () => {
    const prefix = "PREFIX_";
    const suffix = "_SUFFIX";
    const content = prefix + "x".repeat(19000) + suffix;
    const result = truncateToolOutput(content, { maxResultLength: 1000 });
    expect(result.content).toContain(prefix);
    expect(result.content).toContain(suffix);
  });

  it("records metadata when truncated", () => {
    const content = "a".repeat(50_000);
    const result = truncateToolOutput(content, { maxResultLength: 1000 });
    expect(result.meta.reason).toBe("output_limit");
    expect(result.meta.preservedElements).toContain("start_excerpt");
    expect(result.meta.preservedElements).toContain("end_excerpt");
  });

  it("uses default max length when not specified", () => {
    const result = truncateToolOutput("short");
    expect(result.meta.truncated).toBe(false);
  });
});
