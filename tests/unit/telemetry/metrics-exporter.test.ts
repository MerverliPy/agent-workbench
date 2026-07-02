import { describe, it, expect, beforeEach } from "bun:test";
import { MetricsExporter } from "@agent-workbench/telemetry";

describe("MetricsExporter", () => {
  let exporter: MetricsExporter;

  beforeEach(() => {
    exporter = new MetricsExporter();
  });

  // ── Counters ─────────────────────────────────────────────────────────────

  it("increments a counter", () => {
    exporter.incrementCounter("requests_total");
    expect(exporter.getCounter("requests_total")).toBe(1);

    exporter.incrementCounter("requests_total");
    expect(exporter.getCounter("requests_total")).toBe(2);
  });

  it("increments by a custom amount", () => {
    exporter.incrementCounter("bytes_sent", undefined, 1024);
    expect(exporter.getCounter("bytes_sent")).toBe(1024);
  });

  it("supports labeled counters", () => {
    exporter.incrementCounter("http_requests_total", { method: "GET", status: "200" });
    exporter.incrementCounter("http_requests_total", { method: "POST", status: "201" });
    exporter.incrementCounter("http_requests_total", { method: "GET", status: "200" });

    expect(exporter.getCounter("http_requests_total", { method: "GET", status: "200" })).toBe(2);
    expect(exporter.getCounter("http_requests_total", { method: "POST", status: "201" })).toBe(1);
  });

  it("returns 0 for unknown counters", () => {
    expect(exporter.getCounter("nonexistent")).toBe(0);
  });

  // ── Gauges ────────────────────────────────────────────────────────────────

  it("sets and gets a gauge", () => {
    exporter.setGauge("memory_bytes", 1024 * 1024);
    expect(exporter.getGauge("memory_bytes")).toBe(1024 * 1024);
  });

  it("overwrites gauge value", () => {
    exporter.setGauge("active_sessions", 5);
    exporter.setGauge("active_sessions", 3);
    expect(exporter.getGauge("active_sessions")).toBe(3);
  });

  it("returns undefined for unknown gauges", () => {
    expect(exporter.getGauge("nonexistent")).toBeUndefined();
  });

  it("supports labeled gauges", () => {
    exporter.setGauge("cpu_usage", 45.2, { core: "0" });
    exporter.setGauge("cpu_usage", 72.1, { core: "1" });
    expect(exporter.getGauge("cpu_usage", { core: "0" })).toBe(45.2);
    expect(exporter.getGauge("cpu_usage", { core: "1" })).toBe(72.1);
  });

  // ── Histograms ────────────────────────────────────────────────────────────

  it("records latency observations", () => {
    exporter.observeLatency("request_duration_ms", 10);
    exporter.observeLatency("request_duration_ms", 50);
    exporter.observeLatency("request_duration_ms", 200);

    // The metrics are recorded — verify via Prometheus export
    const output = exporter.toPrometheus();
    expect(output).toContain("request_duration_ms");
    expect(output).toContain("sum");
    expect(output).toContain("count");
  });

  it("records labeled latency", () => {
    exporter.observeLatency("db_query_ms", 5, { op: "select" });
    exporter.observeLatency("db_query_ms", 15, { op: "insert" });

    const output = exporter.toPrometheus();
    expect(output).toContain('op="select"');
    expect(output).toContain('op="insert"');
  });

  // ── Span recording ───────────────────────────────────────────────────────

  it("records completed spans as metrics", () => {
    exporter.recordSpan({
      name: "model.call",
      status: "ok",
      startTime: 100,
      endTime: 150,
    });
    expect(exporter.getCounter("spans_total", { span: "model.call", status: "ok" })).toBe(1);
    expect(exporter.getCounter("spans_errors_total", { span: "model.call" })).toBe(0);
  });

  it("counts span errors", () => {
    exporter.recordSpan({
      name: "tool.execute",
      status: "error",
      startTime: 100,
      endTime: 200,
    });
    expect(exporter.getCounter("spans_total", { span: "tool.execute", status: "error" })).toBe(1);
    expect(exporter.getCounter("spans_errors_total", { span: "tool.execute" })).toBe(1);
  });

  it("records zero duration for unended spans", () => {
    exporter.recordSpan({
      name: "incomplete",
      status: "unset",
      startTime: 100,
    });
    // Should not throw — just records 0ms
    expect(exporter.getCounter("spans_total", { span: "incomplete", status: "unset" })).toBe(1);
  });

  // ── Prometheus export ─────────────────────────────────────────────────────

  it("exports counters in Prometheus format", () => {
    exporter.incrementCounter("test_total", undefined, 3);
    const output = exporter.toPrometheus();
    expect(output).toContain("# HELP test_total Counter");
    expect(output).toContain("# TYPE test_total counter");
    expect(output).toContain("test_total 3");
  });

  it("exports gauges in Prometheus format", () => {
    exporter.setGauge("temperature_celsius", 23.5);
    const output = exporter.toPrometheus();
    expect(output).toContain("# HELP temperature_celsius Gauge");
    expect(output).toContain("# TYPE temperature_celsius gauge");
    expect(output).toContain("temperature_celsius 23.5");
  });

  it("exports histograms with buckets", () => {
    exporter.observeLatency("api_latency_ms", 7);
    exporter.observeLatency("api_latency_ms", 45);
    exporter.observeLatency("api_latency_ms", 300);

    const output = exporter.toPrometheus();
    expect(output).toContain("api_latency_ms_duration_ms_bucket");
    expect(output).toContain('le="+Inf"');
    expect(output).toContain("api_latency_ms_duration_ms_sum");
    expect(output).toContain("api_latency_ms_duration_ms_count 3");
  });

  it("handles custom latency buckets", () => {
    const custom = new MetricsExporter({ latencyBucketsMs: [1, 10, 100, 1000] });
    custom.observeLatency("fast", 5);
    custom.observeLatency("slow", 500);

    const output = custom.toPrometheus();
    expect(output).toContain('le="1"');
    expect(output).toContain('le="1000"');
    expect(output).toContain("fast_duration_ms_count 1");
    expect(output).toContain("slow_duration_ms_count 1");
  });

  it("returns empty string for empty exporter", () => {
    const output = exporter.toPrometheus();
    // Should be just a newline or empty
    expect(output.length).toBeLessThanOrEqual(1);
  });

  it("escapes invalid metric name characters", () => {
    exporter.incrementCounter("my-request.count", undefined, 1);
    const output = exporter.toPrometheus();
    expect(output).toContain("my_request_count");
  });
});
