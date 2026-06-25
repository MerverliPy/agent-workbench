/**
 * write tool — Phase 9 file mutation.
 *
 * Creates or overwrites a file with the supplied content. Requires
 * permission approval (ask/high per defaultPolicy) before the executor runs.
 *
 * Permissions: write → ask (defaultPolicy, packages/permissions/src/policy.ts)
 * Ownership:   packages/tools (tool definition and executor adapter)
 *              packages/diff  (patch generation and file write)
 *              packages/storage (FileChange persistence)
 */

import { z } from "zod/v4";
import { ulid } from "ulid";
import { applyMutation } from "@agent-workbench/diff";
import type { ToolDefinition } from "@agent-workbench/protocol";
import type { RegisteredTool, ToolExecutor, ToolExecutionContext } from "../types";
import { assertSafePath } from "../path-guard";
import type { MutationToolOptions } from "../mutation-context";

// ── Input / Result schemas ────────────────────────────────────────────────────

export const WriteInput = z.object({
  /** Relative or absolute path to write. Resolved against projectRoot. */
  path: z.string().min(1),
  /** Full content to write. Creates the file if it does not exist. */
  content: z.string(),
});
export type WriteInput = z.infer<typeof WriteInput>;

export const WriteResult = z.object({
  path: z.string(),
  /** Number of lines in the written content. */
  linesWritten: z.number().int().nonnegative(),
  /** True when the file did not exist before the write. */
  created: z.boolean(),
  /** ULID of the FileChange record persisted in storage. */
  changeId: z.string(),
});
export type WriteResult = z.infer<typeof WriteResult>;

// ── Tool definition ──────────────────────────────────────────────────────────

const definition: ToolDefinition = {
  name: "write",
  description:
    "Create or overwrite a file with the supplied content. " +
    "Requires permission approval. A diff preview is shown before execution.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write (relative to project root)." },
      content: { type: "string", description: "Full content to write to the file." },
    },
    required: ["path", "content"],
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create and return the write tool.
 *
 * @param options  Injected dependencies (fileChangeRepository, optional toolCache).
 */
export function createWriteTool(options: MutationToolOptions): RegisteredTool {
  const executor: ToolExecutor = {
    async execute(input: unknown, context: ToolExecutionContext): Promise<unknown> {
      const parsed = WriteInput.safeParse(input);
      if (!parsed.success) {
        throw new Error(`write: invalid input: ${parsed.error.message}`);
      }
      const { path: rawPath, content } = parsed.data;

      // Resolve path and enforce project-root + sensitive-path safety.
      const resolvedPath = resolvePath(rawPath, context.projectRoot);
      assertSafePath(resolvedPath, context.projectRoot);

      // Check whether the file exists before the write.
      const existedBefore = await Bun.file(resolvedPath).exists();

      // Apply the mutation via packages/diff.
      const result = await applyMutation(
        { type: "write", path: resolvedPath, content },
        context.projectRoot
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Persist file change record.
      const changeId = ulid();
      options.fileChangeRepository.create({
        id: changeId,
        sessionId: context.sessionId,
        runId: context.runId,
        toolCallId: context.toolCallId,
        path: resolvedPath,
        changeType: "write",
        beforeHash: result.beforeHash ?? null,
        afterHash: result.afterHash,
        patch: result.patch,
        dryRunId: null,
        approvedByPermissionDecisionId: null,
        createdAt: new Date().toISOString(),
        metadataJson: null,
      });

      // Invalidate cache entries affected by this path.
      options.toolCache?.invalidateAffectedByPath(
        context.sessionId,
        context.projectRoot,
        resolvedPath
      );

      const linesWritten = content.split("\n").length;

      return {
        path: resolvedPath,
        linesWritten,
        created: !existedBefore,
        changeId,
      } satisfies WriteResult;
    },
  };

  return { definition, executor };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePath(rawPath: string, projectRoot: string): string {
  if (rawPath.startsWith("/")) return rawPath;
  return `${projectRoot}/${rawPath}`;
}
