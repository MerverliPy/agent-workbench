// Unit tests for MetricsCollector
//
// Tests cost estimation, latency percentiles, comparison, and formatting.

import { describe, expect, it } from "bun:test";
import { MetricsCollector } from "../metrics";

// Mock repository for testing
function createMockRepo(): any {
  const store = new Map<string, any>();
  return {
    upsertMetrics: (row: any) => store.set(row.runId, row),
    findMetricsByRun: (runId: string) => store.get(runId) ?? null,
  };
}

describe("MetricsCollector", () => {
  describe("computePercentiles", () => {
    it("returns zeros for empty array", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const result = collector.computePercentiles([]);
      expect(result).toEqual({ p50: 0, p95: 0, p99: 0 });
    });

    it("returns same value for single-element array", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const result = collector.computePercentiles([150]);
      expect(result).toEqual({ p50: 150, p95: 150, p99: 150 });
    });

    it("computes correct percentiles for range", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      const result = collector.computePercentiles(latencies);
      expect(result.p50).toBeGreaterThanOrEqual(500);
      expect(result.p50).toBeLessThanOrEqual(600);
      expect(result.p95).toBeGreaterThanOrEqual(950);
      expect(result.p99).toBeGreaterThanOrEqual(990);
    });
  });

  describe("computeCostPerEval", () => {
    it("matches known models exactly", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      // GPT-4o: $0.0025/1K input, $0.01/1K output
      const cost = collector.computeCostPerEval("gpt-4o", 1000, 500);
      expect(cost).toBeCloseTo(0.0025 * 1 + 0.01 * 0.5, 6);
    });

    it("uses prefix matching for model variants", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const cost = collector.computeCostPerEval(
        "claude-sonnet-4-20250514",
        1000,
        500,
      );
      expect(cost).toBeCloseTo(0.003 * 1 + 0.015 * 0.5, 6);
    });

    it("defaults to GPT-4o pricing for unknown models", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const cost = collector.computeCostPerEval("unknown-model", 1000, 500);
      expect(cost).toBeCloseTo(0.0025 * 1 + 0.01 * 0.5, 6);
    });

    it("returns 0 for zero tokens", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const cost = collector.computeCostPerEval("gpt-4o", 0, 0);
      expect(cost).toBe(0);
    });
  });

  describe("record and get", () => {
    it("persists and retrieves metrics", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      const metrics = {
        accuracy: 0.85,
        totalItems: 100,
        itemsPassed: 85,
        durationMs: 12000,
        costUsd: 0.05,
        tokensUsed: { input: 10000, output: 5000, total: 15000 },
        latencyMs: { p50: 200, p95: 800, p99: 1500 },
        errorRate: 0.02,
      };

      collector.record("run-1", metrics);
      const retrieved = collector.get("run-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.accuracy).toBeCloseTo(0.85, 4);
      expect(retrieved?.tokensUsed.total).toBe(15000);
      expect(retrieved?.latencyMs.p95).toBe(800);
      expect(retrieved?.errorRate).toBeCloseTo(0.02, 4);
    });

    it("returns undefined for nonexistent run", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      expect(collector.get("nonexistent")).toBeUndefined();
    });
  });

  describe("compare", () => {
    it("returns empty array for empty input", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      expect(collector.compare([])).toEqual([]);
    });

    it("compares multiple runs", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      collector.record("run-a", {
        accuracy: 0.9,
        totalItems: 100,
        itemsPassed: 90,
        durationMs: 10000,
        costUsd: 0.1,
        tokensUsed: { input: 10000, output: 5000, total: 15000 },
        latencyMs: { p50: 100, p95: 500, p99: 1000 },
        errorRate: 0,
      });
      collector.record("run-b", {
        accuracy: 0.7,
        totalItems: 100,
        itemsPassed: 70,
        durationMs: 5000,
        costUsd: 0.05,
        tokensUsed: { input: 8000, output: 3000, total: 11000 },
        latencyMs: { p50: 50, p95: 200, p99: 500 },
        errorRate: 0.01,
      });

      const results = collector.compare(["run-a", "run-b"]);
      expect(results).toHaveLength(2);
      expect(results[0]?.runId).toBe("run-a");
      expect(results[0]?.metrics.accuracy).toBeCloseTo(0.9, 4);
      expect(results[1]?.runId).toBe("run-b");
      expect(results[1]?.metrics.accuracy).toBeCloseTo(0.7, 4);
    });

    it("skips missing runs", () => {
      const collector = new MetricsCollector(createMockRepo() as any);
      collector.record("run-a", {
        accuracy: 0.9,
        totalItems: 100,
        itemsPassed: 90,
        durationMs: 10000,
        costUsd: 0.1,
        tokensUsed: { input: 10000, output: 5000, total: 15000 },
        latencyMs: { p50: 100, p95: 500, p99: 1000 },
        errorRate: 0,
      });

      const results = collector.compare(["run-a", "nonexistent"]);
      expect(results).toHaveLength(1);
      expect(results[0]?.runId).toBe("run-a");
    });
  });

  describe("static format helpers", () => {
    it("formatLatency shows ms for < 1s", () => {
      expect(MetricsCollector.formatLatency(500)).toBe("500ms");
    });

    it("formatLatency shows seconds for >= 1s", () => {
      expect(MetricsCollector.formatLatency(1500)).toBe("1.50s");
    });

    it("formatCost shows <$0.0001 for very small costs", () => {
      expect(MetricsCollector.formatCost(0.00001)).toBe("<$0.0001");
    });

    it("formatCost shows USD for normal costs", () => {
      expect(MetricsCollector.formatCost(0.05)).toBe("$0.0500");
    });

    it("formatAccuracy shows percentage", () => {
      expect(MetricsCollector.formatAccuracy(0.856)).toBe("85.6%");
    });

    it("formatAccuracy shows 100% for perfect score", () => {
      expect(MetricsCollector.formatAccuracy(1.0)).toBe("100.0%");
    });
  });
});
