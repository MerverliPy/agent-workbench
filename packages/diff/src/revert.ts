/**
 * Revert support for file mutations.
 *
 * Reverts a previously applied mutation by reversing its patch.
 * Uses the `reversePatch` utility from the `diff` package.
 *
 * Safety: before applying the inverse patch, the current file content hash
 * is compared against the afterHash recorded in the FileChange row. If the
 * hashes differ, the file has been modified since the recorded mutation and
 * reverting would be unsafe.
 *
 * Ownership: packages/diff — see decisions/0008.
 */

import { applyPatch, parsePatch, reversePatch } from "diff";
import type { RevertInput, RevertResult, RevertError } from "./types";

/**
 * Revert a previously applied file mutation.
 *
 * @param input       Revert parameters sourced from a FileChangeRow.
 * @param projectRoot Absolute project root (for path validation by callers).
 * @returns           RevertResult on success, RevertError on failure.
 */
export async function revertMutation(
  input: RevertInput,
  projectRoot: string
): Promise<RevertResult | RevertError> {
  void projectRoot; // callers must validate the path before calling this fn

  if (!input.patch) {
    return {
      success: false,
      error: "revert: no patch recorded for this file change",
    };
  }

  const file = Bun.file(input.path);
  const exists = await file.exists();
  if (!exists) {
    return {
      success: false,
      error: `revert: file not found: ${input.path}`,
    };
  }

  const currentContent = await file.text();

  // Safety check: if afterHash is available, verify current content matches
  // what was written. If the file was changed externally, reverting is unsafe.
  if (input.afterHash !== undefined && input.afterHash !== null) {
    const currentHash = contentHash(currentContent);
    if (currentHash !== input.afterHash) {
      return {
        success: false,
        error:
          "revert: file has been modified since the recorded mutation; revert aborted to prevent data loss",
      };
    }
  }

  try {
    const parsed = parsePatch(input.patch);
    if (parsed.length === 0) {
      return { success: false, error: "revert: patch could not be parsed" };
    }
    const reversed = reversePatch(parsed[0]!);
    const reverted = applyPatch(currentContent, reversed);
    if (reverted === false) {
      return {
        success: false,
        error: "revert: reversed patch does not apply cleanly",
      };
    }

    await Bun.write(input.path, reverted);

    return { success: true, path: input.path, afterHash: contentHash(reverted) };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Lightweight content hash for equality checks in the revert safety guard.
 * Not cryptographic — only used to detect unexpected modifications.
 *
 * Used by apply.ts and preview.ts (imported from this module) to ensure
 * beforeHash / afterHash values stored in FileChange rows are computed with
 * the same algorithm that revertMutation uses for its safety comparison.
 */
export function contentHash(content: string): string {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = (Math.imul(31, h) + content.charCodeAt(i)) | 0;
  }
  return `${content.length}:${h >>> 0}`;
}
