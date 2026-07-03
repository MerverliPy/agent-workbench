/// <reference types="bun" />
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionRunner } from "@agent-workbench/core";
import type { PermissionPolicy } from "@agent-workbench/permissions";
import { PermissionEngine, PermissionGate } from "@agent-workbench/permissions";
import { ulid } from "ulid";
import type { TestDb } from "../../helpers/test-db";
import { createTestDb } from "../../helpers/test-db";
import { createTestServer } from "../../helpers/test-server";

let testDb: TestDb;
let projectDir: string;

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
  ],
  pathRules: [],
  commandRules: [],
  agentRules: [],
};

const DENY_MUTATION_POLICY: PermissionPolicy = {
  toolRules: [
    { toolName: "read", outcome: "allow", riskLevel: "low", reason: "test" },
    {
      toolName: "write",
      outcome: "deny",
      riskLevel: "critical",
      reason: "mutation denied by test policy",
    },
    {
      toolName: "edit",
      outcome: "deny",
      riskLevel: "critical",
      reason: "mutation denied by test policy",
    },
    {
      toolName: "apply_patch",
      outcome: "deny",
      riskLevel: "critical",
      reason: "mutation denied by test policy",
    },
    {
      toolName: "revert_last_change",
      outcome: "deny",
      riskLevel: "critical",
      reason: "mutation denied by test policy",
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

beforeAll(() => {
  testDb = createTestDb();
  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-plan-"));
  writeFileSync(join(projectDir, "target.txt"), "original content\n");
});

afterAll(() => {
  testDb.cleanup();
  try {
    rmSync(projectDir, { recursive: true, force: true });
  } catch {}
});

describe("SessionRunner — plan gate (deny)", () => {
  it("blocks mutation tools when plan is denied by policy", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "call-1",
              name: "write",
              input: { path: "target.txt", content: "new content" },
            },
          ],
        },
        { text: "Done." },
      ],
    });

    const { runner } = buildRunner(server, DENY_MUTATION_POLICY);
    const sessionId = ulid();
    server.services.sessionRepository.create({
      id: sessionId,
      projectPath: projectDir,
      title: null,
      activeAgent: null,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRunAt: null,
      metadataJson: null,
    });

    const result = await runner.run(sessionId, "Write target.txt");

    // Run should complete (text response after blocked mutation)
    expect(result.status).toBeOneOf(["completed", "failed"]);

    // A plan should have been created and denied
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const lastPlan = plans[plans.length - 1];
    expect(lastPlan?.status).toBe("denied");

    // Write tool should be denied (not completed)
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const writeCalls = toolCalls.filter((t) => t.toolName === "write");
    for (const call of writeCalls) {
      expect(call.status).toBeOneOf(["denied", "failed"]);
    }
  });
});

describe("SessionRunner — plan gate (allow)", () => {
  it("allows mutation when plan is approved by permissive policy", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [
        {
          toolCalls: [
            {
              id: "call-1",
              name: "write",
              input: { path: "target.txt", content: "new content" },
            },
          ],
        },
        { text: "File written." },
      ],
    });

    const { runner } = buildRunner(server, ALLOW_ALL_POLICY);
    const sessionId = ulid();
    server.services.sessionRepository.create({
      id: sessionId,
      projectPath: projectDir,
      title: null,
      activeAgent: null,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRunAt: null,
      metadataJson: null,
    });

    const result = await runner.run(sessionId, "Write target.txt");

    expect(result.status).toBe("completed");
    expect(result.assistantMessageId).toBeDefined();

    // Plan should have been approved
    const plans = server.services.planRepository.listBySession(sessionId);
    expect(plans.length).toBeGreaterThanOrEqual(1);
    const lastPlan = plans[plans.length - 1];
    expect(lastPlan?.status).toBeOneOf(["approved", "completed"]);

    // Write tool should be completed
    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const writeCall = toolCalls.find((t) => t.toolName === "write");
    expect(writeCall).toBeDefined();
    expect(writeCall?.status).toBe("completed");
  });
});
