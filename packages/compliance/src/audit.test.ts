import { describe, it, expect } from "bun:test";
import { AuditTrail, computeHash } from "./audit";
import { applyRetention, mergeEntries } from "./data-retention";
import type { AuditEntry } from "./audit";

describe("AuditTrail", () => {
  it("starts empty", () => {
    const trail = new AuditTrail();
    expect(trail.size).toBe(0);
    expect(trail.all()).toHaveLength(0);
  });

  it("appends an entry and generates a hash", () => {
    const trail = new AuditTrail();
    const entry = trail.append({
      actor: "user-1",
      action: "session.created",
    });

    expect(entry.id).toBeTruthy();
    expect(entry.timestamp).toBeTruthy();
    expect(entry.previousHash).toBe(""); // genesis
    expect(entry.hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    expect(trail.size).toBe(1);
  });

  it("chains entries via previousHash", () => {
    const trail = new AuditTrail();
    const e1 = trail.append({ actor: "user-1", action: "login" });
    const e2 = trail.append({ actor: "user-1", action: "session.created" });
    const e3 = trail.append({ actor: "agent-1", action: "tool.executed" });

    expect(e1.previousHash).toBe("");
    expect(e2.previousHash).toBe(e1.hash);
    expect(e3.previousHash).toBe(e2.hash);
  });

  it("verify() returns valid for an intact chain", () => {
    const trail = new AuditTrail();
    trail.append({ actor: "user-1", action: "login" });
    trail.append({ actor: "agent-1", action: "tool.executed", resource: "read_file" });
    trail.append({ actor: "system", action: "compaction.suggested" });

    const result = trail.verify();
    expect(result.valid).toBe(true);
  });

  it("verify() detects tampered hash", () => {
    const trail = new AuditTrail();
    trail.append({ actor: "user-1", action: "login" });
    trail.append({ actor: "agent-1", action: "tool.executed" });
    trail.append({ actor: "system", action: "compaction.suggested" });

    // Tamper with the middle entry
    const entries = trail.all() as AuditEntry[];
    const tampered = { ...entries[1]!, action: "tool.aborted" };
    (entries as AuditEntry[])[1] = tampered;
    trail.load(entries);

    const result = trail.verify();
    expect(result.valid).toBe(false);
    expect((result as { message: string }).message).toContain("tampered");
  });

  it("verify() detects broken previousHash link (missing entry)", () => {
    const trail = new AuditTrail();
    trail.append({ actor: "user-1", action: "login" });
    trail.append({ actor: "agent-1", action: "tool.executed" });
    trail.append({ actor: "system", action: "compaction.suggested" });

    // Remove the middle entry — breaks the chain
    const entries = trail.all() as AuditEntry[];
    const spliced = [entries[0]!, entries[2]!];
    trail.load(spliced);

    const result = trail.verify();
    expect(result.valid).toBe(false);
    expect((result as { message: string }).message).toContain("previousHash");
  });

  it("verify() detects genesis entry with non-empty previousHash", () => {
    const trail = new AuditTrail();
    const entries = [
      {
        id: "bad-genesis",
        timestamp: new Date().toISOString(),
        actor: "hacker",
        action: "inject",
        previousHash: "abc123",
        hash: "",
      } as AuditEntry,
    ];
    entries[0]!.hash = computeHash(entries[0]!);
    trail.load(entries);

    const result = trail.verify();
    expect(result.valid).toBe(false);
    expect((result as { message: string }).message).toContain("Genesis");
  });

  it("query() filters by actor", () => {
    const trail = new AuditTrail();
    trail.append({ actor: "user-1", action: "login" });
    trail.append({ actor: "agent-1", action: "tool.executed" });
    trail.append({ actor: "user-1", action: "logout" });

    const userEntries = trail.query({ actor: "user-1" });
    expect(userEntries).toHaveLength(2);
    expect(userEntries.every((e) => e.actor === "user-1")).toBe(true);
  });

  it("query() filters by action", () => {
    const trail = new AuditTrail();
    trail.append({ actor: "user-1", action: "login" });
    trail.append({ actor: "agent-1", action: "tool.executed" });
    trail.append({ actor: "system", action: "compaction.suggested" });

    const toolEntries = trail.query({ action: "tool.executed" });
    expect(toolEntries).toHaveLength(1);
  });

  it("query() supports limit and offset", () => {
    const trail = new AuditTrail();
    for (let i = 0; i < 10; i++) {
      trail.append({ actor: "user-1", action: `action-${i}` });
    }

    const page = trail.query({ limit: 3, offset: 2 });
    expect(page).toHaveLength(3);
    expect(page[0]!.action).toBe("action-2");
    expect(page[2]!.action).toBe("action-4");
  });

  it("load/save roundtrip preserves integrity", () => {
    const trail = new AuditTrail();
    trail.append({ actor: "user-1", action: "login" });
    trail.append({ actor: "agent-1", action: "tool.executed" });

    const saved = trail.all();
    const trail2 = new AuditTrail();
    trail2.load(saved as AuditEntry[]);
    trail2.append({ actor: "system", action: "compaction" });

    expect(trail2.size).toBe(3);
    expect(trail2.verify().valid).toBe(true);
  });

  it("stores resource and details metadata", () => {
    const trail = new AuditTrail();
    const entry = trail.append({
      actor: "agent-1",
      action: "permission.decided",
      resource: "shell.exec",
      details: { riskLevel: "high", exitCode: 0 },
    });

    expect(entry.resource).toBe("shell.exec");
    expect(entry.details?.riskLevel).toBe("high");
    expect(entry.details?.exitCode).toBe(0);
  });

  it("handles concurrent-like append to high count", () => {
    const trail = new AuditTrail();
    for (let i = 0; i < 100; i++) {
      trail.append({ actor: "stress-test", action: `iteration-${i}` });
    }
    expect(trail.size).toBe(100);
    expect(trail.verify().valid).toBe(true);
  });
});

describe("Data retention", () => {
  it("removes entries older than maxAgeDays", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 100);
    const oldTimestamp = oldDate.toISOString();

    const freshDate = new Date();
    const freshTimestamp = freshDate.toISOString();

    const entries: AuditEntry[] = [
      {
        id: "1",
        timestamp: oldTimestamp,
        actor: "user-1",
        action: "login",
        previousHash: "",
        hash: "abc",
      },
      {
        id: "2",
        timestamp: freshTimestamp,
        actor: "agent-1",
        action: "tool.executed",
        previousHash: "abc",
        hash: "def",
      },
    ];

    const { retained, result } = applyRetention(entries, { maxAgeDays: 30 });

    expect(result.deletedCount).toBe(1);
    expect(result.retainedCount).toBe(1);
    expect(retained[0]!.id).toBe("2");
  });

  it("preserves exempt actions regardless of age", () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 400);

    const entries: AuditEntry[] = [
      {
        id: "1",
        timestamp: oldDate.toISOString(),
        actor: "auditor",
        action: "audit.config_changed",
        previousHash: "",
        hash: "abc",
      },
    ];

    const { retained } = applyRetention(entries, {
      maxAgeDays: 90,
      exemptActions: ["audit.config_changed"],
    });

    expect(retained).toHaveLength(1);
  });

  it("returns a deterministic cutoff date in the result", () => {
    const { result } = applyRetention([], { maxAgeDays: 90 });
    expect(result.cutoffDate).toBeTruthy();
  });
});

describe("mergeEntries", () => {
  it("deduplicates by id", () => {
    const a: AuditEntry[] = [
      { id: "1", timestamp: "2025-01-01T00:00:00Z", actor: "u", action: "login", previousHash: "", hash: "a" },
    ];
    const b: AuditEntry[] = [
      { id: "1", timestamp: "2025-01-01T00:00:00Z", actor: "u", action: "login", previousHash: "", hash: "a" },
      { id: "2", timestamp: "2025-01-02T00:00:00Z", actor: "a", action: "tool", previousHash: "a", hash: "b" },
    ];

    const merged = mergeEntries(a, b);
    expect(merged).toHaveLength(2);
  });

  it("sorts by timestamp", () => {
    const a: AuditEntry[] = [
      { id: "2", timestamp: "2025-03-01T00:00:00Z", actor: "u", action: "b", previousHash: "a", hash: "b" },
    ];
    const b: AuditEntry[] = [
      { id: "1", timestamp: "2025-01-01T00:00:00Z", actor: "u", action: "a", previousHash: "", hash: "a" },
    ];

    const merged = mergeEntries(a, b);
    expect(merged[0]!.id).toBe("1");
    expect(merged[1]!.id).toBe("2");
  });
});
