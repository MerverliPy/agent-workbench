// Public API for packages/tools

export type { ItemTruncationMeta, LineTruncationMeta } from "./compress";
// Compression/truncation utilities
export {
  GLOB_MAX_PATHS,
  GREP_EXCERPT_MAX_CHARS,
  GREP_MAX_MATCHES,
  READ_MAX_LINES,
  truncateItems,
  truncateLines,
} from "./compress";
// Mutation tool shared options (Phase 9)
export type { MutationToolOptions } from "./mutation-context";
// Path safety utilities (used by tool implementations and optionally by core)
export {
  assertSafePath,
  isSensitivePath,
  PathGuardError,
  toRelativePath,
} from "./path-guard";
export type { RegisterReadOnlyToolsOptions } from "./register";
// Registration helpers
export {
  registerMutationTools,
  registerPtyShellTool,
  registerReadOnlyTools,
  registerShellTool,
} from "./register";
// Registry
export { ToolRegistry } from "./registry";
export type {
  ApplyPatchInput as ApplyPatchInputType,
  ApplyPatchResult as ApplyPatchResultType,
} from "./tools/apply-patch";
export {
  ApplyPatchInput,
  ApplyPatchResult,
  createApplyPatchTool,
} from "./tools/apply-patch";
export type {
  BashInput as BashInputType,
  BashResult as BashResultType,
  BashToolOptions,
} from "./tools/bash";
// Bash shell tool (Phase 10)
export { BashInput, BashResult, createBashTool } from "./tools/bash";
export type { DiffPreviewInput as DiffPreviewInputType } from "./tools/diff-preview";
export { createDiffPreviewTool, DiffPreviewInput } from "./tools/diff-preview";
export type {
  EditInput as EditInputType,
  EditResult as EditResultType,
} from "./tools/edit";
export { createEditTool, EditInput, EditResult } from "./tools/edit";
export type {
  GlobInput as GlobInputType,
  GlobResult as GlobResultType,
} from "./tools/glob";
export { createGlobTool, GlobInput, GlobResult } from "./tools/glob";
export type {
  GrepInput as GrepInputType,
  GrepResult as GrepResultType,
} from "./tools/grep";
export { createGrepTool, GrepInput, GrepResult } from "./tools/grep";
export type {
  PtyShellInput as PtyShellInputType,
  PtyShellResult as PtyShellResultType,
  PtyShellToolOptions,
} from "./tools/pty-shell";
// PTY shell tool (Phase 23)
export {
  createPtyShellTool,
  PtyShellInput,
  PtyShellResult,
} from "./tools/pty-shell";
export type {
  ReadInput as ReadInputType,
  ReadResult as ReadResultType,
} from "./tools/read";
// Read-only tool schemas and types (Phase 7)
// Read-only tool factories (Phase 7)
export { createReadTool, ReadInput, ReadResult } from "./tools/read";
export type {
  RevertLastChangeInput as RevertLastChangeInputType,
  RevertLastChangeResult as RevertLastChangeResultType,
} from "./tools/revert-last-change";
export {
  createRevertLastChangeTool,
  RevertLastChangeInput,
  RevertLastChangeResult,
} from "./tools/revert-last-change";
export type {
  WriteInput as WriteInputType,
  WriteResult as WriteResultType,
} from "./tools/write";
// Mutation tool schemas and types (Phase 9)
// Mutation tool factories (Phase 9)
export { createWriteTool, WriteInput, WriteResult } from "./tools/write";
// Core types (updated in Phase 7 to add ToolExecutionContext)
export type {
  RegisteredTool,
  ToolExecutionContext,
  ToolExecutor,
} from "./types";
