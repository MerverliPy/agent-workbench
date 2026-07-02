import { describe, it, expect, beforeEach } from "bun:test";
import { CostTracker } from "@agent-workbench/models";

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it("starts with no records", () => {
    expect(tracker.getSessionRecords("session-1")).toEqual([]);
  });

  it("records a single model call", () => {
    const record = tracker.recordCall("session-1", "openai", "gpt-4o", 500, 200);
    expect(record.providerId).toBe("openai");
    expect(record.model).toBe("gpt-4o");
    expect(record.inputTokens).toBe(500);
    expect(record.outputTokens).toBe(200);
    expect(record.cost).toBeGreaterThan(0); // (500/1000)*0.0025 + (200/1000)*0.01
  });

  it("records with custom costs", () => {
    const record = tracker.recordCall("session-1", "custom", "my-model", 1000, 500, 0.001, 0.002);
    // Expect (1000/1000)*0.001 + (500/1000)*0.002 = 0.001 + 0.001 = 0.002
    expect(record.cost).toBe(0.002);
  });

  it("stores per-session records", () => {
    tracker.recordCall("session-a", "openai", "gpt-4o", 100, 50);
    tracker.recordCall("session-a", "anthropic", "claude-sonnet-4-20250514", 200, 100);
    tracker.recordCall("session-b", "openai", "gpt-4o-mini", 50, 25);

    expect(tracker.getSessionRecords("session-a")).toHaveLength(2);
    expect(tracker.getSessionRecords("session-b")).toHaveLength(1);
    expect(tracker.getSessionRecords("session-c")).toHaveLength(0);
  });

  it("aggregates session cost summary", () => {
    tracker.recordCall("session-1", "openai", "gpt-4o", 1000, 500);
    tracker.recordCall("session-1", "openai", "gpt-4o", 500, 250);

    const summary = tracker.getSessionSummary("session-1");
    expect(summary.calls).toBe(2);
    expect(summary.totalInputTokens).toBe(1500);
    expect(summary.totalOutputTokens).toBe(750);
    expect(summary.totalCost).toBeGreaterThan(0);
    expect(summary.providerBreakdown["openai"]).toBeDefined();
    expect(summary.providerBreakdown["openai"]!.calls).toBe(2);
  });

  it("aggregates day summary", () => {
    tracker.recordCall("session-1", "openai", "gpt-4o", 100, 50);
    tracker.recordCall("session-2", "anthropic", "claude-sonnet-4-20250514", 200, 100);

    const today = new Date().toISOString().slice(0, 10);
    const summary = tracker.getDaySummary(today);
    expect(summary.calls).toBe(2);
    expect(Object.keys(summary.providerBreakdown)).toHaveLength(2);
  });

  it("returns empty summary for unknown session", () => {
    const summary = tracker.getSessionSummary("nonexistent");
    expect(summary.calls).toBe(0);
    expect(summary.totalCost).toBe(0);
  });

  it("tracks daily total", () => {
    tracker.recordCall("session-1", "openai", "gpt-4o", 1000, 500);

    const dailyTotal = tracker.getDailyTotal();
    expect(dailyTotal).toBeGreaterThan(0);
  });

  it("resets all records", () => {
    tracker.recordCall("session-1", "openai", "gpt-4o", 100, 50);
    expect(tracker.getSessionRecords("session-1")).toHaveLength(1);

    tracker.reset();
    expect(tracker.getSessionRecords("session-1")).toHaveLength(0);
    expect(tracker.getDailyTotal()).toBe(0);
  });
});
