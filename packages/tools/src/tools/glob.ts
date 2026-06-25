/**
 * glob tool — find files by glob pattern within the project.
 *
 * Respects:
 *  - Project-root boundary (path-guard)
 *  - Sensitive-path policy (path-guard)
 *  - Path-count truncation (compress)
 *  - Session-scoped cache (ToolCache)
 *  - AbortSignal from the run
 *
 * Default ignore list: .git, node_modules, dist
 */

import { z } from "zod";
import * as path from "path";
import type { RegisteredTool, ToolExecutionContext } from "../types";
import type { ToolDefinition } from "@agent-workbench/protocol";
import {
  assertSafePath,
  toRelativePath,
  isSensitivePath,
  PathGuardError,
} from "../path-guard";
import { GLOB_MAX_PATHS, truncateItems } from "../compress";
import type { ToolCache } from "@agent-workbench/cache";

// ---------------------------------------------------------------------------
// Default ignore segments
// ---------------------------------------------------------------------------

const DEFAULT_IGNORE_DIRS = new Set(["node_modules", ".git", "dist"]);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const GlobInput = z.object({
  /** Glob pattern to match files/directories against. */
  pattern: z.string().min(1, "pattern is required"),
  /**
   * Base directory to search within.
   * Defaults to project root when omitted.
   */
  path: z.string().optional(),
  /**
   * Maximum number of paths to return.
   * Defaults to GLOB_MAX_PATHS (1000). Hard cap: 2000.
   */
  maxResults: z.number().int().min(1).max(2000).optional(),
});
export type GlobInput = z.infer<typeof GlobInput>;

export const GlobResult = z.object({
  /** The original glob pattern. */
  pattern: z.string(),
  /** Matched project-relative paths (possibly truncated). */
  paths: z.array(z.string()),
  /** Total paths matched before truncation. */
  totalMatched: z.number().int(),
  /** True when results were truncated to maxResults. */
  truncated: z.boolean(),
});
export type GlobResult = z.infer<typeof GlobResult>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const DEFINITION: ToolDefinition = {
  name: "glob",
  description:
    "Find files matching a glob pattern within the project. " +
    "Returns project-relative paths. " +
    "Skips .git, node_modules, and dist by default.",
  inputSchema: GlobInput.shape,
  outputSchema: GlobResult.shape,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface GlobToolOptions {
  cache?: ToolCache;
}

export function createGlobTool(options: GlobToolOptions = {}): RegisteredTool {
  return {
    definition: DEFINITION,
    executor: {
      async execute(
        input: unknown,
        context: ToolExecutionContext
      ): Promise<GlobResult> {
        // 1. Validate input.
        const parsed = GlobInput.safeParse(input);
        if (!parsed.success) {
          throw new Error(
            `Invalid glob input: ${parsed.error.message}`
          );
        }
        const { pattern, path: searchPath, maxResults } = parsed.data;

        // 2. Resolve and validate search root.
        let searchRoot: string;
        try {
          searchRoot = searchPath
            ? assertSafePath(searchPath, context.projectRoot)
            : path.resolve(context.projectRoot);
        } catch (err: unknown) {
          if (err instanceof PathGuardError) throw err;
          throw new Error(
            `Path validation failed for "${searchPath ?? "."}": ${String(err)}`
          );
        }

        // 3. Cache lookup.
        const cacheKey = JSON.stringify({
          pattern,
          searchRoot: toRelativePath(searchRoot, context.projectRoot),
          maxResults: maxResults ?? null,
        });
        const cached = options.cache?.get(
          context.sessionId,
          context.projectRoot,
          "tool:glob",
          cacheKey
        );
        if (cached !== undefined) {
          return cached as GlobResult;
        }

        // 4. Abort check before I/O.
        if (context.signal?.aborted) {
          throw new Error("glob aborted");
        }

        // 5. Scan with Bun.Glob.
        const effectiveMax = maxResults ?? GLOB_MAX_PATHS;
        const glob = new Bun.Glob(pattern);
        const allPaths: string[] = [];

        for await (const relFile of glob.scan({
          cwd: searchRoot,
          onlyFiles: false,
          followSymlinks: false,
        })) {
          if (context.signal?.aborted) break;

          // Skip default ignore directories.
          const segments = relFile.split("/");
          const topDir = segments[0] ?? "";
          if (DEFAULT_IGNORE_DIRS.has(topDir)) continue;

          // Build paths relative to project root.
          const absPath = path.join(searchRoot, relFile);
          const relToRoot = toRelativePath(absPath, context.projectRoot);

          // Skip sensitive paths.
          if (isSensitivePath(relToRoot)) continue;

          allPaths.push(relToRoot);
        }

        // 6. Truncate.
        const { items: paths, meta } = truncateItems(allPaths, effectiveMax);

        const result: GlobResult = {
          pattern,
          paths,
          totalMatched: meta.totalItems,
          truncated: meta.truncated,
        };

        // 7. Write to cache.
        options.cache?.set(
          context.sessionId,
          context.projectRoot,
          "tool:glob",
          cacheKey,
          result
        );

        return result;
      },
    },
  };
}
