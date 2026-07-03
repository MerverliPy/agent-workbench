import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ProviderHealthMonitor,
  ProviderMarketplace,
} from "@agent-workbench/models";

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `aw-health-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("ProviderHealthMonitor", () => {
  let tmpDir: string;
  let marketplace: ProviderMarketplace;
  let monitor: ProviderHealthMonitor;

  beforeEach(() => {
    tmpDir = makeTempDir();
    marketplace = new ProviderMarketplace(tmpDir);
    marketplace.create({
      id: "test-provider",
      name: "Test Provider",
      providerType: "openai",
      model: "gpt-4o",
      enabled: true,
    });
    monitor = new ProviderHealthMonitor(marketplace, {
      checkIntervalMs: 10_000,
    });
  });

  afterEach(() => {
    monitor.stop();
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  });

  it("returns unknown status when no probes exist", () => {
    const status = monitor.getStatus("test-provider");
    expect(status.status).toBe("unknown");
    expect(status.errorRate).toBe(0);
  });

  it("records successes and updates status", () => {
    monitor.recordSuccess("test-provider", 150);
    monitor.recordSuccess("test-provider", 200);
    monitor.recordSuccess("test-provider", 180);

    const status = monitor.getStatus("test-provider");
    expect(status.status).toBe("healthy");
    expect(status.errorRate).toBe(0);
    expect(status.p50LatencyMs).toBeDefined();
    expect(status.p95LatencyMs).toBeDefined();
  });

  it("records errors and reflects in error rate", () => {
    monitor.recordSuccess("test-provider", 100);
    monitor.recordSuccess("test-provider", 200);
    monitor.recordSuccess("test-provider", 150);
    monitor.recordError("test-provider", new Error("timeout"));

    const status = monitor.getStatus("test-provider");
    expect(status.errorRate).toBeCloseTo(1 / 4, 1);
    expect(status.status).toBe("degraded");
  });

  it("marks as unhealthy when error rate >= 0.5", () => {
    monitor.recordSuccess("test-provider", 100);
    monitor.recordError("test-provider", new Error("error 1"));
    monitor.recordError("test-provider", new Error("error 2"));

    const status = monitor.getStatus("test-provider");
    expect(status.errorRate).toBeCloseTo(2 / 3, 1);
    expect(status.status).toBe("unhealthy");
  });

  it("records last error message", () => {
    monitor.recordError("test-provider", new Error("connection refused"));
    const status = monitor.getStatus("test-provider");
    expect(status.lastError).toBe("connection refused");
  });

  it("returns all provider statuses", () => {
    monitor.recordSuccess("test-provider", 100);
    const allStatus = monitor.getAllStatus();
    expect(allStatus).toHaveLength(1);
    expect(allStatus[0]?.providerId).toBe("test-provider");
  });

  it("starts and stops without errors", () => {
    monitor.start();
    expect(() => monitor.start()).not.toThrow(); // idempotent
    monitor.stop();
    expect(() => monitor.stop()).not.toThrow();
  });
});
