import { beforeEach, describe, expect, it } from "bun:test";
import type { LogEntry } from "@agent-workbench/telemetry";
import { RequestLogger } from "@agent-workbench/telemetry";

describe("RequestLogger", () => {
  let output: string[];
  let logger: RequestLogger;

  beforeEach(() => {
    output = [];
    logger = new RequestLogger({
      output: {
        write: (line: string) => output.push(line),
      },
    });
  });

  /** Parse all JSON log lines from captured output. */
  function parseAll(): LogEntry[] {
    return output
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as LogEntry);
  }

  it("logs at debug level", () => {
    logger.debug("starting up", { requestId: "req-1" });
    const entries = parseAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe("debug");
    expect(entries[0]?.message).toBe("starting up");
    expect(entries[0]?.requestId).toBe("req-1");
  });

  it("logs at info level", () => {
    logger.info("server ready", { sessionId: "sess-1" });
    const entries = parseAll();
    expect(entries[0]?.level).toBe("info");
    expect(entries[0]?.sessionId).toBe("sess-1");
  });

  it("logs at warn level", () => {
    logger.warn("rate limit approaching");
    const entries = parseAll();
    expect(entries[0]?.level).toBe("warn");
  });

  it("logs at error level", () => {
    logger.error("connection refused", {
      error: "ECONNREFUSED",
      metadata: { host: "localhost", port: 3000 },
    });
    const entries = parseAll();
    expect(entries[0]?.level).toBe("error");
    expect(entries[0]?.error).toBe("ECONNREFUSED");
    expect(entries[0]?.metadata).toEqual({ host: "localhost", port: 3000 });
  });

  it("respects minimum log level", () => {
    const quiet = new RequestLogger({
      level: "warn",
      output: { write: (line: string) => output.push(line) },
    });
    quiet.debug("should not appear");
    quiet.info("should not appear either");
    quiet.warn("this appears");
    quiet.error("this too");

    const entries = parseAll();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.level).toBe("warn");
    expect(entries[1]?.level).toBe("error");
  });

  it("logs HTTP request completion", () => {
    logger.logRequest({
      requestId: "req-42",
      method: "POST",
      path: "/session/abc/message",
      statusCode: 200,
      durationMs: 45.2,
    });
    const entries = parseAll();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe("info");
    expect(entries[0]?.requestId).toBe("req-42");
    expect(entries[0]?.method).toBe("POST");
    expect(entries[0]?.path).toBe("/session/abc/message");
    expect(entries[0]?.statusCode).toBe(200);
    expect(entries[0]?.durationMs).toBe(45.2);
  });

  it("classifies 4xx as warn level", () => {
    logger.logRequest({
      requestId: "req-1",
      method: "GET",
      path: "/session/nonexistent",
      statusCode: 404,
      durationMs: 12,
    });
    const entries = parseAll();
    expect(entries[0]?.level).toBe("warn");
  });

  it("classifies 5xx as error level", () => {
    logger.logRequest({
      requestId: "req-1",
      method: "GET",
      path: "/health",
      statusCode: 500,
      durationMs: 100,
      error: "Internal server error",
    });
    const entries = parseAll();
    expect(entries[0]?.level).toBe("error");
    expect(entries[0]?.error).toBe("Internal server error");
  });

  it("includes session context in log request", () => {
    logger.logRequest({
      requestId: "req-1",
      method: "GET",
      path: "/session",
      statusCode: 200,
      durationMs: 10,
    });
    const entries = parseAll();
    expect(entries[0]?.requestId).toBe("req-1");
  });

  it("produces valid JSON log lines by default", () => {
    logger.info("test message", { requestId: "r1" });
    expect(output).toHaveLength(1);

    // Should be valid JSON
    const parsed = JSON.parse(output[0]!);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("test message");
    expect(parsed.timestamp).toBeDefined();
  });

  it("pretty mode produces colored output", () => {
    const prettyOutput: string[] = [];
    const pretty = new RequestLogger({
      pretty: true,
      output: { write: (line: string) => prettyOutput.push(line) },
    });
    pretty.info("server started");
    pretty.error("oops");

    expect(prettyOutput).toHaveLength(4); // 2 writes per log entry (line + newline)
    // Pretty output should contain ANSI color codes
    expect(prettyOutput[0]).toContain("\x1b[36m"); // cyan for info
    expect(prettyOutput[0]).toContain("[INFO"); // padded to 5 chars
    expect(prettyOutput[2]).toContain("[ERROR");
    expect(prettyOutput[2]).toContain("\x1b[31m"); // red for error
  });

  it("includes all optional fields when provided", () => {
    logger.info("full context", {
      requestId: "abc",
      sessionId: "sess-1",
      method: "POST",
      path: "/test",
      statusCode: 201,
      durationMs: 33,
      error: "none",
      metadata: { version: "1.0" },
    });
    const entry = parseAll()[0]!;
    expect(entry.requestId).toBe("abc");
    expect(entry.sessionId).toBe("sess-1");
    expect(entry.method).toBe("POST");
    expect(entry.path).toBe("/test");
    expect(entry.statusCode).toBe(201);
    expect(entry.durationMs).toBe(33);
    expect(entry.error).toBe("none");
    expect(entry.metadata).toEqual({ version: "1.0" });
  });

  it("omits undefined optional fields from output", () => {
    logger.info("minimal");
    const entry = parseAll()[0]!;
    expect(entry.requestId).toBeUndefined();
    expect(entry.sessionId).toBeUndefined();
    expect(entry.method).toBeUndefined();
    expect(entry.path).toBeUndefined();
  });

  it("defaults to stdout when no output specified", () => {
    // Just verify construction doesn't throw
    const defaultLogger = new RequestLogger();
    expect(defaultLogger).toBeDefined();
  });
});
