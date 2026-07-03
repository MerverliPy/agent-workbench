/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RESTRICTED_PACKAGES = [
  "@agent-workbench/core",
  "@agent-workbench/tools",
  "@agent-workbench/shell",
  "@agent-workbench/storage",
  "@agent-workbench/permissions",
] as const;

const _ALLOWED_PACKAGES = [
  "@agent-workbench/protocol",
  "@agent-workbench/sdk",
  "@agent-workbench/events",
  "@agent-workbench/ui",
];

const TUI_SRC_DIR = resolve(import.meta.dirname, "../../apps/tui/src");

function findTuiSourceFiles(dir: string): string[] {
  const fs = require("node:fs") as typeof import("node:fs");
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTuiSourceFiles(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
    ) {
      results.push(full);
    }
  }
  return results;
}

describe("TUI import boundaries", () => {
  const files = findTuiSourceFiles(TUI_SRC_DIR);

  it("has TUI source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const relativePath = file.replace(resolve(TUI_SRC_DIR, ".."), "");

    it(`does not import restricted packages in ${relativePath}`, () => {
      const content = readFileSync(file, "utf8");
      for (const pkg of RESTRICTED_PACKAGES) {
        const regex = new RegExp(
          `(?:from\\s+["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/|["']))|(?:import\\s*\\(\\s*["']${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*\\))`,
          "g",
        );
        expect(content).not.toMatch(regex);
      }
    });
  }
});
