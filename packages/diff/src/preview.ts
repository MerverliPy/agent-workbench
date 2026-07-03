/**
 * Diff preview generation for file mutation tools.
 *
 * Computes a unified diff patch from a DiffParams descriptor without writing
 * to the filesystem. Satisfies the dry-run requirement from docs/14 §7:
 * preview must be available before permission evaluation.
 *
 * Ownership: packages/diff — see docs/03 §11 and decisions/0008.
 */

import type { DiffPreview } from "@agent-workbench/protocol";
import { applyPatch, createTwoFilesPatch } from "diff";
import { ulid } from "ulid";
import { contentHash } from "./revert";
import type { DiffParams } from "./types";

/**
 * Generate a DiffPreview for the given mutation without applying it.
 *
 * For write: computes diff between existing content (or empty) and new content.
 * For edit: reads existing content, performs the replacement, diffs.
 * For apply_patch: checks applicability, returns the patch itself as the preview.
 *
 * Does NOT write to any file. Safe to call before permission evaluation.
 *
 * @param params     Normalised mutation input.
 * @param projectRoot  Absolute project root (used for relative path display only).
 * @returns          DiffPreview protocol object.
 * @throws           If the file cannot be read for edit/apply_patch, or if the
 *                   edit oldString is not found.
 */
export async function generateDiffPreview(
  params: DiffParams,
  projectRoot: string,
): Promise<DiffPreview> {
  const now = new Date().toISOString();
  const relPath = toRelPath(params.path, projectRoot);

  switch (params.type) {
    case "write": {
      const { beforeContent, beforeHash } = await readExisting(params.path);
      const after = params.content;
      const patch = createTwoFilesPatch(
        relPath,
        relPath,
        beforeContent,
        after,
        "(before)",
        "(after)",
      );
      const { linesAdded, linesRemoved } = countDiffLines(patch);
      const afterHash = contentHash(after);
      return {
        id: ulid(),
        path: params.path,
        patch,
        beforeHash,
        afterHash,
        linesAdded,
        linesRemoved,
        createdAt: now,
      };
    }

    case "edit": {
      const { beforeContent, beforeHash } = await readExisting(params.path);
      if (!beforeContent.includes(params.oldString)) {
        throw new Error(`edit: oldString not found in ${relPath}`);
      }
      const after = beforeContent.replace(params.oldString, params.newString);
      const patch = createTwoFilesPatch(
        relPath,
        relPath,
        beforeContent,
        after,
        "(before)",
        "(after)",
      );
      const { linesAdded, linesRemoved } = countDiffLines(patch);
      const afterHash = contentHash(after);
      return {
        id: ulid(),
        path: params.path,
        patch,
        beforeHash,
        afterHash,
        linesAdded,
        linesRemoved,
        createdAt: now,
      };
    }

    case "apply_patch": {
      const { beforeContent, beforeHash } = await readExisting(params.path);
      // Verify applicability.
      const applied = applyPatch(beforeContent, params.patch);
      if (applied === false) {
        throw new Error(
          `apply_patch: patch does not apply cleanly to ${relPath}`,
        );
      }
      const { linesAdded, linesRemoved } = countDiffLines(params.patch);
      const afterHash = contentHash(applied);
      return {
        id: ulid(),
        path: params.path,
        patch: params.patch,
        beforeHash,
        afterHash,
        linesAdded,
        linesRemoved,
        createdAt: now,
      };
    }
  }
}

/**
 * Extract a DiffParams object from a raw tool call input.
 *
 * Returns undefined when the input is not an object or does not contain
 * enough information to form a DiffParams. Used by session-runner to
 * generate a diff preview before the permission gate.
 *
 * Does not throw — caller decides how to handle undefined.
 */
export function extractDiffParams(
  toolName: string,
  input: unknown,
): DiffParams | undefined {
  if (input === null || typeof input !== "object") return undefined;
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case "write": {
      if (typeof obj.path === "string" && typeof obj.content === "string") {
        return { type: "write", path: obj.path, content: obj.content };
      }
      return undefined;
    }
    case "edit": {
      if (
        typeof obj.path === "string" &&
        typeof obj.oldString === "string" &&
        typeof obj.newString === "string"
      ) {
        return {
          type: "edit",
          path: obj.path,
          oldString: obj.oldString,
          newString: obj.newString,
        };
      }
      return undefined;
    }
    case "apply_patch": {
      if (typeof obj.path === "string" && typeof obj.patch === "string") {
        return { type: "apply_patch", path: obj.path, patch: obj.patch };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function readExisting(
  path: string,
): Promise<{ beforeContent: string; beforeHash: string | undefined }> {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) {
    return { beforeContent: "", beforeHash: undefined };
  }
  const beforeContent = await file.text();
  return { beforeContent, beforeHash: contentHash(beforeContent) };
}

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
