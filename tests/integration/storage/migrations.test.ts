/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createTestDb } from "../../helpers/test-db";
import type { TestDb } from "../../helpers/test-db";

let testDb: TestDb;

beforeAll(() => {
  testDb = createTestDb();
});

afterAll(() => {
  testDb.cleanup();
});

describe("storage migrations", () => {
  it("runs on a fresh temp database", () => {
    expect(testDb.connection).toBeDefined();
  });

  it("has core tables", () => {
    const sqlite = testDb.connection.sqlite;
    const rows = sqlite
      .query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_drizzle_%' AND name NOT LIKE '__drizzle_%' ORDER BY name`)
      .all() as Array<{ name: string }>;
    const names = rows.map((r) => r.name);

    expect(names).toContain("sessions");
    expect(names).toContain("messages");
    expect(names).toContain("tool_calls");
    expect(names).toContain("run_ledger");
    expect(names).toContain("permission_requests");
    expect(names).toContain("permission_decisions");
    expect(names).toContain("file_changes");
    expect(names).toContain("cache_entries");
    expect(names).toContain("summaries");
    expect(names).toContain("config_snapshots");
  });

  it("has plans table (Phase 13)", () => {
    const sqlite = testDb.connection.sqlite;
    const row = sqlite
      .query(`SELECT name FROM sqlite_master WHERE type='table' AND name='plans'`)
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.name).toBe("plans");
  });
});
