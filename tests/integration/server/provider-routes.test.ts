/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";
import type { TestDb } from "../../helpers/test-db";
import { ListProvidersRoute, GetProviderRoute, ListProviderModelsRoute } from "@agent-workbench/protocol";
import type { InferRouteResponse } from "@agent-workbench/protocol";

let testDb: TestDb;

beforeAll(() => {
  testDb = createTestDb();
});

afterAll(() => {
  testDb.cleanup();
});

describe("Provider routes — GET /provider", () => {
  it("returns list of available providers", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(ListProvidersRoute.path, {
      method: ListProvidersRoute.method,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = ListProvidersRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items.length).toBeGreaterThanOrEqual(2);
      const stubEntry = parsed.data.items.find((i: { id: string }) => i.id === "stub");
      expect(stubEntry).toBeDefined();
      expect(stubEntry!.name).toBe("Stub Provider");
      expect(stubEntry!.status).toBe("connected");
    }
  });

  it("response matches schema shape", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(ListProvidersRoute.path, {
      method: ListProvidersRoute.method,
    });
    const body = await res.json();

    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);

    for (const item of body.items) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("status");
      expect(["connected", "disconnected", "error"]).toContain(item.status);
    }
  });

  it("does not expose secret values in provider metadata", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(ListProvidersRoute.path, {
      method: ListProvidersRoute.method,
    });
    const body = await res.json();
    const bodyStr = JSON.stringify(body);

    expect(bodyStr).not.toContain("sk-");
    expect(bodyStr).not.toContain("Bearer ");
    expect(bodyStr).not.toContain("api_key");
    expect(bodyStr).not.toContain("OPENAI_API_KEY");
  });
});

describe("Provider routes — GET /provider/:providerId", () => {
  it("returns stub provider metadata", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const path = GetProviderRoute.path.replace(":providerId", "stub");
    const res = await server.app.request(path, {
      method: GetProviderRoute.method,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = GetProviderRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe("stub");
      expect(parsed.data.name).toBe("Stub Provider");
      expect(parsed.data.status).toBe("connected");
    }
  });

  it("returns 404 for unknown provider", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const path = GetProviderRoute.path.replace(":providerId", "nonexistent");
    const res = await server.app.request(path, {
      method: GetProviderRoute.method,
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("nonexistent");
  });

  it("returns structured error envelope for unknown provider", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const path = GetProviderRoute.path.replace(":providerId", "ghost-provider");
    const res = await server.app.request(path, {
      method: GetProviderRoute.method,
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.recoverable).toBe(true);
  });
});

describe("Provider routes — GET /provider/:providerId/model", () => {
  it("returns models for stub provider", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const path = ListProviderModelsRoute.path.replace(":providerId", "stub");
    const res = await server.app.request(path, {
      method: ListProviderModelsRoute.method,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = ListProviderModelsRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items.length).toBeGreaterThanOrEqual(1);
      const model = parsed.data.items[0]!;
      expect(model.providerId).toBe("stub");
      expect(model.capabilities).toBeDefined();
    }
  });

  it("returns 404 for unknown provider models", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const path = ListProviderModelsRoute.path.replace(":providerId", "nonexistent");
    const res = await server.app.request(path, {
      method: ListProviderModelsRoute.method,
    });
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("Provider routes — integration with custom provider", () => {
  it("custom provider from test options is accessible", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const path = GetProviderRoute.path.replace(":providerId", "custom");
    const res = await server.app.request(path, {
      method: GetProviderRoute.method,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe("custom");
    expect(body.name).toBe("Custom Provider");
    expect(body.status).toBe("connected");
  });
});
