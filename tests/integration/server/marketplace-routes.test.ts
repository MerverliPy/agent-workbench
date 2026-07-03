/// <reference types="bun" />
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import {
  CreateProviderProfileRoute,
  DeleteProviderProfileRoute,
  GetProviderProfileRoute,
  ListProviderProfilesRoute,
  TestProviderConnectionRoute,
  UpdateProviderProfileRoute,
} from "@agent-workbench/protocol";
import type { TestDb } from "../../helpers/test-db";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";

let testDb: TestDb;

beforeAll(() => {
  testDb = createTestDb();
});

afterAll(() => {
  testDb.cleanup();
});

describe("Marketplace CRUD — /marketplace/providers", () => {
  // Clean up all marketplace providers between tests to avoid cross-test pollution.
  afterEach(async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });
    const profiles = server.services.providerMarketplace.list({
      enabledOnly: false,
    });
    for (const p of profiles) {
      server.services.providerMarketplace.deleteApiKey(p.id);
      server.services.providerMarketplace.delete(p.id);
    }
  });

  it("starts with empty provider profile list", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(ListProviderProfilesRoute.path, {
      method: ListProviderProfilesRoute.method,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = ListProviderProfilesRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toEqual([]);
    }
  });

  it("creates a provider profile", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(CreateProviderProfileRoute.path, {
      method: CreateProviderProfileRoute.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test OpenAI",
        providerType: "openai",
        model: "gpt-4o",
        tier: "preferred",
        taskCategories: ["code_generation", "summarization"],
        contextLimit: 128000,
        costPer1KInput: 0.0025,
        costPer1KOutput: 0.01,
        enabled: true,
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = CreateProviderProfileRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Test OpenAI");
      expect(parsed.data.providerType).toBe("openai");
      expect(parsed.data.model).toBe("gpt-4o");
      expect(parsed.data.tier).toBe("preferred");
      expect(parsed.data.enabled).toBe(true);
      expect(parsed.data.hasKey).toBe(false);
    }
  });

  it("creates a profile with an API key", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(CreateProviderProfileRoute.path, {
      method: CreateProviderProfileRoute.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "With Key",
        providerType: "anthropic",
        model: "claude-sonnet-4-20250514",
        apiKey: "sk-ant-test-key-12345",
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = CreateProviderProfileRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("With Key");
      expect(parsed.data.hasKey).toBe(true);
      // API key should never be in the response
      const raw = JSON.stringify(body);
      expect(raw).not.toContain("sk-ant-test-key-12345");
    }
  });

  it("lists created profiles", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    // Create two profiles
    await server.app.request(CreateProviderProfileRoute.path, {
      method: CreateProviderProfileRoute.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "First",
        providerType: "openai",
        model: "gpt-4o",
      }),
    });
    await server.app.request(CreateProviderProfileRoute.path, {
      method: CreateProviderProfileRoute.method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Second",
        providerType: "anthropic",
        model: "claude-sonnet-4-20250514",
      }),
    });

    const res = await server.app.request(ListProviderProfilesRoute.path, {
      method: ListProviderProfilesRoute.method,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = ListProviderProfilesRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items).toHaveLength(2);
      const names = parsed.data.items.map((i: { name: string }) => i.name);
      expect(names).toContain("First");
      expect(names).toContain("Second");
    }
  });

  it("gets a single profile by id", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const createRes = await server.app.request(
      CreateProviderProfileRoute.path,
      {
        method: CreateProviderProfileRoute.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Single",
          providerType: "openai",
          model: "gpt-4o",
        }),
      },
    );
    const created = (await createRes.json()) as { id: string };

    const res = await server.app.request(
      GetProviderProfileRoute.path.replace(":id", created.id),
      { method: GetProviderProfileRoute.method },
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = GetProviderProfileRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.id).toBe(created.id);
      expect(parsed.data.name).toBe("Single");
    }
  });

  it("returns 404 for unknown profile", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(
      GetProviderProfileRoute.path.replace(":id", "nonexistent"),
      { method: GetProviderProfileRoute.method },
    );
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("updates a profile partially", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const createRes = await server.app.request(
      CreateProviderProfileRoute.path,
      {
        method: CreateProviderProfileRoute.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Before Update",
          providerType: "openai",
          model: "gpt-4o",
          tier: "fallback",
        }),
      },
    );
    const created = (await createRes.json()) as { id: string };

    const updateRes = await server.app.request(
      UpdateProviderProfileRoute.path.replace(":id", created.id),
      {
        method: UpdateProviderProfileRoute.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "After Update",
          tier: "preferred",
          enabled: false,
        }),
      },
    );
    expect(updateRes.status).toBe(200);

    const body = await updateRes.json();
    const parsed = UpdateProviderProfileRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("After Update");
      expect(parsed.data.tier).toBe("preferred");
      expect(parsed.data.enabled).toBe(false);
      expect(parsed.data.model).toBe("gpt-4o");
    }
  });

  it("deletes a provider profile", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const createRes = await server.app.request(
      CreateProviderProfileRoute.path,
      {
        method: CreateProviderProfileRoute.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "To Delete",
          providerType: "openai",
          model: "gpt-4o",
        }),
      },
    );
    const created = (await createRes.json()) as { id: string };

    const deleteRes = await server.app.request(
      DeleteProviderProfileRoute.path.replace(":id", created.id),
      { method: DeleteProviderProfileRoute.method },
    );
    expect(deleteRes.status).toBe(200);

    const deleteBody = await deleteRes.json();
    const parsed = DeleteProviderProfileRoute.response.safeParse(deleteBody);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.deleted).toBe(true);
    }

    // Verify it's gone
    const getRes = await server.app.request(
      GetProviderProfileRoute.path.replace(":id", created.id),
      { method: GetProviderProfileRoute.method },
    );
    expect(getRes.status).toBe(404);
  });

  it("returns 404 when deleting nonexistent profile", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(
      DeleteProviderProfileRoute.path.replace(":id", "nonexistent"),
      { method: DeleteProviderProfileRoute.method },
    );
    expect(res.status).toBe(404);
  });

  it("test connection returns not-ok for invalid provider", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const createRes = await server.app.request(
      CreateProviderProfileRoute.path,
      {
        method: CreateProviderProfileRoute.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Me",
          providerType: "custom",
          model: "unknown-model",
          baseUrl: "http://localhost:9999",
        }),
      },
    );
    const created = (await createRes.json()) as { id: string };

    const testRes = await server.app.request(
      TestProviderConnectionRoute.path.replace(":id", created.id),
      { method: TestProviderConnectionRoute.method },
    );
    expect(testRes.status).toBe(200);

    const body = await testRes.json();
    const parsed = TestProviderConnectionRoute.response.safeParse(body);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Connection to a non-existent localhost port should fail
      expect(parsed.data.ok).toBe(false);
    }
  });

  it("test connection returns 404 for unknown profile", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [],
    });

    const res = await server.app.request(
      TestProviderConnectionRoute.path.replace(":id", "nonexistent"),
      { method: TestProviderConnectionRoute.method },
    );
    expect(res.status).toBe(404);
  });
});
