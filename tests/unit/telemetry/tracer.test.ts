import { describe, it, expect, beforeEach } from "bun:test";
import { Tracer } from "@agent-workbench/telemetry";

describe("Tracer", () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer();
  });

  it("starts with no spans", () => {
    expect(tracer.size).toBe(0);
    expect(tracer.getSpans()).toEqual([]);
  });

  it("creates a span via trace() and closes it on success", async () => {
    const result = await tracer.trace({ name: "test-op" }, async (span) => {
      expect(span.name).toBe("test-op");
      expect(span.status).toBe("unset");
      return 42;
    });
    expect(result).toBe(42);
    expect(tracer.size).toBe(1);
    const spans = tracer.getSpans();
    expect(spans[0]!.status).toBe("ok");
    expect(spans[0]!.name).toBe("test-op");
  });

  it("records error status when handler throws", async () => {
    const errPromise = tracer.trace({ name: "failing-op" }, async () => {
      throw new Error("boom");
    });
    await expect(errPromise).rejects.toThrow("boom");
    expect(tracer.size).toBe(1);
    const spans = tracer.getSpans();
    expect(spans[0]!.status).toBe("error");
    expect(spans[0]!.error).toBe("boom");
  });

  it("computes duration on completed spans", async () => {
    await tracer.trace({ name: "timed-op" }, async () => {
      // Simulate work
      await new Promise((r) => setTimeout(r, 5));
    });
    const durations = tracer.getSpans().map((s) => tracer.getDuration(s));
    expect(durations[0]).toBeGreaterThan(0);
  });

  it("returns undefined duration for unclosed spans", () => {
    const span = tracer.startSpan({ name: "open-span" });
    expect(tracer.getDuration(span)).toBeUndefined();
  });

  it("records parent span relationships", () => {
    tracer.startSpan({ name: "parent" });
    const child = tracer.startSpan({
      name: "child",
      parentSpanId: "parent-id",
    });
    const spans = tracer.getSpans();
    const childSpan = spans.find((s) => s.name === "child");
    expect(childSpan?.parentSpanId).toBe("parent-id");
  });

  it("records attributes on spans", async () => {
    await tracer.trace(
      { name: "attributed-op", attributes: { userId: "u1", cost: 0.05 } },
      async () => {}
    );
    const span = tracer.getSpans()[0];
    expect(span?.attributes).toEqual({ userId: "u1", cost: 0.05 });
  });

  it("getRecentSpans returns newest first limited", async () => {
    for (let i = 0; i < 10; i++) {
      await tracer.trace({ name: `op-${i}` }, async () => {});
    }
    const recent = tracer.getRecentSpans(5);
    expect(recent).toHaveLength(5);
    // Most recent first
    expect(recent[0]!.name).toBe("op-9");
  });

  it("getRecentSpans filters by name", async () => {
    await tracer.trace({ name: "read" }, async () => {});
    await tracer.trace({ name: "write" }, async () => {});
    await tracer.trace({ name: "read" }, async () => {});

    const reads = tracer.getRecentSpans(10, "read");
    expect(reads).toHaveLength(2);
    for (const s of reads) {
      expect(s.name).toBe("read");
    }
  });

  it("getTrace filters by trace ID", async () => {
    await tracer.trace({ name: "first" }, async () => {});
    await tracer.trace({ name: "second" }, async () => {});

    const allSpans = tracer.getSpans();
    const traceId = allSpans[0]!.traceId;
    const filtered = tracer.getTrace(traceId);
    expect(filtered.length).toBeGreaterThanOrEqual(1);
    for (const s of filtered) {
      expect(s.traceId).toBe(traceId);
    }
  });

  it("clears all spans", async () => {
    await tracer.trace({ name: "op" }, async () => {});
    expect(tracer.size).toBe(1);
    tracer.clear();
    expect(tracer.size).toBe(0);
    expect(tracer.getSpans()).toEqual([]);
  });

  it("enforces max spans ring buffer", async () => {
    const small = new Tracer({ maxSpans: 3 });
    for (let i = 0; i < 5; i++) {
      await small.trace({ name: `op-${i}` }, async () => {});
    }
    expect(small.size).toBe(3);
    const names = small.getSpans().map((s) => s.name);
    expect(names).toEqual(["op-2", "op-3", "op-4"]);
  });

  it("endSpan sets final status", () => {
    const span = tracer.startSpan({ name: "manual" });
    expect(span.status).toBe("unset");
    tracer.endSpan(span, "ok");
    expect(span.status).toBe("ok");
  });
});
