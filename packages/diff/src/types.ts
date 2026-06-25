/**
 * Internal types for packages/diff.
 *
 * The shared DiffPreview protocol type lives in packages/protocol (schemas/file.ts)
 * and is re-exported from this package for convenience. These internal types
 * represent the normalised input shapes that the diff functions accept.
 */

/** Union of all file-mutation input shapes. */
export type DiffParams =
  | WriteDiffParams
  | EditDiffParams
  | ApplyPatchDiffParams;

/** Input shape for a full-file write (create or overwrite). */
export interface WriteDiffParams {
  type: "write";
  /** Absolute path to the target file. */
  path: string;
  /** Full new content to write. */
  content: string;
}

/** Input shape for a search-and-replace edit. */
export interface EditDiffParams {
  type: "edit";
  /** Absolute path to the target file. */
  path: string;
  /** Exact string to search for in the current file content. */
  oldString: string;
  /** Replacement string. */
  newString: string;
}

/** Input shape for applying a pre-computed unified diff patch. */
export interface ApplyPatchDiffParams {
  type: "apply_patch";
  /** Absolute path to the target file. */
  path: string;
  /** Unified diff patch string (--- / +++ format). */
  patch: string;
}

/** Result returned by applyMutation(). */
export interface ApplyResult {
  success: true;
  /** Resolved absolute path that was mutated. */
  path: string;
  /** Content hash before the mutation. undefined for new files. */
  beforeHash: string | undefined;
  /** Content hash after the mutation. */
  afterHash: string;
  /** Unified diff patch string representing the change. */
  patch: string;
  /** Number of lines added. */
  linesAdded: number;
  /** Number of lines removed. */
  linesRemoved: number;
}

/** Error result returned by applyMutation(). */
export interface ApplyError {
  success: false;
  error: string;
}

/** Result returned by revertMutation(). */
export interface RevertResult {
  success: true;
  /** Resolved absolute path that was reverted. */
  path: string;
  /** Content hash after reverting. */
  afterHash: string;
}

/** Error result returned by revertMutation(). */
export interface RevertError {
  success: false;
  error: string;
}

/** Input to revertMutation() — sourced from a FileChangeRow. */
export interface RevertInput {
  path: string;
  /** The changeType from the FileChangeRow. */
  changeType: string;
  /** Hash recorded when the change was originally applied (afterHash of the mutation). */
  afterHash: string | null | undefined;
  /** Unified diff patch stored in the FileChangeRow. */
  patch: string | null | undefined;
}

/** Result of a dry-run applicability check. */
export interface CanApplyResult {
  canApply: boolean;
  /** Populated when canApply is false. */
  reason?: string;
}
