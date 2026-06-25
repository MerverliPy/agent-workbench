/**
 * apply_patch tool — Phase 9 file mutation.
 *
 * Applies a unified diff patch to an existing file. Requires permission
 * approval (ask/high per defaultPolicy). Fails with a structured error if
 * the patch does not apply cleanly.
 *
 * Permissions: apply_patch → ask (defaultPolicy)
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

export const ApplyPatchInput = z.object({
  /** Relative or absolute path to the file to patch. */
  path: z.string().min(1),
  /** Unified diff patch string (--- / +++ format). */
  patch: z.string().min(1),
});
export type ApplyPatchInput = z.infer<typeof ApplyPatchInput>;

export const ApplyPatchResult = z.object({
  path: z.string(),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
  /** ULID of the FileChange record persisted in storage. */
  changeId: z.string(),
});
export type ApplyPatchResult = z.infer<typeof ApplyPatchResult>;

// ── Tool definition ──────────────────────────────────────────────────────────

const definition: ToolDefinition = {
  name: "apply_patch",
  description:
    "Apply a unified diff patch to a file. " +
    "Requires permission approval. Fails if the patch does not apply cleanly.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to patch (relative to project root)." },
      patch: { type: "string", description: "Unified diff patch string (--- / +++ format)." },
    },
    required: ["path", "patch"],
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createApplyPatchTool(options: MutationToolOptions): RegisteredTool {
  const executor: ToolExecutor = {
    async execute(input: unknown, context: ToolExecutionContext): Promise<unknown> {
      const parsed = ApplyPatchInput.safeParse(input);
      if (!parsed.success) {
        throw new Error(`apply_patch: invalid input: ${parsed.error.message}`);
      }
      const { path: rawPath, patch } = parsed.data;

      const resolvedPath = resolvePath(rawPath, context.projectRoot);
      assertSafePath(resolvedPath, context.projectRoot);

      const result = await applyMutation(
        { type: "apply_patch", path: resolvedPath, patch },
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
        changeType: "apply_patch",
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

      return {
        path: resolvedPath,
        linesAdded: result.linesAdded,
        linesRemoved: result.linesRemoved,
        changeId,
      } satisfies ApplyPatchResult;
    },
  };

  return { definition, executor };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePath(rawPath: string, projectRoot: string): string {
  if (rawPath.startsWith("/")) return rawPath;
  return `${projectRoot}/${rawPath}`;
}
