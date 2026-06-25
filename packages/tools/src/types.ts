import type { ToolDefinition } from "@agent-workbench/protocol";

/**
 * The execution contract every tool implementation must satisfy.
 *
 * Phase 6 ships no concrete implementations — the registry is bootstrapped
 * empty. Phase 7 will add read, grep, and glob bodies.
 *
 * NOTE: Phase 8 will insert a permission check before `execute()` is called.
 * For Phase 6 the read-only tool path is orchestration-only and treated as
 * auto-allowed (see packages/core/src/tool-dispatcher.ts).
 */
export interface ToolExecutor {
  execute(input: unknown, signal?: AbortSignal): Promise<unknown>;
}

/**
 * A complete, registered tool: its protocol definition plus its executor.
 */
export interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}
