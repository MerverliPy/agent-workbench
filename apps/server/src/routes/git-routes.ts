import { execSync } from "node:child_process";
import type { Hono } from "hono";
import type { ServerAppBindings } from "../context";
import { ApiError } from "../errors";

interface GitStatusResponse {
  branch: string;
  ahead: number;
  behind: number;
  dirtyFiles: number;
  stagedFiles: number;
  untrackedFiles: number;
  statusOutput: string;
  recentCommits: CommitInfo[];
}

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

// ── Route registration ─────────────────────────────────────────────────

export function registerGitRoutes(app: Hono<ServerAppBindings>) {
  app.get("/git/status", async (ctx) => {
    try {
      const branch = runGit("rev-parse --abbrev-ref HEAD").trim();
      const statusOutput = runGit("status --short --branch");
      const logOutput = runGit("log --oneline --format=%H|%s|%an|%aI -10");

      // Parse branch info
      const aheadMatch = statusOutput.match(/ahead (\d+)/);
      const behindMatch = statusOutput.match(/behind (\d+)/);
      const ahead = aheadMatch ? parseInt(aheadMatch[1]!, 10) : 0;
      const behind = behindMatch ? parseInt(behindMatch[1]!, 10) : 0;

      // Parse file status
      const statusLines = statusOutput
        .split("\n")
        .filter((l) => l && !l.startsWith("##"));
      const dirtyFiles = statusLines.filter(
        (l) => l.match(/^ ?[MADRCU]/) && !l.startsWith("??"),
      ).length;
      const stagedFiles = statusLines.filter((l) =>
        l.match(/^[MADRCU]/),
      ).length;
      const untrackedFiles = statusLines.filter((l) =>
        l.startsWith("??"),
      ).length;

      // Parse commits
      const commits: CommitInfo[] = logOutput
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, message, author, date] = line.split("|");
          return {
            hash: hash ?? "",
            message: message ?? "",
            author: author ?? "",
            date: date ?? "",
          };
        });

      const response: GitStatusResponse = {
        branch,
        ahead,
        behind,
        dirtyFiles,
        stagedFiles,
        untrackedFiles,
        statusOutput: statusLines.join("\n"),
        recentCommits: commits,
      };

      return ctx.json(response);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to read git status";
      throw new ApiError({
        status: 500,
        code: "GIT_ERROR",
        message: msg,
        recoverable: true,
      });
    }
  });
}

function runGit(args: string): string {
  return execSync(`git ${args}`, {
    encoding: "utf-8",
    timeout: 5000,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
