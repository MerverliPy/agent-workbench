/**
 * revert_last_change tool — Phase 9.
 *
 * Reverts the most recent file mutation recorded in the session for the
 * given path. Uses the stored patch to reconstruct the original content.
 *
 * Safety: aborts if the file has been modified since the recorded mutation
 * (afterHash mismatch), to prevent data loss.
 *
 * Permissions: revert_last_change → ask/high (defaultPolicy)
 * Ownership:   packages/tools, packages/diff, packages/storage
 */

import { z } from "zod/v4";
import { ulid } from "ulid";
import { revertMutation } from "@agent-workbench/diff";
import type { ToolDefinition } from "@agent-workbench/protocol";
import type { RegisteredTool, ToolExecutor, ToolExecutionContext } from "../types";
import { assertSafePath } from "../path-guard";
import type { MutationToolOptions } from "../mutation-context";

// ── Input / Result schemas ────────────────────────────────────────────────────

export const RevertLastChangeInput = z.object({
  /** Relative or absolute path to revert. */
  path: z.string().min(1),
});
export type RevertLastChangeInput = z.infer<typeof RevertLastChangeInput>;

export const RevertLastChangeResult = z.object({
  path: z.string(),
  /** ULID of the original FileChange record that was reverted. */
  revertedChangeId: z.string(),
  /** ULID of the new FileChange record recording the revert itself. */
  revertChangeId: z.string(),
});
export type RevertLastChangeResult = z.infer<typeof RevertLastChangeResult>;

// ── Tool definition ──────────────────────────────────────────────────────────

const definition: ToolDefinition = {
  name: "revert_last_change",
  description:
    "Revert the most recent file mutation for the given path in the current session. " +
    "Requires permission approval. Aborts if the file has been modified since the " +
    "last recorded mutation (safety guard).",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path to revert (relative to project root).",
      },
    },
    required: ["path"],
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

export function createRevertLastChangeTool(
  options: MutationToolOptions
): RegisteredTool {
  const executor: ToolExecutor = {
    async execute(input: unknown, context: ToolExecutionContext): Promise<unknown> {
      const parsed = RevertLastChangeInput.safeParse(input);
      if (!parsed.success) {
        throw new Error(
          `revert_last_change: invalid input: ${parsed.error.message}`
        );
      }
      const { path: rawPath } = parsed.data;

      const resolvedPath = resolvePath(rawPath, context.projectRoot);
      assertSafePath(resolvedPath, context.projectRoot);

      // Look up the most recent change for this path in the session.
      const change = options.fileChangeRepository.findLatestByPath(
        context.sessionId,
        resolvedPath
      );

      if (change === undefined) {
        throw new Error(
          `revert_last_change: no recorded change found for ${rawPath} in this session`
        );
      }

      // Prevent reverting a revert (would create confusing loops).
      if (change.changeType === "revert") {
        throw new Error(
          `revert_last_change: the last recorded change for ${rawPath} is already a revert`
        );
      }

      // Attempt the revert via packages/diff.
      const result = await revertMutation(
        {
          path: resolvedPath,
          changeType: change.changeType,
          afterHash: change.afterHash,
          patch: change.patch,
        },
        context.projectRoot
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Persist a revert FileChange record.
      const revertChangeId = ulid();
      options.fileChangeRepository.create({
        id: revertChangeId,
        sessionId: context.sessionId,
        runId: context.runId,
        toolCallId: context.toolCallId,
        path: resolvedPath,
        changeType: "revert",
        beforeHash: change.afterHash,
        afterHash: result.afterHash,
        patch: change.patch ?? null,
        dryRunId: null,
        approvedByPermissionDecisionId: null,
        createdAt: new Date().toISOString(),
        metadataJson: JSON.stringify({ revertedChangeId: change.id }),
      });

      // Invalidate cache for the reverted path.
      options.toolCache?.invalidateAffectedByPath(
        context.sessionId,
        context.projectRoot,
        resolvedPath
      );

      return {
        path: resolvedPath,
        revertedChangeId: change.id,
        revertChangeId,
      } satisfies RevertLastChangeResult;
    },
  };

  return { definition, executor };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePath(rawPath: string, projectRoot: string): string {
  if (rawPath.startsWith("/")) return rawPath;
  return `${projectRoot}/${rawPath}`;
}
