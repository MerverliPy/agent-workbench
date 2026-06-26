/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Hono } from "hono";
import { createTestDb } from "../helpers/test-db";
import { createTestServer } from "../helpers/test-server";
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

describe("Server health routes", () => {
  it("GET /global/health returns ok", async () => {
    const res = await server.app.request("/global/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("uptime");
  });

  it("GET /global/info returns server info", async () => {
    const res = await server.app.request("/global/info");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("name");
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("serverTime");
    expect(body).toHaveProperty("capabilities");
    expect(Array.isArray(body.capabilities)).toBe(true);
  });

  it("returns 404 for unknown routes", async () => {
    const res = await server.app.request("/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toHaveProperty("code", "NOT_FOUND");
  });
});
