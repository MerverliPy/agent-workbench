/**
 * grep tool — search file contents within the project using a regex pattern.
 *
 * Respects:
 *  - Project-root boundary (path-guard)
 *  - Sensitive-path policy (path-guard)
 *  - Match-count truncation (compress)
 *  - Session-scoped cache (ToolCache)
 *  - AbortSignal from the run
 *
 * Default ignore list: .git, node_modules, dist
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolCache } from "@agent-workbench/cache";
import type { ToolDefinition } from "@agent-workbench/protocol";
import { z } from "zod";
import {
  GREP_EXCERPT_MAX_CHARS,
  GREP_MAX_MATCHES,
  truncateItems,
} from "../compress";
import {
  assertSafePath,
  isSensitivePath,
  PathGuardError,
  toRelativePath,
} from "../path-guard";
import type { RegisteredTool, ToolExecutionContext } from "../types";

// ---------------------------------------------------------------------------
// Default ignore segments
// ---------------------------------------------------------------------------

const DEFAULT_IGNORE_DIRS = new Set(["node_modules", ".git", "dist"]);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const GrepInput = z.object({
  /** Regex pattern to search for. */
  pattern: z.string().min(1, "pattern is required"),
  /**
   * Directory to search within.
   * Defaults to project root when omitted.
   */
  path: z.string().optional(),
  /**
   * Glob pattern to filter which files are searched.
   * E.g. "*.ts", "**\/*.{ts,tsx}". Defaults to all files.
   */
  include: z.string().optional(),
  /**
   * Maximum number of matches to return.
   * Defaults to GREP_MAX_MATCHES (200). Hard cap: 500.
   */
  maxResults: z.number().int().min(1).max(500).optional(),
  /**
   * Whether the search is case-sensitive.
   * Defaults to true.
   */
  caseSensitive: z.boolean().optional(),
});
export type GrepInput = z.infer<typeof GrepInput>;

const GrepMatch = z.object({
  /** Project-relative file path. */
  file: z.string(),
  /** 1-indexed line number of the match. */
  line: z.number().int(),
  /** The matching line content (truncated to GREP_EXCERPT_MAX_CHARS). */
  excerpt: z.string(),
});

export const GrepResult = z.object({
  /** The original search pattern. */
  pattern: z.string(),
  /** Matched lines (possibly truncated to maxResults). */
  matches: z.array(GrepMatch),
  /** Total matches found before applying maxResults truncation. */
  totalMatches: z.number().int(),
  /** Number of files that were searched. */
  filesSearched: z.number().int(),
  /** True when results were truncated to maxResults. */
  truncated: z.boolean(),
  /** Index at which results were truncated (present when truncated is true). */
  truncatedAt: z.number().int().optional(),
});
export type GrepResult = z.infer<typeof GrepResult>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const DEFINITION: ToolDefinition = {
  name: "grep",
  description:
    "Search file contents within the project using a regular expression. " +
    "Returns matching lines with file path, line number, and excerpt. " +
    "Skips .git, node_modules, and dist by default.",
  inputSchema: GrepInput.shape,
  outputSchema: GrepResult.shape,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface GrepToolOptions {
  cache?: ToolCache;
}

export function createGrepTool(options: GrepToolOptions = {}): RegisteredTool {
  return {
    definition: DEFINITION,
    executor: {
      async execute(
        input: unknown,
        context: ToolExecutionContext,
      ): Promise<GrepResult> {
        // 1. Validate input.
        const parsed = GrepInput.safeParse(input);
        if (!parsed.success) {
          throw new Error(`Invalid grep input: ${parsed.error.message}`);
        }
        const {
          pattern,
          path: searchPath,
          include,
          maxResults,
          caseSensitive,
        } = parsed.data;

        // 2. Resolve and validate search root.
        let searchRoot: string;
        try {
          searchRoot = searchPath
            ? assertSafePath(searchPath, context.projectRoot)
            : path.resolve(context.projectRoot);
        } catch (err: unknown) {
          if (err instanceof PathGuardError) throw err;
          throw new Error(
            `Path validation failed for "${searchPath ?? "."}": ${String(err)}`,
          );
        }

        // 3. Compile regex.
        const flags = caseSensitive === false ? "i" : "";
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, flags);
        } catch {
          throw new Error(`Invalid regex pattern: "${pattern}"`);
        }

        // 4. Cache lookup.
        const cacheKey = JSON.stringify({
          pattern,
          searchRoot: toRelativePath(searchRoot, context.projectRoot),
          include: include ?? null,
          maxResults: maxResults ?? null,
          caseSensitive: caseSensitive ?? null,
        });
        const cached = options.cache?.get(
          context.sessionId,
          context.projectRoot,
          "tool:grep",
          cacheKey,
        );
        if (cached !== undefined) {
          return cached as GrepResult;
        }

        // 5. Enumerate files using Bun.Glob.
        const effectiveMax = maxResults ?? GREP_MAX_MATCHES;
        const globPattern = include ?? "**/*";
        const glob = new Bun.Glob(globPattern);

        if (context.signal?.aborted) {
          throw new Error("grep aborted");
        }

        const fileList: string[] = [];
        for await (const relFile of glob.scan({
          cwd: searchRoot,
          onlyFiles: true,
          followSymlinks: false,
        })) {
          if (context.signal?.aborted) break;

          // Skip default ignore directories.
          const segments = relFile.split("/");
          const topDir = segments[0] ?? "";
          if (DEFAULT_IGNORE_DIRS.has(topDir)) continue;

          // Skip sensitive files.
          const absFile = path.join(searchRoot, relFile);
          const relToRoot = toRelativePath(absFile, context.projectRoot);
          if (isSensitivePath(relToRoot)) continue;

          fileList.push(relFile);
        }

        // 6. Search each file for matches.
        const allMatches: Array<{
          file: string;
          line: number;
          excerpt: string;
        }> = [];
        let filesSearched = 0;

        for (const relFile of fileList) {
          if (context.signal?.aborted) break;

          const absFile = path.join(searchRoot, relFile);
          const relToRoot = toRelativePath(absFile, context.projectRoot);

          // Safety: make sure the file is still within project root after join.
          try {
            assertSafePath(absFile, context.projectRoot);
          } catch {
            continue;
          }

          filesSearched++;

          let lines: string[];
          try {
            const content = fs.readFileSync(absFile, "utf8");
            lines = content.split("\n");
          } catch {
            // Skip unreadable files (binary, permission denied, etc.).
            continue;
          }

          for (let i = 0; i < lines.length; i++) {
            if (context.signal?.aborted) break;

            const line = lines[i] ?? "";
            // Reset lastIndex to avoid sticky-regex state issues.
            regex.lastIndex = 0;
            if (regex.test(line)) {
              allMatches.push({
                file: relToRoot,
                line: i + 1,
                excerpt: line.slice(0, GREP_EXCERPT_MAX_CHARS),
              });
            }
          }
        }

        // 7. Truncate results.
        const { items: matches, meta } = truncateItems(
          allMatches,
          effectiveMax,
        );

        const result: GrepResult = {
          pattern,
          matches,
          totalMatches: meta.totalItems,
          filesSearched,
          truncated: meta.truncated,
          truncatedAt: meta.truncated ? matches.length : undefined,
        };

        // 8. Write to cache.
        options.cache?.set(
          context.sessionId,
          context.projectRoot,
          "tool:grep",
          cacheKey,
          result,
        );

        return result;
      },
    },
  };
}
