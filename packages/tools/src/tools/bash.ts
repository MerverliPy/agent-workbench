import type { ToolDefinition } from "@agent-workbench/protocol";
import type { SimpleCommandRunner } from "@agent-workbench/shell";
import { DEFAULT_TIMEOUT_MS } from "@agent-workbench/shell";
import { z } from "zod";
import type { RegisteredTool, ToolExecutionContext } from "../types";

export const BashInput = z.object({
  command: z.string().min(1, "command is required"),
  timeout: z.number().int().positive().max(300_000).optional(),
  cwd: z.string().optional(),
});
export type BashInput = z.infer<typeof BashInput>;

export const BashResult = z.object({
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  timedOut: z.boolean(),
  truncated: z.boolean(),
  exitSignal: z.string().nullable(),
});
export type BashResult = z.infer<typeof BashResult>;

const DEFINITION: ToolDefinition = {
  name: "bash",
  description:
    "Execute a shell command within the project directory. " +
    "Commands are subject to permission checks, risk classification, " +
    "timeout limits, and output truncation. Destructive commands are denied by default. " +
    "Interactive commands may not work as this uses a simple (non-PTY) runner.",
  inputSchema: BashInput.shape,
  outputSchema: BashResult.shape,
};

export interface BashToolOptions {
  shellRunner: SimpleCommandRunner;
}

export function createBashTool(options: BashToolOptions): RegisteredTool {
  return {
    definition: DEFINITION,
    executor: {
      async execute(
        input: unknown,
        context: ToolExecutionContext,
      ): Promise<BashResult> {
        const parsed = BashInput.safeParse(input);
        if (!parsed.success) {
          throw new Error(`Invalid bash input: ${parsed.error.message}`);
        }
        const { command, timeout, cwd } = parsed.data;

        const effectiveCwd = cwd ?? context.projectRoot;
        const effectiveTimeout = timeout ?? DEFAULT_TIMEOUT_MS;

        const result = await options.shellRunner.run({
          command,
          cwd: effectiveCwd,
          timeout: effectiveTimeout,
          ...(context.signal !== undefined ? { signal: context.signal } : {}),
          ...(context.onStdout !== undefined
            ? { onStdout: context.onStdout }
            : {}),
          ...(context.onStderr !== undefined
            ? { onStderr: context.onStderr }
            : {}),
        });

        return {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          timedOut: result.timedOut,
          truncated: result.truncated,
          exitSignal: result.exitSignal,
        };
      },
    },
  };
}
