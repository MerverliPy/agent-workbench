/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { ulid } from "ulid";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";
import { copyFixtureProject, createSymlinkEscapeFixture } from "../../helpers/fixtures";
import type { SymlinkEscapeFixture } from "../../helpers/fixtures";
import { SessionRunner } from "@agent-workbench/core";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import type { PermissionPolicy } from "@agent-workbench/permissions";
import type { TestDb } from "../../helpers/test-db";

let testDb: TestDb;
let fixture: ReturnType<typeof copyFixtureProject>;

const ALLOW_ALL_POLICY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "write", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "edit", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "apply_patch", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "grep", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "glob", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "bash", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "revert_last_change", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "diff_preview", outcome: "allow", riskLevel: "low", reason: "test" },
  ],
  pathRules: [],
  commandRules: [],
  agentRules: [],
};

const GIT_DENY_POLICY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "write", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "edit", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "apply_patch", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "grep", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "glob", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "bash", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "revert_last_change", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "diff_preview", outcome: "allow", riskLevel: "low", reason: "test" },
  ],
  pathRules: [
    { pattern: ".git/**", outcome: "deny", riskLevel: "critical", reason: "test-git-deny" },
  ],
  commandRules: [],
  agentRules: [],
};

function buildRunner(
  base: ReturnType<typeof createTestServer>,
  permPolicy: PermissionPolicy
): { runner: SessionRunner; gate: PermissionGate } {
  const engine = new PermissionEngine(permPolicy);
  const gate = new PermissionGate();

  const s = base.services;
  const runner = new SessionRunner({
    sessionRepository: s.sessionRepository,
    messageRepository: s.messageRepository,
    toolCallRepository: base.toolCallRepository,
    ledgerRepository: s.ledgerRepository,
    permissionRepository: s.permissionRepository,
    summaryRepository: s.summaryRepository,
    planRepository: s.planRepository,
    fileChangeRepository: base.fileChangeRepository,
    eventBus: base.eventBus,
    toolRegistry: base.toolRegistry,
    modelProvider: base.modelProvider,
    permissionEngine: engine,
    permissionGate: gate,
    shellRunner: base.shellRunner,
    agentRegistry: base.agentRegistry,
    tokenHealthService: base.tokenHealthService,
  });
  return { runner, gate };
}

function createSession(
  services: ReturnType<typeof createTestServer>["services"],
  sessionId: string,
  projectPath: string
): void {
  services.sessionRepository.create({
    id: sessionId,
    projectPath,
    title: null,
    activeAgent: null,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRunAt: null,
    metadataJson: null,
  });
}

function collectLedgerEvents(
  services: ReturnType<typeof createTestServer>["services"],
  sessionId: string
): string[] {
  return services.ledgerRepository
    .listBySession(sessionId)
    .map((e) => e.eventType);
}

function findToolCall(
  server: ReturnType<typeof createTestServer>,
  sessionId: string,
  toolName: string
) {
  return server.toolCallRepository
    .listBySession(sessionId)
    .find((t) => t.toolName === toolName);
}

beforeAll(() => {
  testDb = createTestDb();
  fixture = copyFixtureProject();
  writeFileSync(join(fixture.projectPath, "target.txt"), "original content\n");
});

afterAll(() => {
  testDb.cleanup();
  fixture.cleanup();
});

// ── A. Path traversal rejection ─────────────────────────────────────────────

describe("Path traversal rejection", () => {
  it("rejects ../ traversal in write tool", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "../outside.txt", content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write outside");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");

    const outsidePath = resolve(fixture.projectPath, "..", "outside.txt");
    expect(existsSync(outsidePath)).toBe(false);

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });

  it("rejects ../../ nested traversal in write tool", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "../../etc/evil.txt", content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write outside");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });

  it("rejects absolute path attempt in write tool", async () => {
    const absPath = resolve(fixture.projectPath, "..", "..", "tmp", "evil.txt");
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: absPath, content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write absolute");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");

    expect(existsSync(absPath)).toBe(false);

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });

  it("rejects mixed traversal src/../../outside.txt", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "src/../../outside.txt", content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write outside");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });

  it("rejects ../ traversal in read tool", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "../etc/passwd" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read outside");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("failed");

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });

  it("resolves safe src/../src/ok.txt as in-root path and succeeds", async () => {
    const safePath = join(fixture.projectPath, "src", "ok.txt");
    writeFileSync(safePath, "safe content\n");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "src/../src/ok.txt" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read self-ref");
    expect(result.status).toBe("completed");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("completed");

    expect(existsSync(safePath)).toBe(true);
    expect(readFileSync(safePath, "utf8")).toBe("safe content\n");
  });
});

// ── B. Encoded-looking traversal ─────────────────────────────────────────────

describe("Encoded-looking traversal", () => {
  it("treats URL-encoded traversal as literal in-root filename (no escape)", async () => {
    // "%2e%2e%2f" is the URL-encoded form of "../"
    const encodedPath = "%2e%2e%2fetc%2fpasswd";
    const outsidePath = resolve(fixture.projectPath, "..", "etc", "passwd");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: encodedPath, content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write encoded");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // No file should be created outside the fixture root
    expect(existsSync(outsidePath)).toBe(false);

    // The tool may fail or succeed — but must not write outside.
    // If it succeeded, the file must be inside the fixture root.
    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    if (writeCall!.status === "completed") {
      // Must be inside fixture root (as a literal filename)
      const literalInside = join(fixture.projectPath, encodedPath);
      expect(existsSync(literalInside)).toBe(true);
      // Safe literal write — plan may complete
    } else {
      // If rejected, must be recorded as failed/denied
      expect(writeCall!.status).toBeOneOf(["failed", "denied"]);
    }

    // Ledger must reflect the outcome
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    if (writeCall!.status === "completed") {
      expect(ledgerEvents).toContain("plan.completed");
    } else {
      expect(ledgerEvents).toContain("tool.failed");
      expect(ledgerEvents).not.toContain("plan.completed");
    }
  });

  it("treats double-encoded traversal as literal in-root filename (no escape)", async () => {
    const encodedPath = "%252e%252e%252fetc%252fpasswd";
    const outsidePath = resolve(fixture.projectPath, "..", "etc", "passwd");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: encodedPath, content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write dbl-enc");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // No file should be created outside the fixture root
    expect(existsSync(outsidePath)).toBe(false);

    // The tool may fail or succeed — but must not write outside.
    // If it succeeded, the file must be inside the fixture root.
    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    if (writeCall!.status === "completed") {
      const literalInside = join(fixture.projectPath, encodedPath);
      expect(existsSync(literalInside)).toBe(true);
    } else {
      expect(writeCall!.status).toBeOneOf(["failed", "denied"]);
    }

    // Ledger must reflect the outcome
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    if (writeCall!.status === "completed") {
      expect(ledgerEvents).toContain("plan.completed");
    } else {
      expect(ledgerEvents).toContain("tool.failed");
      expect(ledgerEvents).not.toContain("plan.completed");
    }
  });
});

// ── C. Sensitive path denial ─────────────────────────────────────────────────

describe("Sensitive path denial", () => {
  it("rejects .env file write", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: ".env", content: "SECRET=leaked" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write .env");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });

  it("rejects .env.production file write", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: ".env.production", content: "SECRET=leaked" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write .env.production");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");
  });

  it("rejects *.key file write", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "certs/server.key", content: "PRIVATE KEY" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write .key");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");
  });

  it("rejects *.pem file write", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "ssl/cert.pem", content: "CERT" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write .pem");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");
  });

  it("rejects .git/config mutation via policy path rules", async () => {
    // .git/config is not blocked by path-guard, but should be blocked
    // by policy-level path rules (.git/** deny)
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: GIT_DENY_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: ".git/config", content: "[core]" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, GIT_DENY_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write git config");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const plans = server.services.planRepository.listBySession(sessionId);
    const plan = plans[plans.length - 1];
    // Plan may be denied by plan-level eval or per-tool permission
    if (plan !== undefined) {
      expect(plan.status).toBeOneOf(["denied", "failed"]);
    }

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("plan.completed");
  });

  it("rejects .ssh/ path via path-guard segment check", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: ".ssh/id_rsa" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read .ssh");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("failed");

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("tool.failed");
  });
});

// ── D. Sensitive path: plan does not bypass ──────────────────────────────────

describe("Sensitive path: plan does not bypass", () => {
  it("rejects .env write even after plan approval flow", async () => {
    // Even though the model requests a write, the path-guard rejects .env
    // before the diff preview can be generated, regardless of plan state.
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: ".env", content: "X" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write .env");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // The .env file must NOT have been written
    const envPath = join(fixture.projectPath, ".env");
    expect(existsSync(envPath)).toBe(false);

    // Plan must NOT be completed
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("plan.completed");

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");
  });
});

// ── E. Safe negative controls ─────────────────────────────────────────────────

describe("Safe negative controls", () => {
  it("allows safe in-fixture write with allowed policy", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "target.txt", content: "new content\n" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write safe");
    expect(result.status).toBe("completed");

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("completed");

    const content = readFileSync(join(fixture.projectPath, "target.txt"), "utf8");
    expect(content).toBe("new content\n");
  });

  it("allows safe in-fixture read with allowed policy", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "target.txt" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read safe");
    expect(result.status).toBe("completed");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("completed");
  });

  it("allows env.example — not matched by sensitive path rules", async () => {
    const safeEnvPath = join(fixture.projectPath, "env.example");
    writeFileSync(safeEnvPath, "EXAMPLE_KEY=value\n");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "env.example" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read env.example");
    expect(result.status).toBe("completed");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("completed");

    expect(readFileSync(safeEnvPath, "utf8")).toBe("EXAMPLE_KEY=value\n");
  });

  it("allows certs/server.crt — not .key or .pem", async () => {
    const crtDir = join(fixture.projectPath, "certs");
    mkdirSync(crtDir, { recursive: true });
    const crtPath = join(crtDir, "server.crt");
    writeFileSync(crtPath, "CERTIFICATE\n");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "certs/server.crt" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read crt");
    expect(result.status).toBe("completed");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("completed");
  });

  it("allows docs/env-template.txt — safe read", async () => {
    const docsDir = join(fixture.projectPath, "docs");
    mkdirSync(docsDir, { recursive: true });
    const tmplPath = join(docsDir, "env-template.txt");
    writeFileSync(tmplPath, "KEY=value\n");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "docs/env-template.txt" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read template");
    expect(result.status).toBe("completed");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("completed");
  });

  it("allows config/env.sample — not sensitive", async () => {
    const configDir = join(fixture.projectPath, "config");
    mkdirSync(configDir, { recursive: true });
    const samplePath = join(configDir, "env.sample");
    writeFileSync(samplePath, "SAMPLE=1\n");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "config/env.sample" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read sample");
    expect(result.status).toBe("completed");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("completed");
  });
});

// ── F. Symlink escape ─────────────────────────────────────────────────────────

describe("Symlink escape", () => {
  let symFix: ReturnType<typeof createSymlinkEscapeFixture> | undefined;

  beforeAll(() => {
    try {
      symFix = createSymlinkEscapeFixture();
    } catch {
      symFix = undefined;
    }
  });

  afterAll(() => {
    if (symFix !== undefined) symFix.cleanup();
  });

  it("rejects write through symlink pointing outside fixture root", async () => {
    if (symFix === undefined || !symFix.symlinked) {
      return; // skip — symlinks unsupported
    }

    const testDb2 = createTestDb();

    const server = createTestServer({
      storage: testDb2.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "escape-link", content: "evil" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, symFix!.projectPath);

    const result = await runner.run(sessionId, "Write through symlink");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // The symlink target must remain unchanged
    expect(readFileSync(symFix!.externalTarget, "utf8")).toBe("DO NOT TOUCH\n");

    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    // Symlink resolution in assertSafePath should reject the escape
    expect(writeCall!.status).toBe("failed");

    testDb2.cleanup();
  });

  it("rejects read through symlink pointing outside fixture root", async () => {
    if (symFix === undefined || !symFix.symlinked) {
      return;
    }

    const testDb2 = createTestDb();

    const server = createTestServer({
      storage: testDb2.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "escape-link" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, symFix!.projectPath);

    const result = await runner.run(sessionId, "Read through symlink");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // External target must remain unchanged
    expect(readFileSync(symFix!.externalTarget, "utf8")).toBe("DO NOT TOUCH\n");

    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall!.status).toBe("failed");

    testDb2.cleanup();
  });
});
