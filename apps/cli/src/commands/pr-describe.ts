/**
 * PR describe command — generates a PR description from git log.
 *
 * Usage:
 *   agent-workbench pr-describe [--base <branch>] [--head <branch>]
 *   agent-workbench pr-describe --pr <number>
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// ── Command handler ────────────────────────────────────────────────────────

export async function handlePrDescribe(
  args: string[],
): Promise<number> {
  const prNumber = parseArg(args, "--pr");
  const baseArg = parseArg(args, "--base") ?? "main";
  const headArg = parseArg(args, "--head") ?? "HEAD";
  const output = parseArg(args, "--output");

  try {
    let baseBranch = baseArg;
    let headBranch = headArg;
    let repo: string | undefined;

    // Fetch PR info if --pr was given
    if (prNumber) {
      console.error(`🔍 Fetching PR #${prNumber}...`);
      const prInfo = execSync(
        `gh pr view ${prNumber} --json title,headRefName,baseRefName,body`,
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
    }

    // Parse conventional commits between base and head
    const range = `${baseBranch}..${headBranch}`;
    const logFormat = "--format=---%n%H%n%an%n%ai%n%s%n%b";
    let rawLog: string;

    try {
      rawLog = execSync(
        `git log ${range} ${logFormat}`,
        { encoding: "utf-8", maxBuffer: 2 * 1024 * 1024 },
      ).trim();
    } catch {
      // Try fetching the head branch first
      try {
        execSync(`git fetch origin ${headBranch}`, {
          encoding: "utf-8",
          timeout: 15000,
        });
        rawLog = execSync(
          `git log ${range} ${logFormat}`,
          { encoding: "utf-8", maxBuffer: 2 * 1024 * 1024 },
        ).trim();
      } catch {
        console.error(
          `Error: Could not get commits between ${baseBranch} and ${headBranch}`,
        );
        return 1;
      }
    }

    if (!rawLog) {
      console.error("No commits found in range — branches may be up-to-date.");
      return 0;
    }

    const commits = parseCommits(rawLog);
    const summary = generateDescription(commits, baseBranch, headBranch);

    // Output
    if (output) {
      writeFileSync(output, summary, "utf-8");
      console.error(`\n✅ PR description written to ${output}`);
    } else {
      console.log(summary);
    }

    return 0;
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
  body: string;
}

// ── Parsing ────────────────────────────────────────────────────────────────

export function parseCommits(raw: string): CommitInfo[] {
  const blocks = raw.split("\n---\n").filter(Boolean);
  const commits: CommitInfo[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const hash = lines[0]?.trim() ?? "";
    const author = lines[1]?.trim() ?? "";
    const date = lines[2]?.trim() ?? "";
    const subject = lines[3]?.trim() ?? "";
    const body = lines.slice(4).join("\n").trim();

    const conventional = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
    if (conventional) {
      commits.push({
        hash: hash.slice(0, 7),
        author,
        date,
        type: conventional[1]!,
        scope: conventional[2] ?? null,
        breaking: conventional[3] === "!",
        description: conventional[4]!,
        body,
      });
    }
  }

  return commits;
}

// ── Description generation ─────────────────────────────────────────────────

function generateDescription(
  commits: CommitInfo[],
  baseBranch: string,
  headBranch: string,
): string {
  const lines: string[] = [];

  // Title from first commit or branch name
  const branchName = headBranch !== "HEAD" ? headBranch : "current";
  const firstSubject = commits[0]?.description ?? "";
  const title = firstSubject.length > 60
    ? `${firstSubject.slice(0, 57)}...`
    : firstSubject;

  lines.push(`## ${title}`);
  lines.push(``);

  // Summary
  const featCount = commits.filter((c) => c.type === "feat" || c.type === "feature").length;
  const fixCount = commits.filter((c) => c.type === "fix" || c.type === "bugfix").length;
  const breakingCount = commits.filter((c) => c.breaking).length;

  lines.push(`### 📋 Overview`);
  lines.push(``);
  lines.push(
    `This PR contains **${commits.length} commit${commits.length === 1 ? "" : "s"}** ` +
    `(⟵ ${headBranch} into ${baseBranch}).`,
  );
  lines.push(``);
  if (featCount > 0) lines.push(`- **${featCount}** feature${featCount === 1 ? "" : "s"} ✨`);
  if (fixCount > 0) lines.push(`- **${fixCount}** bug fix${fixCount === 1 ? "" : "es"} 🐛`);
  if (breakingCount > 0) lines.push(`- ⚠️ **${breakingCount} breaking change${breakingCount === 1 ? "" : "s"}**`);
  lines.push(``);

  // Commits grouped by type
  lines.push(`### 📝 Commits`);
  lines.push(``);

  for (const commit of commits) {
    const typeEmoji = getTypeEmoji(commit.type);
    const breaking = commit.breaking ? " ⚠️" : "";
    const scope = commit.scope ? `**${commit.scope}**: ` : "";
    lines.push(
      `- ${typeEmoji} ${scope}${commit.description}${breaking} (\`${commit.hash}\`)`,
    );
  }

  lines.push(``);

  // Co-authored-by from commit bodies
  const coauthors = new Set<string>();
  for (const commit of commits) {
    const match = commit.body.match(/Co-authored-by:\s*(.+)/);
    if (match) coauthors.add(match[1]!.trim());
  }
  if (coauthors.size > 0) {
    lines.push(`### 👥 Co-Authors`);
    lines.push(``);
    for (const author of coauthors) {
      lines.push(`- ${author}`);
    }
    lines.push(``);
  }

  // Checklist
  lines.push(`### ✅ Checklist`);
  lines.push(``);
  lines.push(`- [ ] Tests pass (\`bun test\`)`);
  lines.push(`- [ ] Type-check passes (\`bun run typecheck\`)`);
  lines.push(`- [ ] Lint passes (\`bunx @biomejs/biome check .\`)`);
  lines.push(`- [ ] Build succeeds (\`bun run build\`)`);
  lines.push(``);

  return lines.join("\n");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getTypeEmoji(type: string): string {
  const emoji: Record<string, string> = {
    feat: "✨",
    feature: "✨",
    fix: "🐛",
    bugfix: "🐛",
    docs: "📚",
    documentation: "📚",
    style: "💄",
    refactor: "♻️",
    perf: "⚡",
    performance: "⚡",
    test: "🧪",
    tests: "🧪",
    build: "📦",
    ci: "🤖",
    chore: "🔧",
    revert: "⏪",
  };
  return emoji[type] ?? "📝";
}

function parseArg(args: string[], key: string): string | undefined {
  const idx = args.indexOf(key);
  if (idx >= 0 && idx + 1 < args.length) return args[idx + 1]!;
  return undefined;
}
