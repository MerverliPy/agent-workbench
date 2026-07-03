/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

function findTestFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (
      entry.isDirectory() &&
      !entry.name.startsWith(".") &&
      entry.name !== "node_modules"
    ) {
      results.push(...findTestFiles(fullPath));
    } else if (
      entry.isFile() &&
      extname(entry.name) === ".ts" &&
      !entry.name.endsWith(".d.ts")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("Server public import boundary", () => {
  it("no test file imports the runtime server entrypoint", () => {
    const testsDir = resolve(import.meta.dirname, "..");
    const testFiles = findTestFiles(testsDir);
    expect(testFiles.length).toBeGreaterThan(0);

    // This test file contains the literal string "@agent-workbench/server"
    // in its own match logic. Exclude self from the scan.
    const selfPath = resolve(import.meta.filename);

    const violations: Array<{ file: string; line: string }> = [];

    for (const file of testFiles) {
      if (file === selfPath) continue;
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (
          (line.includes('"@agent-workbench/server"') ||
            line.includes("'@agent-workbench/server'")) &&
          !line.includes("/public")
        ) {
          violations.push({ file, line: line.trim() });
        }
      }
    }

    if (violations.length > 0) {
      const msg = violations.map((v) => `  ${v.file}: ${v.line}`).join("\n");
      throw new Error(
        `Test files import @agent-workbench/server without /public:\n${msg}`,
      );
    }
  });

  it("at least one test file imports @agent-workbench/server/public", () => {
    const testsDir = resolve(import.meta.dirname, "..");
    const testFiles = findTestFiles(testsDir);

    let found = false;
    for (const file of testFiles) {
      const content = readFileSync(file, "utf8");
      if (content.includes("@agent-workbench/server/public")) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
