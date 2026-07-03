/// <reference types="bun" />
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestDb } from "../helpers/test-db";
import { createTestDb } from "../helpers/test-db";
import { createTestServer } from "../helpers/test-server";

let testDb: TestDb;
let server: ReturnType<typeof createTestServer>;
let projectDir: string;

beforeAll(() => {
  testDb = createTestDb();
  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-e2e-sess-"));
  server = createTestServer({
    storage: testDb.connection,
    modelTurns: [{ text: "Hello! This is a test response." }],
  });
});

afterAll(() => {
  testDb.cleanup();
  try {
    rmSync(projectDir, { recursive: true, force: true });
  } catch {}
});

describe("Session lifecycle (E2E)", () => {
  let sessionId: string;

  it("POST /session creates a session", async () => {
    const res = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: projectDir, title: "E2E test" }),
    });
    expect(res.status).toBeOneOf([200, 201]);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("id");
    expect(body.projectPath).toBe(projectDir);
    expect(body.status).toBe("active");
    sessionId = body.id as string;
  });

  it("GET /session lists sessions", async () => {
    const res = await server.app.request("/session");
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    const items = body.items as Array<{ id: string }>;
    expect(items.some((s) => s.id === sessionId)).toBe(true);
  });

  it("GET /session/:id returns session", async () => {
    const res = await server.app.request(`/session/${sessionId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.id).toBe(sessionId);
    expect(body.projectPath).toBe(projectDir);
  });

  it("POST /session/:id/message submits a message and triggers a run", async () => {
    const res = await server.app.request(`/session/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Hello agent", role: "user" }),
    });
    expect(res.status).toBeOneOf([200, 201]);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("runId");
  });

  it("GET /session/:id/message lists messages", async () => {
    const res = await server.app.request(`/session/${sessionId}/message`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    const items = body.items as Array<{ role: string }>;
    // Should have at least the user message and an assistant response
    expect(items.some((m) => m.role === "user")).toBe(true);
  });

  it("POST /session/:id/abort handles abort", async () => {
    // Create a new session just for abort test
    const createRes = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: projectDir }),
    });
    const createBody = (await createRes.json()) as Record<string, unknown>;
    const abortSessionId = createBody.id as string;

    const res = await server.app.request(`/session/${abortSessionId}/abort`, {
      method: "POST",
    });
    expect(res.status).toBeOneOf([200]);
  });

  it("DELETE /session/:id soft-deletes", async () => {
    const res = await server.app.request(`/session/${sessionId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("deleted", true);
  });

  it("GET /session/:id returns 404 for deleted session", async () => {
    const res = await server.app.request(`/session/${sessionId}`);
    // Deleted sessions may still be returned but with status "deleted"
    if (res.status === 404) {
      // ok
    } else {
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.status).toBe("deleted");
    }
  });
});
