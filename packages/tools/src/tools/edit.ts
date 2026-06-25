/**
 * edit tool — Phase 9 file mutation.
 *
 * Replaces the first occurrence of `oldString` with `newString` in the
 * specified file. Requires permission approval (ask/high per defaultPolicy).
 *
 * Permissions: edit → ask (defaultPolicy)
 * Ownership:   packages/tools, packages/diff, packages/storage
 */

import { z } from "zod/v4";
import { ulid } from "ulid";
import { applyMutation } from "@agent-workbench/diff";
import type { ToolDefinition } from "@agent-workbench/protocol";
import type { RegisteredTool, ToolExecutor, ToolExecutionContext } from "../types";
import { assertSafePath } from "../path-guard";
import type { MutationToolOptions } from "../mutation-context";

// ── Input / Result schemas ────────────────────────────────────────────────────

export const EditInput = z.object({
  /** Relative or absolute path to the file to edit. */
  path: z.string().min(1),
  /** Exact string to search for in the current file content. */
  oldString: z.string().min(1),
  /** Replacement string (may be empty to delete). */
  newString: z.string(),
});
export type EditInput = z.infer<typeof EditInput>;

export const EditResult = z.object({
  path: z.string(),
  /** Number of lines changed (additions + removals). */
  linesChanged: z.number().int().nonnegative(),
  /** ULID of the FileChange record persisted in storage. */
  changeId: z.string(),
});
export type EditResult = z.infer<typeof EditResult>;

// ── Tool definition ──────────────────────────────────────────────────────────

const definition: ToolDefinition = {
  name: "edit",
  description:
    "Replace the first occurrence of `oldString` with `newString` in a file. " +
    "Requires permission approval. A diff preview is shown before execution.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to edit (relative to project root)." },
      oldString: { type: "string", description: "Exact string to replace (first occurrence)." },
      newString: { type: "string", description: "Replacement string." },
    },
    required: ["path", "oldString", "newString"],
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createEditTool(options: MutationToolOptions): RegisteredTool {
  const executor: ToolExecutor = {
    async execute(input: unknown, context: ToolExecutionContext): Promise<unknown> {
      const parsed = EditInput.safeParse(input);
      if (!parsed.success) {
        throw new Error(`edit: invalid input: ${parsed.error.message}`);
      }
      const { path: rawPath, oldString, newString } = parsed.data;

      const resolvedPath = resolvePath(rawPath, context.projectRoot);
      assertSafePath(resolvedPath, context.projectRoot);

      const result = await applyMutation(
        { type: "edit", path: resolvedPath, oldString, newString },
        context.projectRoot
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const changeId = ulid();
      options.fileChangeRepository.create({
        id: changeId,
        sessionId: context.sessionId,
        runId: context.runId,
        toolCallId: context.toolCallId,
        path: resolvedPath,
        changeType: "edit",
        beforeHash: result.beforeHash ?? null,
        afterHash: result.afterHash,
        patch: result.patch,
        dryRunId: null,
        approvedByPermissionDecisionId: null,
        createdAt: new Date().toISOString(),
        metadataJson: null,
      });

      options.toolCache?.invalidateAffectedByPath(
        context.sessionId,
        context.projectRoot,
        resolvedPath
      );

      const linesChanged = result.linesAdded + result.linesRemoved;

      return {
        path: resolvedPath,
        linesChanged,
        changeId,
      } satisfies EditResult;
    },
  };

  return { definition, executor };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePath(rawPath: string, projectRoot: string): string {
  if (rawPath.startsWith("/")) return rawPath;
  return `${projectRoot}/${rawPath}`;
}
