/**
 * registerReadOnlyTools — convenience function to register Phase 7 read-only
 * tools (read, grep, glob) into an existing ToolRegistry.
 *
 * Called from apps/server/src/index.ts during startup.
 * Phase 8 will add permission policies per tool.
 */

import type { ToolCache } from "@agent-workbench/cache";
import type { MutationToolOptions } from "./mutation-context";
import type { ToolRegistry } from "./registry";
import { createApplyPatchTool } from "./tools/apply-patch";
// Phase 10 bash tool
import { type BashToolOptions, createBashTool } from "./tools/bash";
import { createDiffPreviewTool } from "./tools/diff-preview";
import { createEditTool } from "./tools/edit";
import { createGlobTool } from "./tools/glob";
import { createGrepTool } from "./tools/grep";
// Phase 23 PTY shell tool
import {
  createPtyShellTool,
  type PtyShellToolOptions,
} from "./tools/pty-shell";
import { createReadTool } from "./tools/read";
import { createRevertLastChangeTool } from "./tools/revert-last-change";
// Phase 9 mutation tools
import { createWriteTool } from "./tools/write";

export interface RegisterReadOnlyToolsOptions {
  /** Optional session-scoped cache for read/grep/glob results. */
  cache?: ToolCache;
}

/**
 * Register the read, grep, and glob tools into `registry`.
 *
 * @param registry  The ToolRegistry instance (from packages/tools).
 * @param options   Optional shared options (cache, etc.).
 */
export function registerReadOnlyTools(
  registry: ToolRegistry,
  options: RegisterReadOnlyToolsOptions = {},
): void {
  const toolOpts = options.cache !== undefined ? { cache: options.cache } : {};
  registry.register(createReadTool(toolOpts));
  registry.register(createGrepTool(toolOpts));
  registry.register(createGlobTool(toolOpts));
}

/**
 * Register the Phase 9 file mutation tools into `registry`.
 *
 * write, edit, apply_patch — apply mutations with diff preview + permission gate.
 * diff_preview — read-only preview without applying any mutation.
 * revert_last_change — revert the most recent session mutation for a path.
 *
 * @param registry  The ToolRegistry instance.
 * @param options   Required mutation dependencies (fileChangeRepository, optional toolCache).
 */
export function registerMutationTools(
  registry: ToolRegistry,
  options: MutationToolOptions,
): void {
  registry.register(createWriteTool(options));
  registry.register(createEditTool(options));
  registry.register(createApplyPatchTool(options));
  registry.register(createDiffPreviewTool());
  registry.register(createRevertLastChangeTool(options));
}

/**
 * Register the Phase 10 bash shell tool into `registry`.
 *
 * @param registry  The ToolRegistry instance.
 * @param options   Required shell runner dependency.
 */
export function registerShellTool(
  registry: ToolRegistry,
  options: BashToolOptions,
): void {
  registry.register(createBashTool(options));
}

/**
 * Register the Phase 23 PTY shell tool into `registry`.
 */
export function registerPtyShellTool(
  registry: ToolRegistry,
  options: PtyShellToolOptions,
): void {
  registry.register(createPtyShellTool(options));
}
