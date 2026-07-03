/**
 * read tool — read the contents of a file within the project.
 *
 * Respects:
 *  - Project-root boundary (path-guard)
 *  - Sensitive-path policy (path-guard)
 *  - Line-count truncation (compress)
 *  - Session-scoped cache (ToolCache)
 *  - AbortSignal from the run
 */

import * as fs from "node:fs";
import type { ToolCache } from "@agent-workbench/cache";
import type { ToolDefinition } from "@agent-workbench/protocol";
import { z } from "zod";
import { READ_MAX_LINES, truncateLines } from "../compress";
import { assertSafePath, PathGuardError, toRelativePath } from "../path-guard";
import type { RegisteredTool, ToolExecutionContext } from "../types";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ReadInput = z.object({
  /** Path to the file, relative to the project root or absolute within it. */
  path: z.string().min(1, "path is required"),
  /**
   * 1-indexed line number to start reading from.
   * Defaults to 1 (start of file).
   */
  offset: z.number().int().min(1).optional(),
  /**
   * Maximum number of lines to return.
   * Defaults to READ_MAX_LINES.
   */
  limit: z.number().int().min(1).max(READ_MAX_LINES).optional(),
});
export type ReadInput = z.infer<typeof ReadInput>;

export const ReadResult = z.object({
  /** Project-relative path of the file read. */
  path: z.string(),
  /** File content (possibly truncated). */
  content: z.string(),
  /** Total number of lines in the file. */
  totalLines: z.number().int(),
  /** Number of lines returned in this result. */
  returnedLines: z.number().int(),
  /** 1-indexed first line returned. */
  fromLine: z.number().int(),
  /** 1-indexed last line returned (inclusive). */
  toLine: z.number().int(),
  /** True when the file has more lines beyond toLine. */
  truncated: z.boolean(),
});
export type ReadResult = z.infer<typeof ReadResult>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

const DEFINITION: ToolDefinition = {
  name: "read",
  description:
    "Read the contents of a file within the project. " +
    "Supports pagination via offset (1-indexed line number) and limit (max lines). " +
    "Returns truncation metadata when the file is larger than the requested range.",
  inputSchema: ReadInput.shape,
  outputSchema: ReadResult.shape,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface ReadToolOptions {
  cache?: ToolCache;
}

export function createReadTool(options: ReadToolOptions = {}): RegisteredTool {
  return {
    definition: DEFINITION,
    executor: {
      async execute(
        input: unknown,
        context: ToolExecutionContext,
      ): Promise<ReadResult> {
        // 1. Validate input schema.
        const parsed = ReadInput.safeParse(input);
        if (!parsed.success) {
          throw new Error(`Invalid read input: ${parsed.error.message}`);
        }
        const { path: filePath, offset, limit } = parsed.data;

        // 2. Path safety (throws PathGuardError on violation).
        let absPath: string;
        try {
          absPath = assertSafePath(filePath, context.projectRoot);
        } catch (err: unknown) {
          if (err instanceof PathGuardError) throw err;
          throw new Error(
            `Path validation failed for "${filePath}": ${String(err)}`,
          );
        }

        const relPath = toRelativePath(absPath, context.projectRoot);

        // 3. Cache lookup.
        const cacheKey = JSON.stringify({
          path: relPath,
          offset: offset ?? null,
          limit: limit ?? null,
        });
        const cached = options.cache?.get(
          context.sessionId,
          context.projectRoot,
          "tool:read",
          cacheKey,
        );
        if (cached !== undefined) {
          return cached as ReadResult;
        }

        // 4. Abort check before I/O.
        if (context.signal?.aborted) {
          throw new Error("read aborted");
        }

        // 5. Read file from filesystem.
        if (!fs.existsSync(absPath)) {
          throw new Error(`File not found: "${relPath}"`);
        }
        const stat = fs.statSync(absPath);
        if (!stat.isFile()) {
          throw new Error(`"${relPath}" is not a regular file`);
        }

        // Use mtime as source hash for future cache invalidation.
        const sourceHash = String(stat.mtimeMs);

        const raw = fs.readFileSync(absPath, "utf8");
        const allLines = raw.split("\n");

        // 6. Apply offset and limit (convert 1-indexed offset to 0-indexed).
        const zeroOffset = Math.max(0, (offset ?? 1) - 1);
        const effectiveLimit = limit ?? READ_MAX_LINES;

        const { content, meta } = truncateLines(
          allLines,
          effectiveLimit,
          zeroOffset,
        );

        const fromLine = zeroOffset + 1;
        const toLine = zeroOffset + meta.returnedLines;

        const result: ReadResult = {
          path: relPath,
          content,
          totalLines: meta.totalLines,
          returnedLines: meta.returnedLines,
          fromLine,
          toLine,
          truncated: meta.truncated,
        };

        // 7. Write to cache.
        options.cache?.set(
          context.sessionId,
          context.projectRoot,
          "tool:read",
          cacheKey,
          result,
          sourceHash,
        );

        return result;
      },
    },
  };
}
