/// <reference types="bun" />
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StubModelProvider } from "@agent-workbench/models";
import type { TestDb } from "../helpers/test-db";
import { createTestDb } from "../helpers/test-db";
import { createTestServer } from "../helpers/test-server";

/**
 * Streaming validation E2E test.
 *
 * Uses StubModelProvider (which implements stream()) to validate:
 *   1. The streaming provider emits correct word-by-word deltas
 *   2. A session with a streaming provider persists the complete message
 *   3. Message content from streaming is correct
 *
 * Non-streaming fallback test validates:
 *   4. MockModelProvider (no stream()) returns complete responses
 *   5. Messages from non-streaming path persist correctly
 */
describe("Streaming path (E2E via server)", () => {
  let testDb: TestDb;
  let projectDir: string;

  beforeAll(() => {
    testDb = createTestDb();
    projectDir = mkdtempSync(join(tmpdir(), "agent-wb-e2e-stream-"));
  });

  afterAll(() => {
    testDb.cleanup();
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {}
  });

  it("StubModelProvider.stream() yields word-by-word deltas", async () => {
    const provider = new StubModelProvider({
      textResponse: "Hello from streaming E2E test.",
    });

    const chunks: Array<{ content: string; done: boolean }> = [];
    for await (const chunk of provider.stream({
      messages: [{ role: "user", content: "Test streaming" }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const allContent = chunks.map((c) => c.content).join("");
    expect(allContent).toContain("streaming");

    const last = chunks[chunks.length - 1]!;
    expect(last.done).toBe(true);
  });

  it("session with streaming provider persists the complete message", async () => {
    const provider = new StubModelProvider({
      textResponse: "Streamed response for E2E verification.",
    });

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: provider,
    });

    // Create session
    const createRes = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: projectDir, title: "Stream E2E" }),
    });
    expect(createRes.status).toBeOneOf([200, 201]);
    const session = (await createRes.json()) as { id: string };

    // Submit message — SessionRunner uses streaming path internally
    const msgRes = await server.app.request(`/session/${session.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Stream test message", role: "user" }),
    });
    expect(msgRes.status).toBeOneOf([200, 201]);
    const message = (await msgRes.json()) as { role: string; content: string };

    // Verify final message was persisted with complete streamed content
    expect(message.role).toBe("assistant");
    expect(message.content).toContain("Streamed");
  });

  it("session streaming response persists in message list", async () => {
    const provider = new StubModelProvider({
      textResponse: "Persisted streaming output.",
    });

    const server = createTestServer({
      storage: testDb.connection,
      modelProvider: provider,
    });

    const createRes = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: projectDir }),
    });
    const session = (await createRes.json()) as { id: string };

    await server.app.request(`/session/${session.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Persist streaming", role: "user" }),
    });

    const listRes = await server.app.request(`/session/${session.id}/message`);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      items: Array<{ role: string; content: string }>;
    };
    expect(listBody.items.length).toBeGreaterThanOrEqual(2);
    const assistantMsg = listBody.items.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toContain("streaming");
  });
});

describe("Non-streaming fallback (E2E via server)", () => {
  let testDb: TestDb;
  let projectDir: string;

  beforeAll(() => {
    testDb = createTestDb();
    projectDir = mkdtempSync(join(tmpdir(), "agent-wb-e2e-nostream-"));
  });

  afterAll(() => {
    testDb.cleanup();
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {}
  });

  it("non-streaming mock provider returns complete response", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [{ text: "Non-streaming fallback response." }],
    });

    const createRes = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectPath: projectDir,
        title: "No-stream test",
      }),
    });
    const session = (await createRes.json()) as { id: string };

    const msgRes = await server.app.request(`/session/${session.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Hello from non-streaming.",
        role: "user",
      }),
    });
    expect(msgRes.status).toBeOneOf([200, 201]);
    const message = (await msgRes.json()) as { content: string; role: string };
    expect(message.role).toBe("assistant");
    expect(message.content).toContain("Non-streaming");
  });

  it("non-streaming provider persists messages correctly", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [{ text: "Persisted non-streaming response." }],
    });

    const createRes = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: projectDir }),
    });
    const session = (await createRes.json()) as { id: string };

    await server.app.request(`/session/${session.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "Persist test", role: "user" }),
    });

    const listRes = await server.app.request(`/session/${session.id}/message`);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      items: Array<{ role: string; content: string }>;
    };
    expect(listBody.items.length).toBeGreaterThanOrEqual(2);
    const assistantMsg = listBody.items.find((m) => m.role === "assistant");
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg?.content).toContain("non-streaming");
  });
});
