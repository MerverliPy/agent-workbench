import { describe, it, expect, beforeEach } from "bun:test";
import { ErrorReporter } from "@agent-workbench/telemetry";

describe("ErrorReporter", () => {
  let reporter: ErrorReporter;

  beforeEach(() => {
    reporter = new ErrorReporter();
  });

  it("starts with no reports", () => {
    expect(reporter.getReports()).toEqual([]);
    expect(reporter.getRecentErrors()).toEqual([]);
  });

  it("reports an error and returns a structured report", () => {
    const err = new Error("something broke");
    const report = reporter.report(err);

    expect(report.message).toBe("something broke");
    expect(report.stack).toBeDefined();
    expect(report.level).toBe("error");
    expect(report.timestamp).toBeDefined();
    expect(report.id).toBeDefined();
    expect(report.id.length).toBe(12);
  });

  it("includes optional context in the report", () => {
    const err = new Error("ctx error");
    const report = reporter.report(err, {
      traceId: "abc123",
      sessionId: "sess-1",
      runId: "run-1",
      spanName: "model.call",
      metadata: { provider: "openai" },
      level: "warning",
    });

    expect(report.traceId).toBe("abc123");
    expect(report.sessionId).toBe("sess-1");
    expect(report.runId).toBe("run-1");
    expect(report.spanName).toBe("model.call");
    expect(report.metadata).toEqual({ provider: "openai" });
    expect(report.level).toBe("warning");
  });

  it("stores multiple reports", () => {
    reporter.report(new Error("first"));
    reporter.report(new Error("second"));
    reporter.report(new Error("third"));

    expect(reporter.getReports()).toHaveLength(3);
  });

  it("getRecentErrors returns newest first", () => {
    reporter.report(new Error("old"));
    reporter.report(new Error("new"));

    const recent = reporter.getRecentErrors();
    expect(recent).toHaveLength(2);
    expect(recent[0]!.message).toBe("new");
    expect(recent[1]!.message).toBe("old");
  });

  it("getRecentErrors limits results", () => {
    for (let i = 0; i < 10; i++) {
      reporter.report(new Error(`err-${i}`));
    }
    const recent = reporter.getRecentErrors(3);
    expect(recent).toHaveLength(3);
    expect(recent[0]!.message).toBe("err-9");
  });

  it("getSessionErrors filters by session ID", () => {
    reporter.report(new Error("a1"), { sessionId: "sess-a" });
    reporter.report(new Error("a2"), { sessionId: "sess-a" });
    reporter.report(new Error("b1"), { sessionId: "sess-b" });

    const sessA = reporter.getSessionErrors("sess-a");
    expect(sessA).toHaveLength(2);
    for (const r of sessA) {
      expect(r.sessionId).toBe("sess-a");
    }

    const sessB = reporter.getSessionErrors("sess-b");
    expect(sessB).toHaveLength(1);
    expect(sessB[0]!.message).toBe("b1");
  });

  it("returns empty array for unknown session", () => {
    expect(reporter.getSessionErrors("nonexistent")).toEqual([]);
  });

  it("clears all reports", () => {
    reporter.report(new Error("e1"));
    reporter.report(new Error("e2"));
    expect(reporter.getReports()).toHaveLength(2);

    reporter.clear();
    expect(reporter.getReports()).toEqual([]);
  });

  it("enforces max reports ring buffer", () => {
    const small = new ErrorReporter({ maxErrors: 3 });
    for (let i = 0; i < 5; i++) {
      small.report(new Error(`e-${i}`));
    }
    const all = small.getReports();
    expect(all).toHaveLength(3);
    expect(all[0]!.message).toBe("e-2");
    expect(all[2]!.message).toBe("e-4");
  });

  it("defaults level to error when not specified", () => {
    const report = reporter.report(new Error("default level"));
    expect(report.level).toBe("error");
  });

  it("includes error stack when available", () => {
    const err = new Error("with stack");
    const report = reporter.report(err);
    expect(report.stack).toBeDefined();
    expect(report.stack!.length).toBeGreaterThan(0);
  });

  it("omits stack when error has no stack", () => {
    const err = { message: "no stack", name: "Error" } as Error;
    const report = reporter.report(err);
    expect(report.stack).toBeUndefined();
  });
});
