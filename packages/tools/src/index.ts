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

// Tool schemas and types
export { ReadInput, ReadResult } from "./tools/read";
export type { ReadInput as ReadInputType, ReadResult as ReadResultType } from "./tools/read";
export { GrepInput, GrepResult } from "./tools/grep";
export type { GrepInput as GrepInputType, GrepResult as GrepResultType } from "./tools/grep";
export { GlobInput, GlobResult } from "./tools/glob";
export type { GlobInput as GlobInputType, GlobResult as GlobResultType } from "./tools/glob";

// Tool factories
export { createReadTool } from "./tools/read";
export { createGrepTool } from "./tools/grep";
export { createGlobTool } from "./tools/glob";

// Registration helper
export { registerReadOnlyTools } from "./register";
export type { RegisterReadOnlyToolsOptions } from "./register";
