import type { ToolDefinition } from "@agent-workbench/protocol";
import type { RegisteredTool, ToolExecutor } from "./types";

/**
 * Central registry for all available tools.
 *
 * Phase 6: bootstrapped empty. Phase 7 will register read, grep, and glob
 * tools here. The registry is intentionally mutable so phase transitions can
 * add tools without replacing the instance.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  /** Register a tool. Replaces any existing tool with the same name. */
  register(tool: RegisteredTool): void {
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Register a tool inline without pre-building a RegisteredTool object.
   * Convenience helper for testing and server startup.
   */
  registerInline(definition: ToolDefinition, executor: ToolExecutor): void {
    this.register({ definition, executor });
  }

  /** Look up a tool by name. Returns `undefined` if not registered. */
  lookup(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** List all registered tool definitions (no executors exposed). */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** Number of registered tools. */
  get size(): number {
    return this.tools.size;
  }
}
