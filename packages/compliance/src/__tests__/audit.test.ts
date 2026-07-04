/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { AuditTrail } from "../audit";

/**
 * Creates an in-memory SQLite database with the audit_entries table.
 * Uses bun:sqlite + drizzle-orm directly.
 */
function createAuditTrail(enabled = true, actorFallback = "unknown"): AuditTrail {
  const { Database } = require("bun:sqlite");
  const { drizzle } = require("drizzle-orm/bun-sqlite");

  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);

  // Create the audit_entries table matching the drizzle schema
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      id TEXT PRIMARY KEY,
      sequence INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      resource TEXT NOT NULL,
      detail TEXT,
      previous_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  sqlite.run("CREATE INDEX IF NOT EXISTS audit_entries_sequence_idx ON audit_entries(sequence)");
  sqlite.run("CREATE INDEX IF NOT EXISTS audit_entries_action_idx ON audit_entries(action)");
  sqlite.run("CREATE INDEX IF NOT EXISTS audit_entries_actor_idx ON audit_entries(actor)");
  sqlite.run("CREATE INDEX IF NOT EXISTS audit_entries_resource_idx ON audit_entries(resource)");
  sqlite.run("CREATE INDEX IF NOT EXISTS audit_entries_created_at_idx ON audit_entries(created_at)");

  return new AuditTrail(db, { enabled, actorFallback });
}

describe("AuditTrail", () => {
  it("records an entry with genesis hash", () => {
    const audit = createAuditTrail();
    const entry = audit.record("test.action", "tester", "resource_01", "Test entry");

    expect(entry).toBeDefined();
    expect(entry.action).toBe("test.action");
    expect(entry.actor).toBe("tester");
    expect(entry.resource).toBe("resource_01");
    expect(entry.detail).toBe("Test entry");
    expect(entry.sequence).toBe(1);
    expect(entry.previousHash).toBe("0".repeat(64));
    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.createdAt).toBeDefined();

    // Verify it's actually in the DB
    expect(audit.count()).toBe(1);
  });

  it("chains hashes between consecutive entries", () => {
    const audit = createAuditTrail();
    const e1 = audit.record("chain.test", "alice", "res_a", "First");
    const e2 = audit.record("chain.test", "bob", "res_b", "Second");

    expect(e2.sequence).toBe(e1.sequence + 1);
    expect(e2.previousHash).toBe(e1.hash);
  });

  it("verifies integrity of clean chain", () => {
    const audit = createAuditTrail();
    audit.record("test.a", "user1", "r1");
    audit.record("test.b", "user2", "r2");
    audit.record("test.c", "user3", "r3");

    const result = audit.verifyIntegrity();
    expect(result.valid).toBe(true);
    expect(result.checked).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it("detects tampered entries", () => {
    const { Database } = require("bun:sqlite");
    const sqlite = new Database(":memory:");
    sqlite.run(`
      CREATE TABLE audit_entries (
        id TEXT PRIMARY KEY,
        sequence INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        resource TEXT NOT NULL,
        detail TEXT,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    const { drizzle } = require("drizzle-orm/bun-sqlite");
    const audit = new AuditTrail(drizzle(sqlite));

    // Record an entry
    audit.record("test.action", "user", "res_1", "Original");

    // Tamper with the data directly
    sqlite.run("UPDATE audit_entries SET detail = 'Tampered!' WHERE sequence = 1");

    // Verification should fail
    const result = audit.verifyIntegrity();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!).toContain("hash mismatch");
  });

  it("queries by action", () => {
    const audit = createAuditTrail();
    audit.record("session.create", "sys", "s1");
    audit.record("session.delete", "admin", "s2");
    audit.record("session.create", "sys", "s3");

    const creates = audit.findByAction("session.create");
    expect(creates.length).toBe(2);
    expect(creates[0]!.resource).toBe("s3"); // most recent first (DESC)
    expect(creates[1]!.resource).toBe("s1");
  });

  it("queries by actor", () => {
    const audit = createAuditTrail();
    audit.record("login", "alice", "sess1");
    audit.record("logout", "bob", "sess2");

    const aliceEntries = audit.findByActor("alice");
    expect(aliceEntries.length).toBe(1);
    expect(aliceEntries[0]!.resource).toBe("sess1");
  });

  it("queries by resource", () => {
    const audit = createAuditTrail();
    audit.record("update", "user1", "file_x");
    audit.record("read", "user2", "file_x");

    const entries = audit.findByResource("file_x");
    expect(entries.length).toBe(2);
  });

  it("queries by time range", () => {
    const audit = createAuditTrail();
    const before = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
    audit.record("event", "svc", "res_x");
    const after = new Date(Date.now() + 60000).toISOString(); // 1 minute from now

    const results = audit.findByTimeRange(before, after);
    expect(results.length).toBe(1);
    expect(results[0]!.resource).toBe("res_x");
  });

  it("counts entries accurately", () => {
    const audit = createAuditTrail();
    expect(audit.count()).toBe(0);
    audit.record("a", "u", "r");
    expect(audit.count()).toBe(1);
    audit.record("b", "u", "r");
    expect(audit.count()).toBe(2);
    audit.record("c", "u", "r");
    expect(audit.count()).toBe(3);
  });

  it("throws when disabled", () => {
    const audit = createAuditTrail(false);
    expect(() => audit.record("test", "user", "res")).toThrow(
      "Audit trail is disabled",
    );
  });

  it("uses fallback actor when empty", () => {
    const audit = createAuditTrail(true, "system");
    const entry = audit.record("sys.action", "", "res_x");
    expect(entry.actor).toBe("system");
  });

  it("accepts null detail", () => {
    const audit = createAuditTrail();
    const entry = audit.record("no.detail", "user", "res");
    expect(entry.detail).toBeNull();
  });
});
