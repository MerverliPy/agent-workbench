import type { ToolDefinition } from "@agent-workbench/protocol";
import type { PtyCommandRunner } from "@agent-workbench/shell";
import { z } from "zod";
import type { RegisteredTool, ToolExecutionContext } from "../types";

export const PtyShellInput = z.object({
  command: z.string().min(1, "command is required"),
  timeout: z.number().int().positive().max(600_000).optional(),
  cwd: z.string().optional(),
});
export type PtyShellInput = z.infer<typeof PtyShellInput>;

export const PtyShellResult = z.object({
  exitCode: z.number().int().nullable(),
  output: z.string(),
  stderr: z.string(),
  timedOut: z.boolean(),
  truncated: z.boolean(),
});
export type PtyShellResult = z.infer<typeof PtyShellResult>;

const DEFINITION: ToolDefinition = {
  name: "pty-shell",
  description:
    "Execute an interactive shell command in a pseudo-terminal (PTY). " +
    "Supports interactive programs like vim, nano, python REPL, node REPL, " +
    "htop, and long-running watchers. Commands are permission-gated (same as bash). " +
    "Output is NOT persisted in the run ledger — only exit code and summary metadata.",
  inputSchema: PtyShellInput.shape,
  outputSchema: PtyShellResult.shape,
};

export interface PtyShellToolOptions {
  ptyRunner: PtyCommandRunner;
}

export function createPtyShellTool(
  options: PtyShellToolOptions,
): RegisteredTool {
  return {
    definition: DEFINITION,
    executor: {
      async execute(
        input: unknown,
        context: ToolExecutionContext,
      ): Promise<PtyShellResult> {
        const parsed = PtyShellInput.safeParse(input);
        if (!parsed.success) {
          throw new Error(`Invalid pty-shell input: ${parsed.error.message}`);
        }
        const { command, timeout, cwd } = parsed.data;

        const effectiveCwd = cwd ?? context.projectRoot;

        const result = await options.ptyRunner.run({
          command,
          cwd: effectiveCwd,
          ...(timeout !== undefined ? { timeout } : {}),
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
          output: result.stdout,
          stderr: result.stderr,
          timedOut: result.timedOut,
          truncated: result.truncated,
        };
      },
    },
  };
}
