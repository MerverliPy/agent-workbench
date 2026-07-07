/**
 * Changelog command — generates a changelog from conventional commits.
 *
 * Usage:
 *   agent-workbench changelog [--from <tag|commit>] [--to <tag|commit>]
 *   agent-workbench changelog --last-release
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// ── Types ──────────────────────────────────────────────────────────────────

interface CommitGroup {
  title: string;
  commits: ParsedCommit[];
}

interface ParsedCommit {
  hash: string;
  type: string;
  scope: string | null;
  breaking: boolean;
  description: string;
  body: string;
}

// ── Command handler ────────────────────────────────────────────────────────

export async function handleChangelog(
  args: string[],
): Promise<number> {
  const from = parseArg(args, "--from");
  const to = parseArg(args, "--to") ?? "HEAD";
  const lastRelease = args.includes("--last-release");
  const output = parseArg(args, "--output");

  try {
    // Determine the range
    let range: string;

    if (lastRelease) {
      const lastTag = execSync(
        "git describe --tags --abbrev=0 2>/dev/null || echo ''",
        { encoding: "utf-8" },
      ).trim();
      if (!lastTag) {
        console.error("No tags found. Use --from explicitly or run without --last-release.");
        return 1;
      }
      range = `${lastTag}..${to}`;
      console.error(`📋 Changes since ${lastTag} → ${to}`);
    } else if (from) {
      range = `${from}..${to}`;
      console.error(`📋 Changes from ${from} → ${to}`);
    } else {
      const lastTag = execSync(
        "git describe --tags --abbrev=0 2>/dev/null || echo ''",
        { encoding: "utf-8" },
      ).trim();
      range = lastTag ? `${lastTag}..${to}` : `--all`;
      console.error(`📋 Changes since ${lastTag || 'the beginning'} → ${to}`);
    }

    // Fetch commits
    const logFormat = "--format=---%n%H%n%s%n%b";
    const rawLog = execSync(
      `git log ${range} ${logFormat}`,
      { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 },
    ).trim();

    if (!rawLog) {
      console.error("No commits found in range.");
      return 0;
    }

    const commits = parseCommits(rawLog);
    const groups = groupCommits(commits);
    const markdown = formatChangelog(groups, range, commits.length);

    // Output
    if (output) {
      writeFileSync(output, markdown, "utf-8");
      console.error(`\n✅ Changelog written to ${output}`);
    } else {
      console.log(markdown);
    }

    return 0;
  } catch (err) {
    console.error(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return 1;
  }
}

// ── Parsing ────────────────────────────────────────────────────────────────

export function parseCommits(raw: string): ParsedCommit[] {
  const blocks = raw.split("\n---\n").filter(Boolean);
  const commits: ParsedCommit[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const hash = lines[0]?.trim() ?? "";
    const subject = lines[1]?.trim() ?? "";
    const body = lines.slice(2).join("\n").trim();

    // Parse conventional commit: type(scope)!: description
    const conventional = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
    if (conventional) {
      commits.push({
        hash: hash.slice(0, 7),
        type: conventional[1]!,
        scope: conventional[2] ?? null,
        breaking: conventional[3] === "!",
        description: conventional[4]!,
        body,
      });
    } else {
      commits.push({
        hash: hash.slice(0, 7),
        type: "other",
        scope: null,
        breaking: false,
        description: subject,
        body,
      });
    }
  }

  return commits;
}

// ── Grouping ───────────────────────────────────────────────────────────────

const TYPE_ORDER: Record<string, number> = {
  feat: 0,
  feature: 0,
  fix: 1,
  bugfix: 1,
  docs: 2,
  documentation: 2,
  style: 3,
  refactor: 4,
  perf: 5,
  performance: 5,
  test: 6,
  tests: 6,
  build: 7,
  ci: 8,
  chore: 9,
  other: 10,
};

const TYPE_LABELS: Record<string, string> = {
  feat: "🚀 Features",
  feature: "🚀 Features",
  fix: "🐛 Bug Fixes",
  bugfix: "🐛 Bug Fixes",
  docs: "📚 Documentation",
  documentation: "📚 Documentation",
  style: "💄 Style",
  refactor: "♻️ Refactoring",
  perf: "⚡ Performance",
  performance: "⚡ Performance",
  test: "🧪 Tests",
  tests: "🧪 Tests",
  build: "📦 Build System",
  ci: "🤖 CI",
  chore: "🔧 Chores",
  other: "📝 Other",
};

export function groupCommits(commits: ParsedCommit[]): CommitGroup[] {
  const groups = new Map<string, ParsedCommit[]>();

  for (const commit of commits) {
    const label = TYPE_LABELS[commit.type] ?? "📝 Other";
    const existing = groups.get(label);
    if (existing) {
      existing.push(commit);
    } else {
      groups.set(label, [commit]);
    }
  }

  return Array.from(groups.entries())
    .map(([title, commitList]) => ({ title, commits: commitList }))
    .sort((a, b) => {
      const aOrder = TYPE_ORDER[a.commits[0]?.type ?? "other"] ?? 99;
      const bOrder = TYPE_ORDER[b.commits[0]?.type ?? "other"] ?? 99;
      return aOrder - bOrder;
    });
}

// ── Formatting ─────────────────────────────────────────────────────────────

function formatChangelog(
  groups: CommitGroup[],
  range: string,
  total: number,
): string {
  const lines: string[] = [
    `# Changelog`,
    ``,
    `> ${range} — ${total} commit${total === 1 ? "" : "s"}`,
    ``,
  ];

  // Breaking changes section
  const breaking = groups.flatMap((g) =>
    g.commits.filter((c) => c.breaking),
  );
  if (breaking.length > 0) {
    lines.push(`## ⚠️ Breaking Changes`);
    lines.push(``);
    for (const commit of breaking) {
      lines.push(`- **${commit.description}** — \`${commit.hash}\``);
      if (commit.body) {
        lines.push(`  ${commit.body.split("\n")[0]}`);
      }
    }
    lines.push(``);
  }

  // Grouped commits
  for (const group of groups) {
    const nonBreaking = group.commits.filter((c) => !c.breaking);
    if (nonBreaking.length === 0) continue;

    lines.push(`## ${group.title}`);
    lines.push(``);
    for (const commit of nonBreaking) {
      const scope = commit.scope ? `**${commit.scope}**: ` : "";
      lines.push(`- ${scope}${commit.description} (\`${commit.hash}\`)`);
      if (commit.body) {
        const firstLine = commit.body.split("\n")[0]?.trim();
        if (firstLine && firstLine.length > 0) {
          lines.push(`  ${firstLine}`);
        }
      }
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
