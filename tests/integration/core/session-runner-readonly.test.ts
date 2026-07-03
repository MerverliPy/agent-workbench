/// <reference types="bun" />
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ulid } from "ulid";
import type { TestDb } from "../../helpers/test-db";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";

let testDb: TestDb;
let server: ReturnType<typeof createTestServer>;
let projectDir: string;

beforeAll(() => {
  testDb = createTestDb();

  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-readonly-"));
  writeFileSync(join(projectDir, "hello.ts"), "export const x = 1;\n");

  server = createTestServer({
    storage: testDb.connection,
    modelTurns: [
      {
        toolCalls: [
          { id: "call-1", name: "read", input: { path: "hello.ts" } },
        ],
      },
      { text: "Done reading." },
    ],
  });
});

afterAll(() => {
  testDb.cleanup();
  try {
    rmSync(projectDir, { recursive: true, force: true });
  } catch {}
});

function createSession(sessionId: string): void {
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

describe("SessionRunner — read-only tool flow", () => {
  it("runs a read tool call end-to-end", async () => {
    const sessionId = ulid();
    createSession(sessionId);

    const result = await server.sessionRunner.run(sessionId, "Read hello.ts");

    expect(result.status).toBe("completed");
    expect(result.assistantMessageId).toBeDefined();

    // Verify user message persisted
    const messages = server.services.messageRepository.listBySession(sessionId);
    expect(messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg).toBeDefined();
    expect(userMsg?.content).toBe("Read hello.ts");

    const assistantMsg = messages.find(
      (m) => m.role === "assistant" && m.contentFormat === "text",
    );
    expect(assistantMsg).toBeDefined();

    // Verify tool call persisted
    const allToolCalls = server.toolCallRepository.listBySession(sessionId);
    expect(allToolCalls.length).toBeGreaterThanOrEqual(1);
    const readCall = allToolCalls.find((t) => t.toolName === "read");
    expect(readCall).toBeDefined();
    expect(readCall?.status).toBe("completed");
  });

  it("errors for unknown session", async () => {
    await expect(
      server.sessionRunner.run("nonexistent", "hello"),
    ).rejects.toThrow("Session not found");
  });

  it("prevents concurrent runs on same session", async () => {
    const sessionId = ulid();
    createSession(sessionId);

    // Start first run (async, won't await)
    const runPromise = server.sessionRunner.run(sessionId, "First message");

    // Second run should fail with concurrency error
    await expect(
      server.sessionRunner.run(sessionId, "Second message"),
    ).rejects.toThrow("already has an active run");

    // Wait for first run to complete
    await runPromise;
  });
});
