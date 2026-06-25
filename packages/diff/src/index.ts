// Public API for packages/diff

export type {
  DiffParams,
  WriteDiffParams,
  EditDiffParams,
  ApplyPatchDiffParams,
  ApplyResult,
  ApplyError,
  RevertResult,
  RevertError,
  RevertInput,
  CanApplyResult,
} from "./types";

export { generateDiffPreview, extractDiffParams } from "./preview";
export { applyMutation, canApplyPatch } from "./apply";
export { revertMutation, contentHash } from "./revert";
