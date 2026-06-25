/**
 * File mutation application — applies write/edit/apply_patch operations.
 *
 * Each function reads the current file state, applies the mutation, and
 * returns rich metadata for ledger/FileChange persistence.
 *
 * Ownership: packages/diff — see decisions/0008.
 * No TUI dependency. No permission logic. Does not call the permission engine.
 */

import { createTwoFilesPatch, applyPatch } from "diff";
import { contentHash } from "./revert";
import type { DiffParams, ApplyResult, ApplyError, CanApplyResult } from "./types";


/**
 * Apply a file mutation described by DiffParams.
 *
 * Writes to the filesystem. Must only be called AFTER permission approval.
 * Returns ApplyResult on success, ApplyError on failure.
 *
 * Does NOT bypass path safety — callers must validate the path with
 * packages/tools assertSafePath() before calling this function.
 */
export async function applyMutation(
  params: DiffParams,
  projectRoot: string
): Promise<ApplyResult | ApplyError> {
  const relPath = toRelPath(params.path, projectRoot);

  try {
    switch (params.type) {
      case "write":
        return await applyWrite(params.path, params.content, relPath);
      case "edit":
        return await applyEdit(
          params.path,
          params.oldString,
          params.newString,
          relPath
        );
      case "apply_patch":
        return await applyUnifiedPatch(params.path, params.patch, relPath);
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check whether a patch string can be applied to the current file content
 * without actually writing.
 *
 * Used as part of the dry-run applicability check. Safe to call before
 * permission evaluation.
 */
export async function canApplyPatch(
  filePath: string,
  patch: string
): Promise<CanApplyResult> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    return { canApply: false, reason: `File not found: ${filePath}` };
  }
  const content = await file.text();
  const result = applyPatch(content, patch);
  if (result === false) {
    return {
      canApply: false,
      reason: "Patch does not apply cleanly (context mismatch or conflict)",
    };
  }
  return { canApply: true };
}

// ── Internal implementations ─────────────────────────────────────────────────

async function applyWrite(
  filePath: string,
  content: string,
  relPath: string
): Promise<ApplyResult> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  const beforeContent = exists ? await file.text() : "";
  const beforeHash = exists ? contentHash(beforeContent) : undefined;

  await Bun.write(filePath, content);

  const afterHash = contentHash(content);
  const patch = createTwoFilesPatch(
    relPath,
    relPath,
    beforeContent,
    content,
    "(before)",
    "(after)"
  );
  const { linesAdded, linesRemoved } = countDiffLines(patch);

  return {
    success: true,
    path: filePath,
    beforeHash,
    afterHash,
    patch,
    linesAdded,
    linesRemoved,
  };
}

async function applyEdit(
  filePath: string,
  oldString: string,
  newString: string,
  relPath: string
): Promise<ApplyResult> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  if (!exists) {
    throw new Error(`edit: file not found: ${filePath}`);
  }

  const beforeContent = await file.text();
  if (!beforeContent.includes(oldString)) {
    throw new Error(`edit: oldString not found in ${relPath}`);
  }

  const beforeHash = contentHash(beforeContent);
  const afterContent = beforeContent.replace(oldString, newString);
  await Bun.write(filePath, afterContent);

  const afterHash = contentHash(afterContent);
  const patch = createTwoFilesPatch(
    relPath,
    relPath,
    beforeContent,
    afterContent,
    "(before)",
    "(after)"
  );
  const { linesAdded, linesRemoved } = countDiffLines(patch);

  return {
    success: true,
    path: filePath,
    beforeHash,
    afterHash,
    patch,
    linesAdded,
    linesRemoved,
  };
}

async function applyUnifiedPatch(
  filePath: string,
  patch: string,
  relPath: string
): Promise<ApplyResult> {
  const file = Bun.file(filePath);
  const exists = await file.exists();
  const beforeContent = exists ? await file.text() : "";
  const beforeHash = exists ? contentHash(beforeContent) : undefined;

  const afterContent = applyPatch(beforeContent, patch);
  if (afterContent === false) {
    throw new Error(
      `apply_patch: patch does not apply cleanly to ${relPath}`
    );
  }

  await Bun.write(filePath, afterContent);
  const afterHash = contentHash(afterContent);
  const { linesAdded, linesRemoved } = countDiffLines(patch);

  return {
    success: true,
    path: filePath,
    beforeHash,
    afterHash,
    patch,
    linesAdded,
    linesRemoved,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function countDiffLines(patch: string): {
  linesAdded: number;
  linesRemoved: number;
} {
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) linesAdded++;
    else if (line.startsWith("-") && !line.startsWith("---")) linesRemoved++;
  }
  return { linesAdded, linesRemoved };
}

function toRelPath(absPath: string, projectRoot: string): string {
  if (absPath.startsWith(projectRoot)) {
    return absPath.slice(projectRoot.length).replace(/^\//, "");
  }
  return absPath;
}
