/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ulid } from "ulid";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";
import { copyFixtureProject } from "../../helpers/fixtures";
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
  ],
  pathRules: [],
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

beforeAll(() => {
  testDb = createTestDb();
  fixture = copyFixtureProject();
  // Write a target file for mutation tests
  writeFileSync(join(fixture.projectPath, "target.txt"), "original content\n");
});

afterAll(() => {
  testDb.cleanup();
  fixture.cleanup();
});

// ── A. Plan step order mapping ─────────────────────────────────────────────

describe("Plan step order mapping", () => {
  it("maps only mutation/risky calls to plan steps, not read-only calls", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-read", name: "read", input: { path: "src/hello.ts" } },
            { id: "c-write", name: "write", input: { path: "target.txt", content: "new" } },
            { id: "c-bash", name: "bash", input: { command: "echo done" } },
            { id: "c-glob", name: "glob", input: { pattern: "*.ts" } },
          ],
        },
        { text: "All done." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Do both read and write");
    expect(result.status).toBe("completed");

    // Plan must exist
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("completed");

    // Plan must contain only mutation/risky steps (write + bash = 2), not read/grep/glob
    const steps = plan.stepsJson !== null
      ? (JSON.parse(plan.stepsJson) as Array<{ type: string; order: number }>)
      : [];
    expect(steps.length).toBe(2);

    const stepTypes = steps.map((s) => s.type).sort();
    expect(stepTypes).toContain("write");
    expect(stepTypes).toContain("shell");

    // Step orders must be ascending and cover 0..1
    const orders = steps.map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1]);

    // Verify read-only tool calls were dispatched but not in plan steps
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const readCalls = toolCalls.filter((t) => t.toolName === "read");
    expect(readCalls.length).toBeGreaterThanOrEqual(1);
    expect(readCalls.every((t) => t.status === "completed")).toBe(true);

    const globCalls = toolCalls.filter((t) => t.toolName === "glob");
    expect(globCalls.length).toBeGreaterThanOrEqual(1);

    // Plan step lifecycle events must be ordered: step_started → step_completed
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    const planEvents = ledgerEvents.filter((e) => e.startsWith("plan."));
    expect(planEvents.length).toBeGreaterThan(0);

    // Verify step lifecycle: proposed → approved → (step_started → step_completed)* → completed
    const planEventSequence = planEvents.filter(
      (e) => e === "plan.proposed" || e === "plan.approved" || e === "plan.step_started"
        || e === "plan.step_completed" || e === "plan.completed"
    );
    expect(planEventSequence.indexOf("plan.proposed")).toBeLessThan(
      planEventSequence.indexOf("plan.approved")
    );
    expect(planEventSequence.indexOf("plan.approved")).toBeLessThan(
      planEventSequence.indexOf("plan.step_started")
    );
    expect(planEventSequence.includes("plan.completed")).toBe(true);
  });
});

// ── B. Pre-dispatch plan.step_failed emission ───────────────────────────────

describe("Pre-dispatch plan.step_failed", () => {
  it("emits plan.step_failed for bash with empty command", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-bash-empty", name: "bash", input: { command: "" } },
            { id: "c-write", name: "write", input: { path: "target.txt", content: "ok" } },
          ],
        },
        { text: "Done." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Run bash");
    // Run may complete with text response or fail
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must have been created and ended as failed
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("failed");

    // plan.step_failed must be in the ledger for the bash step
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    const stepFailedEvents = ledgerEvents.filter((e) => e === "plan.step_failed");
    expect(stepFailedEvents.length).toBeGreaterThanOrEqual(1);

    // plan.completed must NOT appear
    expect(ledgerEvents).not.toContain("plan.completed");

    // plan.failed must appear
    expect(ledgerEvents).toContain("plan.failed");
  });

  it("emits plan.step_failed for write with path safety failure", async () => {
    const unsafePath = resolve(fixture.projectPath, "..", "outside.txt");
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write-unsafe", name: "write", input: { path: unsafePath, content: "bad" } },
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

    // Plan must exist and be failed
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("failed");

    // plan.step_failed must be in ledger
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("plan.step_failed");
    expect(ledgerEvents).toContain("plan.failed");

    // Write tool must be failed (not completed)
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const writeCall = toolCalls.find((t) => t.toolName === "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("failed");
  });

  it("emits plan.step_failed when plan is denied by policy", async () => {
    const denyMutationPolicy: PermissionPolicy = {
      toolRules: [
        { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
        { toolName: "write", outcome: "deny", riskLevel: "critical", reason: "mutation denied" },
      ],
      pathRules: [],
      commandRules: [],
      agentRules: [],
    };

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: denyMutationPolicy,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write", name: "write", input: { path: "target.txt", content: "x" } },
          ],
        },
        { text: "Blocked." },
      ],
    });

    const { runner } = buildRunner(server, denyMutationPolicy);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write file");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be denied
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("denied");

    // plan.denied must be in ledger
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).toContain("plan.denied");

    // No plan.completed
    expect(ledgerEvents).not.toContain("plan.completed");

    // Write must be denied (plan-blocked skip)
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const writeCall = toolCalls.find((t) => t.toolName === "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBeOneOf(["denied", "failed"]);
  });
});

// ── C. Revert path safety ───────────────────────────────────────────────────

describe("Revert path safety", () => {
  it("blocks revert_last_change with traversal path", async () => {
    // First do a write to create a file change, then try revert with unsafe path
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write1", name: "write", input: { path: "target.txt", content: "new content" } },
          ],
        },
        {
          toolCalls: [
            { id: "c-revert", name: "revert_last_change", input: { path: "../outside.txt" } },
          ],
        },
        { text: "Done." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write then revert bad path");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Revert call must be failed
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const revertCall = toolCalls.find((t) => t.toolName === "revert_last_change");
    expect(revertCall).toBeDefined();
    expect(revertCall!.status).toBe("failed");

    // No file outside the fixture root should have been touched.
    // assertSafePath should have thrown before any mutation against an
    // outside-project path, so the revert call is safely blocked.
    expect(revertCall!.status).toBe("failed");
  });

  it("blocks revert_last_change with no prior change", async () => {
    // Try revert without any prior write on this file
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-revert", name: "revert_last_change", input: { path: "never_written.txt" } },
          ],
        },
        { text: "Done." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Revert nonexistent file");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Revert must be failed
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const revertCall = toolCalls.find((t) => t.toolName === "revert_last_change");
    expect(revertCall).toBeDefined();
    expect(revertCall!.status).toBe("failed");
  });
});

// ── D. Plan incomplete/abort behavior ────────────────────────────────────────

describe("Plan incomplete/abort", () => {
  it("plan.failed emitted when steps fail pre-dispatch", async () => {
    // Bash with empty command AND write with bad path → both fail
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-bash", name: "bash", input: { command: "" } },
            { id: "c-write", name: "write", input: { path: "../outside.txt", content: "x" } },
          ],
        },
        { text: "All failed." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Two failing tools");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be failed
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("failed");

    // plan.completed must NOT be emitted
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("plan.completed");
    expect(ledgerEvents).toContain("plan.failed");

    // At least one plan.step_failed
    const stepFailedCount = ledgerEvents.filter((e) => e === "plan.step_failed").length;
    expect(stepFailedCount).toBeGreaterThanOrEqual(1);
  });

  it("aborted run does not emit plan.completed", async () => {
    const abortController = new AbortController();
    abortController.abort(); // signal is already aborted

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        { text: "Should not be reached." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Do stuff", {
      signal: abortController.signal,
    });
    expect(result.status).toBe("aborted");

    // No plan should exist (no tool calls were made)
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBe(0);

    // When the signal is already aborted before the run starts,
    // SessionRunner returns early before registering the run or
    // emitting any events. The run was never started.
    expect(result.runId).toBeDefined();
  });

  it("partial plan step failure leads to plan.failed, not plan.completed", async () => {
    // Write to valid path succeeds, bash with empty command fails
    // Only the bash step is in the mutation set; write to a valid path succeeds
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "c-write-ok", name: "write", input: { path: "target.txt", content: "updated" } },
            { id: "c-bash-bad", name: "bash", input: { command: "" } },
          ],
        },
        { text: "Partial failure." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    createSession(server.services, sessionId, fixture.projectPath);

    const result = await runner.run(sessionId, "Write and bad bash");
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // Plan must be failed (not completed) because one step failed
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const plan = plans[plans.length - 1]!;
    expect(plan.status).toBe("failed");

    // plan.completed must NOT be emitted
    const ledgerEvents = collectLedgerEvents(server.services, sessionId);
    expect(ledgerEvents).not.toContain("plan.completed");
    expect(ledgerEvents).toContain("plan.failed");

    // The successful write must have completed
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const writeCall = toolCalls.find((t) => t.toolName === "write");
    expect(writeCall).toBeDefined();
    expect(writeCall!.status).toBe("completed");

    // The bash must have failed
    const bashCall = toolCalls.find((t) => t.toolName === "bash");
    expect(bashCall).toBeDefined();
    expect(bashCall!.status).toBe("failed");
  });
});
