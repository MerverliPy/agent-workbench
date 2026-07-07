/**
 * Review command — PR review bot.
 *
 * Fetches a GitHub PR diff, runs type-check and lint on changed files,
 * and posts a structured review comment.
 *
 * Usage:
 *   agent-workbench review --pr <number> [--repo owner/repo]
 *   agent-workbench review --diff <diff-file> [--head <branch>]
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// ── Interfaces ─────────────────────────────────────────────────────────────

interface ChangedFile {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
}

interface ReviewResult {
  summary: string;
  fileReports: FileReport[];
  errorCount: number;
  warningCount: number;
}

interface FileReport {
  path: string;
  issues: Issue[];
}

interface Issue {
  severity: "error" | "warning" | "info";
  line?: number;
  message: string;
  source: string;
}

// ── Command handler ────────────────────────────────────────────────────────

export async function handleReview(
  args: string[],
): Promise<number> {
  const prNumber = parseArg(args, "--pr");
  const repo = parseArg(args, "--repo") ?? detectRepo();
  const diffPath = parseArg(args, "--diff");

  if (!prNumber && !diffPath) {
    console.error("Error: --pr <number> or --diff <path> is required");
    console.error("Usage: agent-workbench review --pr <number> [--repo owner/repo]");
    console.error("       agent-workbench review --diff <file>");
    return 1;
  }

  try {
    // Determine base branch for focused checking
    let baseBranch = "main";
    let headBranch = "";
    let diffContent: string;

    if (prNumber) {
      console.error(`🔍 Fetching PR #${prNumber}...`);
      const prInfo = execSync(
        `gh pr view ${prNumber} ${repo ? `--repo ${repo}` : ""} --json title,headRefName,baseRefName,body`,
        { encoding: "utf-8" },
      );
      const pr = JSON.parse(prInfo) as {
        title: string;
        headRefName: string;
        baseRefName: string;
        body: string | null;
      };
      baseBranch = pr.baseRefName;
      headBranch = pr.headRefName;

      console.error(`   ${pr.title}`);
      console.error(`   ${pr.baseRefName} ← ${pr.headRefName}`);

      diffContent = execSync(
        `gh pr diff ${prNumber} ${repo ? `--repo ${repo}` : ""}`,
        { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
      );
    } else {
      diffContent = readFileSync(diffPath!, "utf-8");
    }

    // Parse changed files from diff
    const changedFiles = parseChangedFiles(diffContent);
    if (changedFiles.length === 0) {
      console.error("No changed files found in diff.");
      return 0;
    }

    console.error(`\n📦 ${changedFiles.length} files changed`);
    for (const f of changedFiles) {
      const icon =
        f.status === "added" ? "➕" :
        f.status === "deleted" ? "➖" :
        f.status === "renamed" ? "🔄" : "✏️";
      console.error(`   ${icon} ${f.path} (+${f.additions}/-${f.deletions})`);
    }

    // Run analysis
    const result = await analyzeDiff(changedFiles);

    // Print detailed report
    printReport(result);

    // Post to PR if we have one
    if (prNumber) {
      const body = formatReviewBody(result);
      const reviewBodyPath = "/tmp/agent-workbench-review.md";
      const { writeFileSync } = await import("node:fs");
      writeFileSync(reviewBodyPath, body, "utf-8");

      execSync(
        `gh pr review ${prNumber} ${repo ? `--repo ${repo}` : ""} ` +
        `--comment --body-file "${reviewBodyPath}"`,
        { encoding: "utf-8" },
      );
      console.error(`\n✅ Review posted to PR #${prNumber}`);
    }

    return result.errorCount > 0 ? 1 : 0;
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

// ── Diff parsing ───────────────────────────────────────────────────────────

export function parseChangedFiles(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const fileRegex = /^diff --git a\/(.+?) b\/(.+?)$/gm;
  let match: RegExpExecArray | null;

  while ((match = fileRegex.exec(diff)) !== null) {
    const path = match[2]!;
    // Determine status from diff markers
    let status: ChangedFile["status"] = "modified";
    let additions = 0;
    let deletions = 0;

    // Count +/- lines in the hunk
    const hunkStart = match.index;
    const nextFileIdx = diff.indexOf("diff --git", hunkStart + 1);
    const hunk = nextFileIdx >= 0
      ? diff.slice(hunkStart, nextFileIdx)
      : diff.slice(hunkStart);

    if (hunk.includes("new file mode")) status = "added";
    else if (hunk.includes("deleted file mode")) status = "deleted";
    else if (/^rename from /m.test(hunk)) status = "renamed";

    // Count additions/deletions in hunks
    for (const line of hunk.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }

    files.push({ path, status, additions, deletions });
  }

  return files;
}

// ── Analysis ───────────────────────────────────────────────────────────────

async function analyzeDiff(
  files: ChangedFile[],
): Promise<ReviewResult> {
  const fileReports: FileReport[] = [];
  let errorCount = 0;
  let warningCount = 0;

  const tsFiles = files.filter(
    (f) =>
      f.status !== "deleted" &&
      /\.(ts|tsx|js|jsx|mts|cts)$/i.test(f.path),
  );

  for (const file of tsFiles) {
    const issues: Issue[] = [];

    // Check file exists
    if (!existsSync(file.path)) {
      issues.push({
        severity: "warning",
        message: "File not found locally — may need to checkout the branch",
        source: "workbench",
      });
      fileReports.push({ path: file.path, issues });
      continue;
    }

    // Run TypeScript type-check on just this file
    try {
      const result = execSync(
        `npx -y tsc --noEmit --pretty false "${file.path}" 2>&1 || true`,
        { encoding: "utf-8", timeout: 30000 },
      );
      for (const line of result.split("\n")) {
        if (line.includes("error TS")) {
          issues.push({
            severity: "error",
            message: line.replace(/^.*error TS\d+:\s*/, "").trim(),
            source: "typescript",
          });
          errorCount++;
        }
      }
    } catch {
      // Individual file tsc may fail if project setup isn't available
      issues.push({
        severity: "info",
        message: "Could not run isolated type-check (try full project build)",
        source: "workbench",
      });
    }

    // Run Biome lint on the file
    try {
      const result = execSync(
        `npx @biomejs/biome check --no-errors-on-unmatched "${file.path}" 2>&1 || true`,
        { encoding: "utf-8", timeout: 15000 },
      );
      for (const line of result.split("\n")) {
        if (line.includes("error[")) {
          issues.push({
            severity: "error",
            message: line.trim(),
            source: "biome",
          });
          errorCount++;
        } else if (line.includes("warning[")) {
          issues.push({
            severity: "warning",
            message: line.trim(),
            source: "biome",
          });
          warningCount++;
        }
      }
    } catch {
      // skip
    }

    if (issues.length > 0) {
      fileReports.push({ path: file.path, issues });
    }
  }

  // Summary
  const totalIssues = errorCount + warningCount;
  let summary: string;
  if (totalIssues === 0) {
    summary = `✅ Clean — no issues found across ${tsFiles.length} TypeScript files`;
  } else {
    summary =
      `Found ${errorCount} error(s) and ${warningCount} warning(s) ` +
      `across ${fileReports.length} of ${tsFiles.length} files checked`;
  }

  return { summary, fileReports, errorCount, warningCount };
}

// ── Output formatting ──────────────────────────────────────────────────────

function printReport(result: ReviewResult): void {
  console.error(`\n${result.summary}\n`);

  for (const report of result.fileReports) {
    console.error(`📄 ${report.path}`);
    for (const issue of report.issues) {
      const icon =
        issue.severity === "error" ? "❌" :
        issue.severity === "warning" ? "⚠️" : "ℹ️";
      const lineStr = issue.line ? `:${issue.line}` : "";
      console.error(`   ${icon} [${issue.source}]${lineStr} ${issue.message}`);
    }
    console.error("");
  }
}

function formatReviewBody(result: ReviewResult): string {
  const lines: string[] = [
    `## 🤖 agent-workbench PR Review`,
    ``,
    result.summary,
    ``,
  ];

  if (result.fileReports.length === 0) {
    lines.push(`**No issues found.** ✨`);
  }

  for (const report of result.fileReports) {
    lines.push(`### 📄 \`${report.path}\``);
    lines.push(``);
    for (const issue of report.issues) {
      const icon =
        issue.severity === "error" ? "❌" :
        issue.severity === "warning" ? "⚠️" : "ℹ️";
      const lineStr = issue.line ? ` (line ${issue.line})` : "";
      lines.push(
        `- ${icon} **${issue.severity.toUpperCase()}** [${issue.source}]${lineStr}: ${issue.message}`,
      );
    }
    lines.push(``);
  }

  return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArg(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]!;
  return undefined;
}

function detectRepo(): string | undefined {
  try {
    const remote = execSync("git remote get-url origin", {
      encoding: "utf-8",
    }).trim();
    const match = remote.match(
      /(?:github\.com[:\/])([\w.-]+\/[\w.-]+?)(?:\.git)?$/,
    );
    return match?.[1];
  } catch {
    return undefined;
  }
}
