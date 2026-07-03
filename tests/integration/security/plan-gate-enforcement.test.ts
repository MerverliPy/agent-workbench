/// <reference types="bun" />
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SessionRunner } from "@agent-workbench/core";
import type { PermissionPolicy } from "@agent-workbench/permissions";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import { ulid } from "ulid";
import { copyFixtureProject } from "../../helpers/fixtures";
import type { TestDb } from "../../helpers/test-db";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";

let testDb: TestDb;
let fixture: ReturnType<typeof copyFixtureProject>;

const ALLOW_ALL_WITH_COMMAND_DENY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "write", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "edit", outcome: "allow", riskLevel: "low", reason: "test" },
    {
      toolName: "apply_patch",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
    { toolName: "grep", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "glob", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "bash", outcome: "allow", riskLevel: "low", reason: "test" },
    {
      toolName: "revert_last_change",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
    {
      toolName: "diff_preview",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
  ],
  pathRules: [],
  commandRules: [
    {
      pattern: "rm -rf",
      outcome: "deny",
      riskLevel: "critical",
      reason: "destructive",
    },
    {
      pattern: "sudo rm",
      outcome: "deny",
      riskLevel: "critical",
      reason: "privileged delete",
    },
  ],
  agentRules: [],
};

const ALLOW_ALL_POLICY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "write", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "edit", outcome: "allow", riskLevel: "low", reason: "test" },
    {
      toolName: "apply_patch",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
    { toolName: "grep", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "glob", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "bash", outcome: "allow", riskLevel: "low", reason: "test" },
    {
      toolName: "revert_last_change",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
    {
      toolName: "diff_preview",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
  ],
  pathRules: [],
  commandRules: [],
  agentRules: [],
};

const DENY_WRITE_POLICY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    {
      toolName: "write",
      outcome: "deny",
      riskLevel: "critical",
      reason: "write denied by test",
    },
    {
      toolName: "edit",
      outcome: "deny",
      riskLevel: "critical",
      reason: "write denied by test",
    },
    {
      toolName: "apply_patch",
      outcome: "deny",
      riskLevel: "critical",
      reason: "write denied by test",
    },
    { toolName: "grep", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "glob", outcome: "allow", riskLevel: "low", reason: "test" },
    { toolName: "bash", outcome: "ask", riskLevel: "high", reason: "test" },
    {
      toolName: "revert_last_change",
      outcome: "deny",
      riskLevel: "critical",
      reason: "revert denied by test",
    },
    {
      toolName: "diff_preview",
      outcome: "allow",
      riskLevel: "low",
      reason: "test",
    },
  ],
  pathRules: [],
  commandRules: [],
  agentRules: [],
};

function buildRunner(
  base: ReturnType<typeof createTestServer>,
  permPolicy: PermissionPolicy,
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
  projectPath: string,
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
  sessionId: string,
): string[] {
  return services.ledgerRepository
    .listBySession(sessionId)
    .map((e) => e.eventType);
}

function findToolCall(
  server: ReturnType<typeof createTestServer>,
  sessionId: string,
  toolName: string,
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

// ── A. Plan gating: denied plans block all mutation/risky calls ─────────────

describe("Denied plan blocks execution", () => {
  it("policy-denied plan blocks all mutation calls in the batch", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: DENY_WRITE_POLICY,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "c-write1",
              name: "write",
              input: { path: "target.txt", content: "x" },
            },
            {
              id: "c-write2",
              name: "write",
              input: { path: "other.txt", content: "y" },
            },
          ],
        },
        { text: "Blocked." },
      ],
    });
    const { runner } = buildRunner(server, DENY_WRITE_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write files");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be denied
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("denied");

    // Both write calls must be denied (not completed)
    const allToolCalls = server.toolCallRepository.listBySession(sessionId);
    const writes = allToolCalls.filter((t) => t.toolName === "write");
    expect(writes.length).toBe(2);
    for (const w of writes) {
      expect(w.status).toBe("denied");
    }

    // No file must have been written
    expect(existsSync(join(fixture.projectPath, "other.txt"))).toBe(false);

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("plan.denied");
    expect(ledgerEvents).not.toContain("plan.completed");
  });
});

// ── B. Approved plan does not bypass per-tool permission ────────────────────

describe("Approved plan does not bypass per-tool permission", () => {
  it("denies per-tool write when policy denies write even if plan is allowed", async () => {
    // Write: deny at tool level. Plan: must be denied since evaluatePlan
    // will check each step and find write:deny.
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: DENY_WRITE_POLICY,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "c-write",
              name: "write",
              input: { path: "target.txt", content: "new" },
            },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, DENY_WRITE_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write file");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be denied
    const plans = server.services.planRepository.listBySession(sessionId);
    const plan = plans[plans.length - 1];
    expect(plan).toBeDefined();
    expect(plan?.status).toBe("denied");

    // Target file must be unchanged
    expect(readFileSync(join(fixture.projectPath, "target.txt"), "utf8")).toBe(
      "original content\n",
    );

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("plan.denied");
    expect(ledgerEvents).not.toContain("plan.completed");
  });

  it("plan denied by plan-level evaluation prevents tool dispatch", async () => {
    // Write: tool:allow but path rule denies the target
    const pathDenyPolicy: PermissionPolicy = {
      toolRules: [
        {
          toolName: "read",
          outcome: "allow",
          riskLevel: "low",
          reason: "test",
        },
        {
          toolName: "write",
          outcome: "allow",
          riskLevel: "low",
          reason: "test",
        },
        {
          toolName: "grep",
          outcome: "allow",
          riskLevel: "low",
          reason: "test",
        },
        {
          toolName: "glob",
          outcome: "allow",
          riskLevel: "low",
          reason: "test",
        },
      ],
      pathRules: [
        {
          pattern: "denied/**",
          outcome: "deny",
          riskLevel: "critical",
          reason: "test-deny-zone",
        },
      ],
      commandRules: [],
      agentRules: [],
    };

    const deniedPath = join(fixture.projectPath, "denied", "file.txt");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: pathDenyPolicy,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "c-write",
              name: "write",
              input: { path: "denied/file.txt", content: "bad" },
            },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, pathDenyPolicy);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write denied zone");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be denied (plan-level eval found denied path)
    const plans = server.services.planRepository.listBySession(sessionId);
    const plan = plans[plans.length - 1];
    expect(plan).toBeDefined();
    expect(plan?.status).toBeOneOf(["denied", "failed"]);

    // No file must have been created
    expect(existsSync(deniedPath)).toBe(false);

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("plan.completed");
  });
});

// ── C. Approved plan does not bypass shell hard-deny ────────────────────────

describe("Approved plan does not bypass shell hard-deny", () => {
  it("destructive shell command in plan is denied at plan-level", async () => {
    // Bash: tool:allow, but command rule denies rm -rf
    // Plan evaluation must catch this and deny the plan
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_WITH_COMMAND_DENY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-bash", name: "bash", input: { command: "rm -rf /tmp" } },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_WITH_COMMAND_DENY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Destroy all");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be denied
    const plans = server.services.planRepository.listBySession(sessionId);
    const plan = plans[plans.length - 1];
    expect(plan).toBeDefined();
    expect(plan?.status).toBe("denied");

    // Bash must NOT have executed
    const bashCall = findToolCall(server, sessionId, "bash");
    expect(bashCall).toBeDefined();
    expect(bashCall?.status).toBeOneOf(["denied", "failed"]);

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("plan.denied");
    expect(ledgerEvents).not.toContain("plan.completed");
    expect(ledgerEvents).not.toContain("shell.command_started");
  });

  it("sudo destructive command in plan is denied at plan-level", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_WITH_COMMAND_DENY,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "c-bash",
              name: "bash",
              input: { command: "sudo rm /var/log/auth.log" },
            },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_WITH_COMMAND_DENY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Sudo rm");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    const plans = server.services.planRepository.listBySession(sessionId);
    const plan = plans[plans.length - 1];
    expect(plan).toBeDefined();
    expect(plan?.status).toBe("denied");

    const bashCall = findToolCall(server, sessionId, "bash");
    expect(bashCall).toBeDefined();
    expect(bashCall?.status).toBeOneOf(["denied", "failed"]);

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("shell.command_started");
  });
});

// ── D. Plan agent restriction blocks execution ──────────────────────────────

describe("Agent restriction blocks mutation even with plan", () => {
  it("plan agent cannot write files — blocked by agent availability check", async () => {
    // Plan agent has write:deny in the default agent rules.
    // SessionRunner checks agent availability before dispatching.
    // When running as plan agent, the write call must be denied.
    const planDenyPolicy: PermissionPolicy = {
      toolRules: [
        {
          toolName: "read",
          outcome: "allow",
          riskLevel: "low",
          reason: "test",
        },
        {
          toolName: "write",
          outcome: "ask",
          riskLevel: "high",
          reason: "test",
        },
      ],
      pathRules: [],
      commandRules: [],
      agentRules: [
        {
          agentId: "plan",
          toolName: "write",
          outcome: "deny",
          riskLevel: "high",
          reason: "plan agent denies write",
        },
      ],
    };

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: planDenyPolicy,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "c-write",
              name: "write",
              input: { path: "target.txt", content: "plan wrote" },
            },
          ],
        },
        { text: "Done." },
      ],
    });
    const { runner } = buildRunner(server, planDenyPolicy);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    // Run explicitly as plan agent
    const result = await runner.run(sessionId, "Write as plan agent", {
      agentId: "plan",
    });
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Write must be denied
    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall?.status).toBeOneOf(["denied", "failed"]);

    // File must be unchanged
    expect(readFileSync(join(fixture.projectPath, "target.txt"), "utf8")).toBe(
      "original content\n",
    );

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("plan.completed");
  });
});

// ── E. Safe plan completes only when all gates pass ──────────────────────────

describe("Safe plan completes when all gates pass", () => {
  it("valid approved plan allows safe mutation with all gates passing", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "target.txt" } },
            {
              id: "c-write",
              name: "write",
              input: { path: "target.txt", content: "updated safely\n" },
            },
            { id: "c-bash", name: "bash", input: { command: "echo all ok" } },
          ],
        },
        { text: "All done safely." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Safe multi-step");
    expect(result.status).toBe("completed");

    // Plan must be completed
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("completed");

    // Read must be completed
    const readCall = findToolCall(server, sessionId, "read");
    expect(readCall).toBeDefined();
    expect(readCall?.status).toBe("completed");

    // Write must be completed
    const writeCall = findToolCall(server, sessionId, "write");
    expect(writeCall).toBeDefined();
    expect(writeCall?.status).toBe("completed");

    // Bash must be completed
    const bashCall = findToolCall(server, sessionId, "bash");
    expect(bashCall).toBeDefined();
    expect(bashCall?.status).toBe("completed");

    // File must be updated
    expect(readFileSync(join(fixture.projectPath, "target.txt"), "utf8")).toBe(
      "updated safely\n",
    );

    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("plan.proposed");
    expect(ledgerEvents).toContain("plan.approved");
    expect(ledgerEvents).toContain("plan.completed");
  });

  it("safe read-only run succeeds without plan", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "target.txt" } },
            { id: "c-glob", name: "glob", input: { pattern: "*.ts" } },
          ],
        },
        { text: "Read-only done." },
      ],
    });
    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Read only");
    expect(result.status).toBe("completed");

    // No plan needed for read-only
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBe(0);
  });
});
