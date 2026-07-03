/// <reference types="bun" />
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionPolicy } from "@agent-workbench/permissions";
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

beforeAll(() => {
  testDb = createTestDb();
  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-fault-tool-"));
});

afterAll(() => {
  testDb.cleanup();
  try {
    rmSync(projectDir, { recursive: true, force: true });
  } catch {}
});

function createSession(
  server: ReturnType<typeof createTestServer>,
  sessionId: string,
): void {
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
}

describe("Tool fault injection — unknown tool", () => {
  it("unknown tool name → tool_call blocked by agent availability, status is denied", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      modelTurns: [
        {
          toolCalls: [
            { id: "call-1", name: "nonexistent_tool", input: { foo: "bar" } },
          ],
        },
        { text: "Done." },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    const result = await server.sessionRunner.run(
      sessionId,
      "call unknown tool",
    );

    expect(result.status).toBe("completed");

    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const unknown = toolCalls.find((t) => t.toolName === "nonexistent_tool");
    expect(unknown).toBeDefined();
    // Unknown tool is denied by agent availability check before dispatch.
    expect(unknown?.status).toBe("denied");

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    expect(ledger.some((e) => e.eventType === "tool.denied")).toBe(true);
  });
});

describe("Tool fault injection — malformed mutation input", () => {
  it("malformed write input (no content) → tool fails at diff preview, target file unchanged", async () => {
    const targetFile = join(projectDir, "safe.ts");
    writeFileSync(targetFile, "export const original = 1;\n");

    const originalContent = readFileSync(targetFile, "utf8");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "call-1", name: "write", input: { path: "safe.ts" } },
          ],
        },
        { text: "Done." },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    await server.sessionRunner.run(sessionId, "write with path but no content");

    // File content must be unchanged.
    const afterContent = readFileSync(targetFile, "utf8");
    expect(afterContent).toBe(originalContent);

    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const writeCall = toolCalls.find((t) => t.toolName === "write");
    expect(writeCall).toBeDefined();
    expect(writeCall?.status).toBe("failed");

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    expect(ledger.some((e) => e.eventType === "tool.failed")).toBe(true);
  });

  it("malformed apply_patch input (missing patch content) → tool fails, file unchanged", async () => {
    const targetFile = join(projectDir, "patch-target.ts");
    writeFileSync(targetFile, "const a = 1;\n");

    const originalContent = readFileSync(targetFile, "utf8");

    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "call-1", name: "apply_patch", input: { path: targetFile } },
          ],
        },
        { text: "Done." },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    await server.sessionRunner.run(sessionId, "patch without content");

    const afterContent = readFileSync(targetFile, "utf8");
    expect(afterContent).toBe(originalContent);

    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const patchCall = toolCalls.find((t) => t.toolName === "apply_patch");
    expect(patchCall).toBeDefined();
    expect(patchCall?.status).toBe("failed");
  });
});

describe("Tool fault injection — malformed bash input", () => {
  it("malformed bash input (missing command) → tool fails, no shell.command_started", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [{ id: "call-1", name: "bash", input: {} }],
        },
        { text: "Done." },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    await server.sessionRunner.run(sessionId, "bash with no command");

    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const bashCall = toolCalls.find((t) => t.toolName === "bash");
    expect(bashCall).toBeDefined();
    expect(bashCall?.status).toBe("failed");

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    expect(ledger.some((e) => e.eventType === "tool.failed")).toBe(true);

    // Must not record shell.command_started for a blocked bash.
    const shellStarted = ledger.filter(
      (e) => e.eventType === "shell.command_started",
    );
    expect(shellStarted.length).toBe(0);
  });

  it("bash empty command string → tool fails", async () => {
    const server = createTestServer({
      storage: testDb.connection,
      permissionPolicy: ALLOW_ALL_POLICY,
      modelTurns: [
        {
          toolCalls: [
            { id: "call-1", name: "bash", input: { command: "   " } },
          ],
        },
        { text: "Done." },
      ],
    });

    const sessionId = ulid();
    createSession(server, sessionId);

    await server.sessionRunner.run(sessionId, "bash whitespace only");

    const toolCalls = server.toolCallRepository.listBySession(sessionId);
    const bashCall = toolCalls.find((t) => t.toolName === "bash");
    expect(bashCall).toBeDefined();
    expect(bashCall?.status).toBe("failed");

    const ledger = server.services.ledgerRepository.listBySession(sessionId);
    const shellStarted = ledger.filter(
      (e) => e.eventType === "shell.command_started",
    );
    expect(shellStarted.length).toBe(0);
  });
});
