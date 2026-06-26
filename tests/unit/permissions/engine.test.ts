/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { PermissionEngine, defaultPolicy } from "@agent-workbench/permissions";
import type { PermissionPolicy, PermissionEvalInput } from "@agent-workbench/permissions";

function engine(policy?: PermissionPolicy): PermissionEngine {
  return new PermissionEngine(policy);
}

describe("PermissionEngine", () => {
  describe("read-only tools", () => {
    it("allows read", () => {
      const result = engine().evaluate({ toolName: "read" });
      expect(result.outcome).toBe("allow");
      expect(result.riskLevel).toBe("low");
    });

    it("allows grep", () => {
      const result = engine().evaluate({ toolName: "grep" });
      expect(result.outcome).toBe("allow");
    });

    it("allows glob", () => {
      const result = engine().evaluate({ toolName: "glob" });
      expect(result.outcome).toBe("allow");
    });
  });

  describe("mutation tools (default policy)", () => {
    it("asks for write", () => {
      const result = engine().evaluate({ toolName: "write" });
      expect(result.outcome).toBe("ask");
      expect(result.riskLevel).toBe("high");
    });

    it("asks for edit", () => {
      const result = engine().evaluate({ toolName: "edit" });
      expect(result.outcome).toBe("ask");
    });

    it("asks for apply_patch", () => {
      const result = engine().evaluate({ toolName: "apply_patch" });
      expect(result.outcome).toBe("ask");
    });

    it("asks for revert_last_change", () => {
      const result = engine().evaluate({ toolName: "revert_last_change" });
      expect(result.outcome).toBe("ask");
    });
  });

  describe("bash/shell tool", () => {
    it("asks for bash by default", () => {
      const result = engine().evaluate({ toolName: "bash" });
      expect(result.outcome).toBe("ask");
      expect(result.riskLevel).toBe("high");
    });
  });

  describe("destructive command rules", () => {
    it("denies rm -rf", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "rm -rf /tmp/test",
      });
      expect(result.outcome).toBe("deny");
      expect(result.riskLevel).toBe("critical");
    });

    it("denies rm -fr (case-insensitive)", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "RM -FR /tmp/test",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies sudo rm", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "sudo rm /etc/hosts",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies chmod -r (recursive permission change)", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "chmod -r 777 /var/www",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies chown -r (recursive ownership change)", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "chown -r root:root /var/www",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies git push --force", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "git push --force origin main",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies dd", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "dd if=/dev/zero of=/dev/sda",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies truncate", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "truncate --size 0 important.log",
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies shred", () => {
      const result = engine().evaluate({
        toolName: "bash",
        command: "shred -f secret.txt",
      });
      expect(result.outcome).toBe("deny");
    });
  });

  describe("sensitive path rules", () => {
    it("denies .env access", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: [".env"],
      });
      expect(result.outcome).toBe("deny");
      expect(result.riskLevel).toBe("critical");
    });

    it("denies .env.local access", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: [".env.local"],
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies .git/ internal mutation", () => {
      const result = engine().evaluate({
        toolName: "write",
        targetPaths: [".git/config"],
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies .ssh/ access", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: [".ssh/id_rsa"],
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies *.pem files", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: ["certs/server.pem"],
      });
      expect(result.outcome).toBe("deny");
    });

    it("denies *.key files", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: ["ssh/host.key"],
      });
      expect(result.outcome).toBe("deny");
    });

    it("allows normal source files", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: ["src/index.ts"],
      });
      expect(result.outcome).toBe("allow");
    });
  });

  describe("agent-level rules", () => {
    it("plan agent denies write", () => {
      const result = engine().evaluate({
        toolName: "write",
        agentId: "plan",
      });
      expect(result.outcome).toBe("deny");
      expect(result.reason).toContain("planning-first");
    });

    it("plan agent denies edit", () => {
      const result = engine().evaluate({
        toolName: "edit",
        agentId: "plan",
      });
      expect(result.outcome).toBe("deny");
    });

    it("plan agent denies apply_patch", () => {
      const result = engine().evaluate({
        toolName: "apply_patch",
        agentId: "plan",
      });
      expect(result.outcome).toBe("deny");
    });

    it("plan agent denies revert_last_change", () => {
      const result = engine().evaluate({
        toolName: "revert_last_change",
        agentId: "plan",
      });
      expect(result.outcome).toBe("deny");
    });

    it("plan agent allows read", () => {
      const result = engine().evaluate({
        toolName: "read",
        agentId: "plan",
      });
      expect(result.outcome).toBe("allow");
    });

    it("plan agent asks for bash", () => {
      const result = engine().evaluate({
        toolName: "bash",
        agentId: "plan",
      });
      expect(result.outcome).toBe("ask");
    });

    it("build agent asks for write (normal posture)", () => {
      const result = engine().evaluate({
        toolName: "write",
        agentId: "build",
      });
      expect(result.outcome).toBe("ask");
    });
  });

  describe("unknown tool fallback", () => {
    it("asks for unknown tools", () => {
      const result = engine().evaluate({ toolName: "unknown_tool" });
      expect(result.outcome).toBe("ask");
      expect(result.riskLevel).toBe("high");
    });
  });

  describe("precedence: command > agent > path > tool", () => {
    it("command hard-deny wins over agent allow", () => {
      const result = engine().evaluate({
        toolName: "bash",
        agentId: "build",
        command: "rm -rf /tmp",
      });
      expect(result.outcome).toBe("deny");
    });

    it("agent rule wins over tool rule", () => {
      const result = engine().evaluate({
        toolName: "write",
        agentId: "plan",
      });
      expect(result.outcome).toBe("deny");
    });

    it("path deny wins over tool allow", () => {
      const result = engine().evaluate({
        toolName: "read",
        targetPaths: [".env"],
      });
      expect(result.outcome).toBe("deny");
    });
  });

  describe("evaluatePlan", () => {
    it("returns allow for empty steps", () => {
      const result = engine().evaluatePlan([]);
      expect(result.outcome).toBe("allow");
    });

    it("returns most restrictive outcome across steps", () => {
      const result = engine().evaluatePlan([
        { type: "read", order: 1, description: "Read file", isRisky: false },
        { type: "write", order: 2, description: "Write file", isRisky: true, riskLevel: "high" },
      ] as import("@agent-workbench/protocol").PlanStep[]);
      expect(result.outcome).toBe("ask");
    });

    it("breaks early on deny", () => {
      const result = engine().evaluatePlan(
        [
          {
            type: "shell",
            order: 1,
            description: "Run command",
            command: "rm -rf /tmp",
            isRisky: true,
            riskLevel: "critical",
          },
        ] as import("@agent-workbench/protocol").PlanStep[],
        "build"
      );
      expect(result.outcome).toBe("deny");
    });
  });
});
