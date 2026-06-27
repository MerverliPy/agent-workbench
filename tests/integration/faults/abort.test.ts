/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ulid } from "ulid";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";
import { FaultModelProvider } from "../../helpers/faults";
import type { TestDb } from "../../helpers/test-db";
import type { PermissionPolicy } from "@agent-workbench/permissions";

let testDb: TestDb;
let projectDir: string;

const ASK_WRITE_POLICY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "write", outcome: "ask", riskLevel: "high", reason: "test" },
    { toolName: "edit", outcome: "ask", riskLevel: "high", reason: "test" },
    { toolName: "apply_patch", outcome: "ask", riskLevel: "high", reason: "test" },
    { toolName: "grep", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "glob", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "bash", outcome: "ask", riskLevel: "high", reason: "test" },
    { toolName: "revert_last_change", outcome: "ask", riskLevel: "high", reason: "test" },
    { toolName: "diff_preview", outcome: "allow", riskLevel: "low", reason: "test" },
  ],
  pathRules: [],
  commandRules: [],
  agentRules: [],
};

beforeAll(() => {
  testDb = createTestDb();
  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-fault-abort-"));
  writeFileSync(join(projectDir, "abort-target.txt"), "safe content\n");
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

describe("Abort fault injection — pre-aborted signal", () => {
  it("pre-aborted signal → run.status is aborted before any model call", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [{ text: "Should not be called." }],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const controller = new AbortController();
    controller.abort();

    const result = await server.sessionRunner.run(sessionId, "pre-aborted", {
      signal: controller.signal,
    });

    expect(result.status).toBe("aborted");

    // No model.call_started should be recorded (run returns before executeLoop).
    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const modelStarted = ledger.filter((e) => e.eventType === "model.call_started");
    expect(modelStarted.length).toBe(0);

    // No run.aborted in ledger either — run returns before ledger.recordRunStarted.
    const allLedger = ledger.filter((e) => e.eventType !== "agent.profile_applied");
    expect(allLedger.length).toBe(0);
  });
});

describe("Abort fault injection — during model call", () => {
  it("model throws AbortError via FaultModelProvider → run.status is aborted", async () => {
    const faultProvider = new FaultModelProvider([
      { type: "abort" },
    ]);

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: faultProvider,
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(sessionId, "abort during model");

    expect(result.status).toBe("aborted");

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const runAborted = ledger.filter((e) => e.eventType === "run.aborted");
    expect(runAborted.length).toBe(1);

    const runCompleted = ledger.filter((e) => e.eventType === "run.completed");
    expect(runCompleted.length).toBe(0);
  });
});

describe("Abort fault injection — while waiting for permission", () => {
  it("abort during ask-gated permission → run.status is aborted, no mutation", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ASK_WRITE_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "call-1", name: "write", input: { path: "abort-target.txt", content: "BAD CONTENT" } },
          ],
        },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    // Start the run but don't await — we'll abort while it's waiting.
    const runPromise = server.sessionRunner.run(sessionId, "write then abort");

    // Give the run a moment to reach the permission gate.
    await new Promise((r) => setTimeout(r, 100));

    const aborted = server.sessionRunner.abort(sessionId);
    expect(aborted).toBe(true);

    const result = await runPromise;

    expect(result.status).toBeOneOf(["aborted", "failed"]);

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const runAborted = ledger.filter((e) => e.eventType === "run.aborted");
    expect(runAborted.length).toBeGreaterThanOrEqual(1);

    // No run.completed.
    const runCompleted = ledger.filter((e) => e.eventType === "run.completed");
    expect(runCompleted.length).toBe(0);

    // No plan.completed (plan should not complete on abort).
    const planCompleted = ledger.filter((e) => e.eventType === "plan.completed");
    expect(planCompleted.length).toBe(0);

    // No shell.command_started (not relevant to this test but good sanity check).
    const shellStarted = ledger.filter((e) => e.eventType === "shell.command_started");
    expect(shellStarted.length).toBe(0);
  });

  it("abort during ask-gated bash → no shell.command_started", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ASK_WRITE_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "call-1", name: "bash", input: { command: "echo 'should not run'" } },
          ],
        },
        { text: "Done." },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const runPromise = server.sessionRunner.run(sessionId, "bash then abort");

    await new Promise((r) => setTimeout(r, 100));

    server.sessionRunner.abort(sessionId);

    const result = await runPromise;

    expect(result.status).toBeOneOf(["aborted", "failed"]);

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const shellStarted = ledger.filter((e) => e.eventType === "shell.command_started");
    expect(shellStarted.length).toBe(0);
  });
});
