/**
 * Tests for CLI CI/CD commands: review, changelog, pr-describe.
 *
 * Unit tests for parsing and formatting logic.
 */

import { describe, expect, it } from "bun:test";
import { parseCommits as clParseCommits, groupCommits } from "./changelog";
import { parseCommits as prdParseCommits } from "./pr-describe";
import { parseChangedFiles } from "./review";

// ── Changelog parsing tests ────────────────────────────────────────────────

describe("CLI — changelog", () => {
  it("should parse conventional commit subjects", () => {
    const raw = [
      "abc1234",
      "feat(core): add widget support",
      "",
      "---",
      "def5678",
      "fix!: breaking API change",
      "This is a breaking change.",
    ].join("\n");

    const commits = clParseCommits(raw);
    expect(commits).toHaveLength(2);

    const feat = commits[0]!;
    expect(feat.hash).toBe("abc1234");
    expect(feat.type).toBe("feat");
    expect(feat.scope).toBe("core");
    expect(feat.description).toBe("add widget support");
    expect(feat.breaking).toBe(false);

    const fix = commits[1]!;
    expect(fix.hash).toBe("def5678");
    expect(fix.type).toBe("fix");
    expect(fix.breaking).toBe(true);
    expect(fix.description).toBe("breaking API change");
    expect(fix.body).toContain("breaking change");
  });

  it("should handle non-conventional commit subjects", () => {
    const raw = "xyz789\nSome random commit message\n";
    const commits = clParseCommits(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0]!.type).toBe("other");
    expect(commits[0]!.description).toBe("Some random commit message");
  });

  it("should group commits by conventional type", () => {
    const commits = [
      { hash: "a", type: "feat", scope: null, breaking: false, description: "feat 1", body: "" },
      { hash: "b", type: "fix", scope: null, breaking: false, description: "fix 1", body: "" },
      { hash: "c", type: "feat", scope: null, breaking: false, description: "feat 2", body: "" },
      { hash: "d", type: "docs", scope: null, breaking: false, description: "docs 1", body: "" },
    ] as Parameters<typeof groupCommits>[0];

    const groups = groupCommits(commits);
    expect(groups).toHaveLength(3);
    expect(groups[0]!.title).toContain("Features");
    expect(groups[0]!.commits).toHaveLength(2);
    expect(groups[1]!.title).toContain("Bug Fixes");
    expect(groups[1]!.commits).toHaveLength(1);
    expect(groups[2]!.title).toContain("Documentation");
    expect(groups[2]!.commits).toHaveLength(1);
  });
});

// ── PR describe parsing tests ──────────────────────────────────────────────

describe("CLI — pr-describe", () => {
  it("should parse commit blocks with author and date", () => {
    const raw = [
      "abc1234",
      "Jane Doe",
      "2026-07-07T12:00:00Z",
      "feat(api): add new endpoint",
      "Implementation details",
    ].join("\n");

    const commits = prdParseCommits(raw);
    expect(commits).toHaveLength(1);
    expect(commits[0]!.hash).toBe("abc1234");
    expect(commits[0]!.author).toBe("Jane Doe");
    expect(commits[0]!.type).toBe("feat");
    expect(commits[0]!.scope).toBe("api");
    expect(commits[0]!.description).toBe("add new endpoint");
  });
});

// ── Review command diff parsing tests ──────────────────────────────────────

describe("CLI — review", () => {
  it("should parse changed files from a raw diff", () => {
    const diff = [
      "diff --git a/packages/core/src/index.ts b/packages/core/src/index.ts",
      "index abc..def 100644",
      "--- a/packages/core/src/index.ts",
      "+++ b/packages/core/src/index.ts",
      "@@ -1,5 +1,8 @@",
      " import { foo } from './foo';",
      " import { bar } from './bar';",
      "+import { baz } from './baz';",
      " ",
      " export function greet() {",
      "+  console.log('hello');",
      "+  return true;",
      " }",
    ].join("\n");

    const files = parseChangedFiles(diff);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("packages/core/src/index.ts");
    expect(files[0]!.status).toBe("modified");
    expect(files[0]!.additions).toBe(3);
    expect(files[0]!.deletions).toBe(0);
  });

  it("should detect added files", () => {
    const diff = [
      "diff --git a/new-file.ts b/new-file.ts",
      "new file mode 100644",
      "index 000..abc 100644",
      "--- /dev/null",
      "+++ b/new-file.ts",
      "@@ -0,0 +1,3 @@",
      "+const x = 1;",
      "+const y = 2;",
      "+export { x, y };",
    ].join("\n");

    const files = parseChangedFiles(diff);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe("new-file.ts");
    expect(files[0]!.status).toBe("added");
  });

  it("should handle multiple files in a diff", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1 +1,2 @@",
      " a",
      "+b",
      "diff --git a/b.ts b/b.ts",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1 +1,2 @@",
      " x",
      "+y",
    ].join("\n");

    const files = parseChangedFiles(diff);
    expect(files).toHaveLength(2);
    expect(files[0]!.path).toBe("a.ts");
    expect(files[1]!.path).toBe("b.ts");
  });

  it("should return empty array for empty diff", () => {
    expect(parseChangedFiles("")).toHaveLength(0);
    expect(parseChangedFiles("no diff content here")).toHaveLength(0);
  });
});
