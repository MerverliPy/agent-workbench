/**
 * registerReadOnlyTools — convenience function to register Phase 7 read-only
 * tools (read, grep, glob) into an existing ToolRegistry.
 *
 * Called from apps/server/src/index.ts during startup.
 * Phase 8 will add permission policies per tool.
 */

import type { ToolRegistry } from "./registry";
import { createReadTool } from "./tools/read";
import { createGrepTool } from "./tools/grep";
import { createGlobTool } from "./tools/glob";
import type { ToolCache } from "@agent-workbench/cache";

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
  options: RegisterReadOnlyToolsOptions = {}
): void {
  const toolOpts = options.cache !== undefined
    ? { cache: options.cache }
    : {};
  registry.register(createReadTool(toolOpts));
  registry.register(createGrepTool(toolOpts));
  registry.register(createGlobTool(toolOpts));
}
