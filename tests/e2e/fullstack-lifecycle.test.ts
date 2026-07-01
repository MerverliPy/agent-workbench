/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestDb } from "../helpers/test-db";
import { createTestServer } from "../helpers/test-server";
import type { TestDb } from "../helpers/test-db";
import { WorkbenchClient } from "@agent-workbench/sdk";

/**
 * Full-stack E2E test validating the complete agent-workbench stack
 * through the typed SDK client over real HTTP.
 */
describe("Full-stack lifecycle (E2E via SDK)", () => {
  let testDb: TestDb;
  let server: ReturnType<typeof createTestServer>;
  let projectDir: string;
  let serverHandle: ReturnType<typeof Bun.serve> | undefined;
  let client: WorkbenchClient;
  let sessionId: string;

  beforeAll(() => {
    testDb = createTestDb();
    projectDir = mkdtempSync(join(tmpdir(), "agent-wb-e2e-sdk-"));

    server = createTestServer({
      storage: testDb.connection,
      modelTurns: [
        { text: "I am the E2E test agent." },
      ],
    });

    serverHandle = Bun.serve({
      fetch: server.app.fetch,
      port: 0,
    });

    const baseUrl = `http://127.0.0.1:${serverHandle.port}`;
    client = new WorkbenchClient({ baseUrl });
  });

  afterAll(() => {
    if (serverHandle) serverHandle.stop(true);
    testDb.cleanup();
    try { rmSync(projectDir, { recursive: true, force: true }); } catch {}
  });

  it("GET /health returns server status", async () => {
    const result = await client.health.check();
    expect(result).toHaveProperty("status");
    expect(result.status).toBe("ok");
  });

  it("GET /provider lists registered providers", async () => {
    const result = await client.providers.list();
    expect(result).toHaveProperty("items");
    const items = result.items as Array<{ id: string }>;
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /session creates a session", async () => {
    const session = await client.sessions.create({
      projectPath: projectDir,
      title: "SDK E2E test",
    });
    expect(session).toHaveProperty("id");
    expect(session.projectPath).toBe(projectDir);
    expect(session.status).toBe("active");
    sessionId = session.id;
  });

  it("POST /session/:id/message submits and gets model response", async () => {
    const message = await client.messages.submit(sessionId, {
      content: "Hello agent, what can you do?",
      role: "user",
    });
    expect(message).toHaveProperty("id");
    expect(message.role).toBe("assistant");
    expect(message.content).toContain("E2E");
  });

  it("GET /session/:id/message lists persisted messages", async () => {
    const result = await client.messages.list(sessionId);
    expect(result).toHaveProperty("items");
    const items = result.items as Array<{ role: string }>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.some((m) => m.role === "user")).toBe(true);
    expect(items.some((m) => m.role === "assistant")).toBe(true);
  });

  it("GET /session/:id retrieves session metadata", async () => {
    const session = await client.sessions.get(sessionId);
    expect(session.status).toBe("active");
  });
});
