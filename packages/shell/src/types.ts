import type { RiskLevel } from "@agent-workbench/protocol";

export const MAX_STDOUT_BYTES = 100_000;
export const MAX_STDERR_BYTES = 50_000;
export const DEFAULT_TIMEOUT_MS = 120_000;
export const MAX_TIMEOUT_MS = 300_000;

export interface ShellRunOptions {
  command: string;
  cwd: string;
  timeout?: number;
  signal?: AbortSignal;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface ShellResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  exitSignal: string | null;
}

export interface CommandPreview {
  rawCommand: string;
  normalized: string;
  cwd: string;
  baseBinary: string;
  riskLevel: RiskLevel;
  matchedRules: string[];
  requiresApproval: boolean;
}
