import type { ToolDefinition } from "@agent-workbench/protocol";

/**
 * Runtime context injected into every tool execution call.
 *
 * Phase 7 adds projectRoot (from session.projectPath) so that tools can
 * enforce project-root boundaries without requiring direct storage access.
 *
 * NOTE: Phase 8 will add permission context here.
 * NOTE: Phase 11 will add agent context here.
 */
export interface ToolExecutionContext {
  /** ULID of the active session. */
  sessionId: string;
  /** ULID of the current run. */
  runId: string;
  /** ULID of the tool call record in storage. */
  toolCallId: string;
  /**
   * Absolute path to the project root directory.
   * Sourced from session.projectPath at dispatch time.
   */
  projectRoot: string;
  /** Abort signal forwarded from the run's AbortController. */
  signal?: AbortSignal;
  /** Phase 10: stdout chunk callback for shell tools. */
  onStdout?: (chunk: string) => void;
  /** Phase 10: stderr chunk callback for shell tools. */
  onStderr?: (chunk: string) => void;
}

/**
 * The execution contract every tool implementation must satisfy.
 *
 * Phase 7 updates the signature to require ToolExecutionContext so that tools
 * can enforce project-root boundaries, use the cache, and be associated with
 * audit records.
 *
 * NOTE: Phase 8 will insert a permission check before `execute()` is called.
 * For Phase 7 the read-only tools are treated as auto-allowed.
 */
export interface ToolExecutor {
  execute(input: unknown, context: ToolExecutionContext): Promise<unknown>;
}

/**
 * A complete, registered tool: its protocol definition plus its executor.
 */
export interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
}
