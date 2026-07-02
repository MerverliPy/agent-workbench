/**
 * Tool plugin extension interface.
 *
 * Plugins can register custom tools that extend the agent's capabilities.
 * Each tool plugin provides a name, description, parameter schema, and
 * an execute function.
 */

import type { z } from "zod/v4";

/** A tool definition provided by a plugin. */
export interface PluginTool {
  /** Unique tool name (e.g. "github.create_issue"). */
  readonly name: string;
  /** Human-readable description shown to the model. */
  readonly description: string;
  /** Zod schema for the tool's input parameters. */
  readonly parameters: z.ZodType;
  /** Whether the tool mutates files or external state. */
  readonly isMutation: boolean;
  /** Risk level for permission evaluation. */
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  /** Execute the tool with validated input. Returns a result object. */
  execute(input: Record<string, unknown>): Promise<PluginToolResult>;
}

/** Result returned by a plugin tool execution. */
export interface PluginToolResult {
  /** Output content (displayed to the model and user). */
  readonly content: string;
  /** Optional structured data for downstream processing. */
  readonly data?: Record<string, unknown>;
  /** Whether the execution succeeded. */
  readonly success: boolean;
  /** Error message if execution failed. */
  readonly error?: string;
}

/** Interface that tool plugins must export as their default export. */
export interface ToolPlugin {
  /** Plugin metadata. */
  readonly name: string;
  readonly version: string;
  /** Tools provided by this plugin. */
  readonly tools: PluginTool[];
}
