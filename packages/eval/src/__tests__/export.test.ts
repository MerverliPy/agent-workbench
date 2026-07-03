// Unit tests for ResultsExporter
//
// Tests CSV and JSON export formats with mock data.

import { beforeAll, describe, expect, it } from "bun:test";
import { ResultsExporter } from "../export";

// We mock the EvalRepository at a high level since we don't
// have a real SQLite database in these unit tests.
//
// The EvalRepository interface that ResultsExporter uses:
//   listRuns(limit, offset) -> EvalRunRow[]
//   findMetricsByRun(id) -> EvalMetricsRow | null
function createMockRepo(): any {
  const runs = [
    {
      id: "run-1",
      benchmarkId: "mmlu",
      model: "gpt-4o",
      provider: "openai",
      status: "completed",
      createdAt: "2026-07-02T10:00:00.000Z",
      completedAt: "2026-07-02T10:30:00.000Z",
      configJson: '{"temperature": 0.7}',
      rawOutput: '{"results": []}',
      error: null,
    },
    {
      id: "run-2",
      benchmarkId: "gsm8k",
      model: "claude-sonnet-4",
      provider: "anthropic",
      status: "completed",
      createdAt: "2026-07-02T11:00:00.000Z",
      completedAt: "2026-07-02T11:20:00.000Z",
      configJson: '{"temperature": 0.3}',
      rawOutput: null,
      error: null,
    },
  ];

  const metrics: Record<string, any> = {
    "run-1": {
      runId: "run-1",
      accuracy: 0.856,
      totalItems: 14042,
      itemsPassed: 12020,
      durationMs: 1800000,
      costUsd: 2.5,
      tokensInput: 500000,
      tokensOutput: 250000,
      latencyP50Ms: 850,
      latencyP95Ms: 2100,
      latencyP99Ms: 4500,
      errorRate: 0.005,
    },
    "run-2": {
      runId: "run-2",
      accuracy: 0.723,
      totalItems: 8792,
      itemsPassed: 6357,
      durationMs: 1200000,
      costUsd: 1.2,
      tokensInput: 300000,
      tokensOutput: 150000,
      latencyP50Ms: 620,
      latencyP95Ms: 1800,
      latencyP99Ms: 3200,
      errorRate: 0.008,
    },
  };

  return {
    listRuns: (limit: number, offset: number) => {
      let result = [...runs];
      if (limit) result = result.slice(0, limit);
      if (offset) result = result.slice(offset);
      return result;
    },
    findMetricsByRun: (id: string) => metrics[id] ?? null,
  };
}

describe("ResultsExporter", () => {
  const mockRepo = createMockRepo();
  let exporter: ResultsExporter;

  beforeAll(() => {
    exporter = new ResultsExporter(mockRepo);
  });

  describe("JSON export", () => {
    it("exports runs as JSON with metadata", () => {
      const result = exporter.exportToString({ format: "json", maxRuns: 10 });
      const parsed = JSON.parse(result);

      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.runCount).toBe(2);
      expect(parsed.runs).toHaveLength(2);

      const firstRun = parsed.runs[0];
      expect(firstRun.id).toBe("run-1");
      expect(firstRun.benchmark).toBe("mmlu");
      expect(firstRun.model).toBe("gpt-4o");
      expect(firstRun.config).toEqual({ temperature: 0.7 });
    });

    it("includes metrics when present", () => {
      const result = exporter.exportToString({ format: "json", maxRuns: 10 });
      const parsed = JSON.parse(result);

      const run1 = parsed.runs.find((r: any) => r.id === "run-1");
      expect(run1.metrics).toBeDefined();
      expect(run1.metrics.accuracy).toBeCloseTo(0.856, 3);
      expect(run1.metrics.costUsd).toBeCloseTo(2.5, 1);
    });

    it("excludes rawOutput by default", () => {
      const result = exporter.exportToString({ format: "json", maxRuns: 10 });
      const parsed = JSON.parse(result);
      const run1 = parsed.runs.find((r: any) => r.id === "run-1");
      expect(run1.rawOutput).toBeUndefined();
    });

    it("includes rawOutput when requested", () => {
      const result = exporter.exportToString({
        format: "json",
        maxRuns: 10,
        includeRawOutput: true,
      });
      const parsed = JSON.parse(result);
      const run1 = parsed.runs.find((r: any) => r.id === "run-1");
      expect(run1.rawOutput).toBe('{"results": []}');
    });
  });

  describe("CSV export", () => {
    it("exports runs as CSV with header row", () => {
      const result = exporter.exportToString({ format: "csv", maxRuns: 10 });
      const lines = result.trim().split("\n");

      // Header line
      expect(lines[0]).toContain("run_id");
      expect(lines[0]).toContain("benchmark");
      expect(lines[0]).toContain("model");
      expect(lines[0]).toContain("accuracy");

      // Data lines (2 runs)
      expect(lines).toHaveLength(3);
    });

    it("contains correct data for first run", () => {
      const result = exporter.exportToString({ format: "csv", maxRuns: 10 });
      const lines = result.trim().split("\n");
      const run1Line = lines[1];

      expect(run1Line).toContain("run-1");
      expect(run1Line).toContain("mmlu");
      expect(run1Line).toContain("gpt-4o");
      expect(run1Line).toContain("0.856");
    });

    it("handles model filtering", () => {
      const result = exporter.exportToString({
        format: "csv",
        maxRuns: 10,
        models: ["gpt-4o"],
      });
      const lines = result.trim().split("\n");
      // Header + 1 matching run
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain("gpt-4o");
    });

    it("handles benchmark filtering", () => {
      const result = exporter.exportToString({
        format: "csv",
        maxRuns: 10,
        benchmarks: ["gsm8k"],
      });
      const lines = result.trim().split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toContain("gsm8k");
    });
  });
});
