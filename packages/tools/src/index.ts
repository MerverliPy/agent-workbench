// Public API for packages/tools

// Core types (updated in Phase 7 to add ToolExecutionContext)
export type { ToolExecutor, ToolExecutionContext, RegisteredTool } from "./types";

// Registry
export { ToolRegistry } from "./registry";

// Path safety utilities (used by tool implementations and optionally by core)
export { PathGuardError, isSensitivePath, assertSafePath, toRelativePath } from "./path-guard";

// Compression/truncation utilities
export {
  READ_MAX_LINES,
  GREP_MAX_MATCHES,
  GLOB_MAX_PATHS,
  GREP_EXCERPT_MAX_CHARS,
  truncateLines,
  truncateItems,
} from "./compress";
export type { LineTruncationMeta, ItemTruncationMeta } from "./compress";

// Read-only tool schemas and types (Phase 7)
export { ReadInput, ReadResult } from "./tools/read";
export type { ReadInput as ReadInputType, ReadResult as ReadResultType } from "./tools/read";
export { GrepInput, GrepResult } from "./tools/grep";
export type { GrepInput as GrepInputType, GrepResult as GrepResultType } from "./tools/grep";
export { GlobInput, GlobResult } from "./tools/glob";
export type { GlobInput as GlobInputType, GlobResult as GlobResultType } from "./tools/glob";

// Read-only tool factories (Phase 7)
export { createReadTool } from "./tools/read";
export { createGrepTool } from "./tools/grep";
export { createGlobTool } from "./tools/glob";

// Mutation tool schemas and types (Phase 9)
export { WriteInput, WriteResult } from "./tools/write";
export type { WriteInput as WriteInputType, WriteResult as WriteResultType } from "./tools/write";
export { EditInput, EditResult } from "./tools/edit";
export type { EditInput as EditInputType, EditResult as EditResultType } from "./tools/edit";
export { ApplyPatchInput, ApplyPatchResult } from "./tools/apply-patch";
export type {
  ApplyPatchInput as ApplyPatchInputType,
  ApplyPatchResult as ApplyPatchResultType,
} from "./tools/apply-patch";
export { DiffPreviewInput } from "./tools/diff-preview";
export type { DiffPreviewInput as DiffPreviewInputType } from "./tools/diff-preview";
export { RevertLastChangeInput, RevertLastChangeResult } from "./tools/revert-last-change";
export type {
  RevertLastChangeInput as RevertLastChangeInputType,
  RevertLastChangeResult as RevertLastChangeResultType,
} from "./tools/revert-last-change";

// Mutation tool factories (Phase 9)
export { createWriteTool } from "./tools/write";
export { createEditTool } from "./tools/edit";
export { createApplyPatchTool } from "./tools/apply-patch";
export { createDiffPreviewTool } from "./tools/diff-preview";
export { createRevertLastChangeTool } from "./tools/revert-last-change";

// Mutation tool shared options (Phase 9)
export type { MutationToolOptions } from "./mutation-context";

// Registration helpers
export { registerReadOnlyTools, registerMutationTools, registerShellTool } from "./register";
export type { RegisterReadOnlyToolsOptions } from "./register";

// Bash shell tool (Phase 10)
export { BashInput, BashResult, createBashTool } from "./tools/bash";
export type { BashInput as BashInputType, BashResult as BashResultType } from "./tools/bash";
export type { BashToolOptions } from "./tools/bash";
