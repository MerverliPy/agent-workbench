/// <reference types="bun" />
import { describe, it, expect } from "bun:test";
import { previewCommand } from "@agent-workbench/shell";

describe("previewCommand", () => {
  it("classifies echo as low risk", () => {
    const result = previewCommand("echo hello", "/tmp");
    expect(result.riskLevel).toBe("low");
    expect(result.baseBinary).toBe("echo");
    expect(result.requiresApproval).toBe(false);
    expect(result.normalized).toBe("echo hello");
  });

  it("classifies ls as medium risk", () => {
    const result = previewCommand("ls -la", "/tmp");
    expect(result.riskLevel).toBe("medium");
    expect(result.baseBinary).toBe("ls");
    expect(result.requiresApproval).toBe(true);
  });

  it("classifies unknown commands as high risk", () => {
    const result = previewCommand("some_unknown_tool --flag", "/tmp");
    expect(result.riskLevel).toBe("high");
    expect(result.requiresApproval).toBe(true);
  });

  it("classifies rm -rf as critical (destructive)", () => {
    const result = previewCommand("rm -rf /tmp/test", "/tmp");
    expect(result.riskLevel).toBe("critical");
    expect(result.matchedRules).toContain("rm -rf");
  });

  it("classifies sudo rm as critical", () => {
    const result = previewCommand("sudo rm /etc/hosts", "/tmp");
    expect(result.riskLevel).toBe("critical");
    expect(result.matchedRules).toContain("sudo rm");
  });

  it("classifies git push --force as critical", () => {
    const result = previewCommand("git push --force origin main", "/tmp");
    expect(result.riskLevel).toBe("critical");
    expect(result.matchedRules).toContain("git push --force");
  });

  it("handles quoted arguments", () => {
    const result = previewCommand("echo 'hello world'", "/tmp");
    expect(result.riskLevel).toBe("low");
    expect(result.normalized).toBe("echo hello world");
  });

  it("extracts base binary from path", () => {
    const result = previewCommand("/usr/bin/echo hello", "/tmp");
    expect(result.baseBinary).toBe("echo");
  });

  it("strips environment variable prefixes", () => {
    const result = previewCommand("FOO=bar echo hello", "/tmp");
    expect(result.baseBinary).toBe("echo");
  });

  it("normalizes multiple spaces", () => {
    const result = previewCommand("echo  hello   world", "/tmp");
    expect(result.normalized).toBe("echo hello world");
  });
});
