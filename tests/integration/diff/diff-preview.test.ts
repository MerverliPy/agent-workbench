/// <reference types="bun" />
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateDiffPreview } from "@agent-workbench/diff";
import type { DiffParams } from "@agent-workbench/diff";

let projectDir: string;
let filePath: string;

beforeAll(() => {
  projectDir = mkdtempSync(join(tmpdir(), "agent-wb-diff-"));
  filePath = join(projectDir, "test.txt");
});

afterAll(() => {
  try { rmSync(projectDir, { recursive: true, force: true }); } catch {}
});

describe("generateDiffPreview", () => {
  it("generates a write preview without mutating files", () => {
    writeFileSync(filePath, "original content\n");

    const beforeContent = readFileSync(filePath, "utf8");
    const params: DiffParams = {
      type: "write",
      path: filePath,
      content: "new content\n",
    };

    return generateDiffPreview(params, projectDir).then((preview) => {
      expect(preview.id).toBeDefined();
      expect(preview.path).toContain("test.txt");
      // File should NOT be modified
      const afterContent = readFileSync(filePath, "utf8");
      expect(afterContent).toBe(beforeContent);
    });
  });

  it("generates an edit preview without mutating files", () => {
    writeFileSync(filePath, "Hello World\n");

    const beforeContent = readFileSync(filePath, "utf8");
    const params: DiffParams = {
      type: "edit",
      path: filePath,
      oldString: "World",
      newString: "Bun",
    };

    return generateDiffPreview(params, projectDir).then((preview) => {
      expect(preview.id).toBeDefined();
      expect(preview.linesAdded).toBeGreaterThanOrEqual(0);
      // File should NOT be modified
      const afterContent = readFileSync(filePath, "utf8");
      expect(afterContent).toBe(beforeContent);
    });
  });

  it("generates an apply_patch preview without mutating files", () => {
    writeFileSync(filePath, "original\n");

    const beforeContent = readFileSync(filePath, "utf8");
    const params: DiffParams = {
      type: "apply_patch",
      path: filePath,
      patch: "--- test.txt\n+++ test.txt\n@@ -1,1 +1,1 @@\n-original\n+patched\n",
    };

    return generateDiffPreview(params, projectDir).then((preview) => {
      expect(preview.id).toBeDefined();
      expect(preview.patch).toBeDefined();
      // File should NOT be modified
      const afterContent = readFileSync(filePath, "utf8");
      expect(afterContent).toBe(beforeContent);
    });
  });
});
