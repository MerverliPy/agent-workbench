import type { ToolRegistry, ToolExecutionContext } from "@agent-workbench/tools";
import type { ToolCallRequest, ToolCallResult } from "./types";

/**
 * Dispatches tool calls requested by the model to registered tool executors.
 *
 * Phase 7 change: `dispatch()` now receives a `ToolExecutionContext` built by
 * `SessionRunner` and passes it through to `executor.execute()`. This allows
 * tools to enforce project-root boundaries, use the cache, and be associated
 * with audit records without needing direct storage access.
 *
 * Phase 6 behaviour (unchanged):
 *  - If the tool is registered, execute it and return the result.
 *  - If the tool is NOT registered, return a structured error result so the
 *    model/tool loop can inform the model and continue gracefully.
 *
 * NOTE — Phase 8 permission check location:
 *   Before calling executor.execute() below a permission check will be
 *   inserted (packages/permissions). The check will evaluate the tool call
 *   against the active session's policy and may return "ask" (pause the run
 *   and emit a permission request event) or "deny" (return a denied error
 *   result without executing). For Phase 7 all registered read-only tool calls
 *   are treated as auto-allowed.
 */
export class ToolCallDispatcher {
  constructor(private readonly registry: ToolRegistry) {}

  /**
   * Dispatch a single tool call.
   *
   * @param request  Parsed tool call from the model.
   * @param context  Execution context (sessionId, runId, toolCallId, projectRoot, signal).
   */
  async dispatch(
    request: ToolCallRequest,
    context: ToolExecutionContext
  ): Promise<ToolCallResult> {
    const tool = this.registry.lookup(request.name);

    if (tool === undefined) {
      return {
        id: request.id,
        modelCallId: request.modelCallId,
        name: request.name,
        result: null,
        error: `Tool "${request.name}" is not registered.`,
      };
    }

    // TODO(Phase 8): Insert permission engine check here before execution.

    try {
      const result = await tool.executor.execute(request.input, context);
      return {
        id: request.id,
        modelCallId: request.modelCallId,
        name: request.name,
        result,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown tool execution error";
      return {
        id: request.id,
        modelCallId: request.modelCallId,
        name: request.name,
        result: null,
        error: message,
      };
    }
  }
}
