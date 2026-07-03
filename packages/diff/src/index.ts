// Public API for packages/diff

export { applyMutation, canApplyPatch } from "./apply";

export { extractDiffParams, generateDiffPreview } from "./preview";
export { contentHash, revertMutation } from "./revert";
export type {
  ApplyError,
  ApplyPatchDiffParams,
  ApplyResult,
  CanApplyResult,
  DiffParams,
  EditDiffParams,
  RevertError,
  RevertInput,
  RevertResult,
  WriteDiffParams,
} from "./types";
