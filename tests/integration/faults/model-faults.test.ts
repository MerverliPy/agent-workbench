/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ulid } from "ulid";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";
import { FaultModelProvider } from "../../helpers/faults";
import type { TestDb } from "../../helpers/test-db";

let testDb: TestDb;
let projectDir: string;

beforeAll(() => {
  testDb = createTestDb();
  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-fault-model-"));
});

afterAll(() => {
  testDb.cleanup();
  try { rmSync(projectDir, { recursive: true, force: true }); } catch {}
});

function createSession(server: ReturnType<typeof createTestServer>, sessionId: string): void {
  server.services.sessionRepository.create({
    id: sessionId,
    projectPath: projectDir,
    title: null,
    activeAgent: null,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: null,
    metadataJson: null,
  });
}

describe("Model fault injection — normal Error", () => {
  it("model throws Error on first call → run.status is failed", async () => {
    const faultProvider = new FaultModelProvider([
      { type: "error", message: "Simulated provider outage" },
    ]);

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: faultProvider,
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(sessionId, "hello");

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Simulated provider outage");
    expect(result.assistantMessageId).toBeUndefined();

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const failedEntries = ledger.filter((e) => e.eventType === "model.call_failed");
    expect(failedEntries.length).toBeGreaterThanOrEqual(1);

    const runFailedEntries = ledger.filter((e) => e.eventType === "run.failed");
    expect(runFailedEntries.length).toBe(1);

    const runCompleted = ledger.filter((e) => e.eventType === "run.completed");
    expect(runCompleted.length).toBe(0);
  });

  it("model throws Error after a safe tool call → partial progress persisted, run failed", async () => {
    const faultProvider = new FaultModelProvider([
      {
        type: "normal",
        turn: {
          toolCalls: [{ id: "call-1", name: "read", input: { path: "nonexistent.ts" } }],
        },
      },
      { type: "error", message: "Second call crashed" },
    ]);

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: faultProvider,
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(sessionId, "read then crash");

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Second call crashed");

    // Tool call from first turn should be persisted.
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
    const readCall = toolCalls.find((t) => t.toolName === "read");
    expect(readCall).toBeDefined();

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const modelFailed = ledger.filter((e) => e.eventType === "model.call_failed");
    expect(modelFailed.length).toBeGreaterThanOrEqual(1);

    const runFailed = ledger.filter((e) => e.eventType === "run.failed");
    expect(runFailed.length).toBe(1);

    const runCompleted = ledger.filter((e) => e.eventType === "run.completed");
    expect(runCompleted.length).toBe(0);
  });

  it("model throws AbortError → run.status is aborted", async () => {
    const faultProvider = new FaultModelProvider([
      { type: "abort" },
    ]);

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: faultProvider,
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(sessionId, "should abort");

    expect(result.status).toBe("aborted");

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const runAborted = ledger.filter((e) => e.eventType === "run.aborted");
    expect(runAborted.length).toBe(1);

    const runCompleted = ledger.filter((e) => e.eventType === "run.completed");
    expect(runCompleted.length).toBe(0);
  });

  it("empty tool_calls response → run completes with no mutation", async () => {
    const faultProvider = new FaultModelProvider([
      { type: "empty-tool-calls" },
      { type: "normal", turn: { text: "All done." } },
    ]);

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: faultProvider,
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(sessionId, "empty tools");

    // Empty tool_calls should not crash the loop; the model loop continues
    // and the second turn returns a text response.
    expect(result.status).toBe("completed");
    expect(result.assistantMessageId).toBeDefined();

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const runCompleted = ledger.filter((e) => e.eventType === "run.completed");
    expect(runCompleted.length).toBe(1);
  });

  it("repeated tool calls → model loop processes multiple rounds", async () => {
    const faultProvider = new FaultModelProvider([
      {
        type: "normal",
        turn: {
          toolCalls: [{ id: "call-1", name: "read", input: { path: "nonexistent.ts" } }],
        },
      },
      {
        type: "normal",
        turn: {
          toolCalls: [{ id: "call-2", name: "read", input: { path: "nonexistent.ts" } }],
        },
      },
      { type: "normal", turn: { text: "Read twice." } },
    ]);

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: faultProvider,
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(sessionId, "read twice");

    expect(result.status).toBe("completed");

    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    expect(toolCalls.filter((t) => t.toolName === "read").length).toBe(2);

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const modelCompleted = ledger.filter((e) => e.eventType === "model.call_completed");
    expect(modelCompleted.length).toBeGreaterThanOrEqual(2);
  });
});
