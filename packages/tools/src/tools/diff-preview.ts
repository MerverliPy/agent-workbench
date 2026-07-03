/**
 * diff_preview tool — Phase 9.
 *
 * Generates a diff preview for a proposed mutation WITHOUT applying it.
 * Read-only: no file writes, no FileChange records, no cache invalidation.
 *
 * Useful for the model to inspect what a write/edit/apply_patch would produce
 * before committing to the mutation.
 *
 * Permissions: diff_preview → ask/medium (defaultPolicy)
 * Ownership:   packages/tools, packages/diff
 *
 * Note: permission is ask/medium per existing defaultPolicy; this keeps the
 * tool consistent with the overall mutation-first safety posture.
 */

import type { DiffParams } from "@agent-workbench/diff";
import { generateDiffPreview } from "@agent-workbench/diff";
import type { ToolDefinition } from "@agent-workbench/protocol";
import { z } from "zod/v4";
import { assertSafePath } from "../path-guard";
import type {
  RegisteredTool,
  ToolExecutionContext,
  ToolExecutor,
} from "../types";

// ── Input / Result schemas ────────────────────────────────────────────────────

export const DiffPreviewInput = z.object({
  /** Relative or absolute path to the target file. */
  path: z.string().min(1),
  /**
   * Full new content (for write-style preview).
   * Provide exactly one of: newContent, patch, or oldString+newString.
   */
  newContent: z.string().optional(),
  /** Unified diff patch string (for apply_patch-style preview). */
  patch: z.string().optional(),
  /** String to replace (for edit-style preview). */
  oldString: z.string().optional(),
  /** Replacement string (for edit-style preview). */
  newString: z.string().optional(),
});
export type DiffPreviewInput = z.infer<typeof DiffPreviewInput>;

// The result is the DiffPreview protocol type directly (from packages/protocol).
// No separate result schema needed here.

// ── Tool definition ──────────────────────────────────────────────────────────

const definition: ToolDefinition = {
  name: "diff_preview",
  description:
    "Generate a diff preview for a proposed mutation without applying it. " +
    "Provide one of: newContent (full write preview), patch (unified diff), " +
    "or oldString+newString (edit preview). No files are modified.",
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path to preview (relative to project root).",
      },
      newContent: {
        type: "string",
        description: "Full new content (write preview).",
      },
      patch: { type: "string", description: "Unified diff patch string." },
      oldString: {
        type: "string",
        description: "String to replace (edit preview).",
      },
      newString: {
        type: "string",
        description: "Replacement string (edit preview).",
      },
    },
    required: ["path"],
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────

/** diff_preview is read-only and has no MutationToolOptions dependencies. */
export function createDiffPreviewTool(): RegisteredTool {
  const executor: ToolExecutor = {
    async execute(
      input: unknown,
      context: ToolExecutionContext,
    ): Promise<unknown> {
      const parsed = DiffPreviewInput.safeParse(input);
      if (!parsed.success) {
        throw new Error(`diff_preview: invalid input: ${parsed.error.message}`);
      }
      const {
        path: rawPath,
        newContent,
        patch,
        oldString,
        newString,
      } = parsed.data;

      const resolvedPath = resolvePath(rawPath, context.projectRoot);
      assertSafePath(resolvedPath, context.projectRoot);

      const params = buildParams(
        resolvedPath,
        newContent,
        patch,
        oldString,
        newString,
      );
      if (params === undefined) {
        throw new Error(
          "diff_preview: provide one of newContent, patch, or oldString+newString",
        );
      }

      // Generates preview without writing any file.
      return await generateDiffPreview(params, context.projectRoot);
    },
  };

  return { definition, executor };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePath(rawPath: string, projectRoot: string): string {
  if (rawPath.startsWith("/")) return rawPath;
  return `${projectRoot}/${rawPath}`;
}

function buildParams(
  path: string,
  newContent?: string,
  patch?: string,
  oldString?: string,
  newString?: string,
): DiffParams | undefined {
  if (newContent !== undefined) {
    return { type: "write", path, content: newContent };
  }
  if (patch !== undefined) {
    return { type: "apply_patch", path, patch };
  }
  if (oldString !== undefined && newString !== undefined) {
    return { type: "edit", path, oldString, newString };
  }
  return undefined;
}
