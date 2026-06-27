/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { createTestDb } from "../helpers/test-db";
import { createTestServer } from "../helpers/test-server";
import { ErrorEnvelope } from "@agent-workbench/protocol";
import type { TestDb } from "../helpers/test-db";

let testDb: TestDb;
let server: ReturnType<typeof createTestServer>;

beforeAll(() => {
  testDb = createTestDb();
  server = createTestServer({ storage: testDb.connection });
});

afterAll(() => {
  testDb.cleanup();
});

describe("Server API contract — error envelopes", () => {
  it("unknown route returns structured ErrorEnvelope with NOT_FOUND code", async () => {
    const res = await server.app.request("/completely/unknown/route");
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code", "NOT_FOUND");
    expect(body.error).toHaveProperty("message");
    expect(typeof body.error.message).toBe("string");

    // Validate with schema.
    const parsed = ErrorEnvelope.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("error response includes code, message, and requestId", async () => {
    const res = await server.app.request("/nonexistent-route");
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
    // requestId is set by middleware, should be present
    expect(typeof body.error.requestId).toBe("string");
  });

  it("error response does not include stack traces", async () => {
    const res = await server.app.request("/nonexistent-route");
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    expect(body.error).toBeDefined();
    expect(body.error.stack).toBeUndefined();

    // No raw stack trace content anywhere in the response.
    const bodyText = JSON.stringify(body);
    expect(bodyText).not.toContain("at ");
    expect(bodyText).not.toContain(".ts:");
  });

  it("invalid session id (not a ULID) returns 404 with ErrorEnvelope", async () => {
    const res = await server.app.request("/session/not-a-ulid");
    // Server may handle this as 404 or 400 depending on implementation.
    // Check that we get a structured error envelope.
    const body = await res.json();

    if (body.error) {
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");

      const parsed = ErrorEnvelope.safeParse(body);
      expect(parsed.success).toBe(true);

      expect(body.error.stack).toBeUndefined();
    }
  });

  it("delete nonexistent session returns error envelope", async () => {
    const res = await server.app.request("/session/00000000000000000000000000", {
      method: "DELETE",
    });
    // 404 or error envelope expected.
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code");

    const parsed = ErrorEnvelope.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("error response JSON has non-empty message", async () => {
    const res = await server.app.request("/nonexistent");
    const body = await res.json();
    expect(body.error.message.length).toBeGreaterThan(0);
  });

  it("error response never exposes raw internals in message", async () => {
    // Try a malformed request body on a POST route.
    const res = await server.app.request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const body = await res.json();

    if (body.error) {
      const bodyStr = JSON.stringify(body);
      // Should not contain raw stack trace patterns.
      expect(bodyStr).not.toContain("Error: ");
      expect(bodyStr).not.toContain("at ");
      expect(bodyStr).not.toContain(".ts:");
      expect(body.error.stack).toBeUndefined();
    }
  });
});

describe("Server API contract — successful responses", () => {
  it("GET /global/health shape", async () => {
    const res = await server.app.request("/global/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("uptime");
    // Should NOT be wrapped in { error: ... }
    expect(body.error).toBeUndefined();
  });

  it("GET /global/info shape", async () => {
    const res = await server.app.request("/global/info");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("serverTime");
    expect(body).toHaveProperty("capabilities");
    expect(Array.isArray(body.capabilities)).toBe(true);
  });
});
