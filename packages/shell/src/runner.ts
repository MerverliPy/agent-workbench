import { redactSecrets } from "./redact";
import type { ShellResult, ShellRunOptions } from "./types";
import {
  DEFAULT_TIMEOUT_MS,
  MAX_STDERR_BYTES,
  MAX_STDOUT_BYTES,
  MAX_TIMEOUT_MS,
} from "./types";

const encoder = new TextEncoder();

function byteLength(s: string): number {
  return encoder.encode(s).length;
}

export class SimpleCommandRunner {
  async run(opts: ShellRunOptions): Promise<ShellResult> {
    const effectiveTimeout = Math.min(
      opts.timeout ?? DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );

    let stdoutBuf = "";
    let stderrBuf = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;
    let timedOut = false;

    const proc = Bun.spawn(["sh", "-c", opts.command], {
      cwd: opts.cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...Bun.env, PATH: Bun.env.PATH ?? "/usr/bin:/bin" },
    });

    const timeoutId =
      effectiveTimeout > 0
        ? setTimeout(() => {
            timedOut = true;
            proc.kill("SIGTERM");
            setTimeout(() => {
              if (proc.exitCode === null && proc.killed === false) {
                proc.kill("SIGKILL");
              }
            }, 3000);
          }, effectiveTimeout)
        : undefined;

    const abortHandler = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (proc.exitCode === null && proc.killed === false) {
          proc.kill("SIGKILL");
        }
      }, 3000);
    };

    opts.signal?.addEventListener("abort", abortHandler, { once: true });

    try {
      const stdoutReader = proc.stdout.getReader();
      const stderrReader = proc.stderr.getReader();

      let stdoutDone = false;
      let stderrDone = false;

      while (!stdoutDone || !stderrDone) {
        const reads: Promise<void>[] = [];

        if (!stdoutDone) {
          reads.push(
            stdoutReader.read().then((result) => {
              if (result.done) {
                stdoutDone = true;
                return;
              }
              const chunk = new TextDecoder().decode(result.value);
              const redacted = redactSecrets(chunk);
              stdoutBytes += byteLength(redacted);
              if (stdoutBytes > MAX_STDOUT_BYTES) {
                if (!truncated) truncated = true;
                return;
              }
              stdoutBuf += redacted;
              opts.onStdout?.(redacted);
            }),
          );
        }

        if (!stderrDone) {
          reads.push(
            stderrReader.read().then((result) => {
              if (result.done) {
                stderrDone = true;
                return;
              }
              const chunk = new TextDecoder().decode(result.value);
              const redacted = redactSecrets(chunk);
              stderrBytes += byteLength(redacted);
              if (stderrBytes > MAX_STDERR_BYTES) {
                if (!truncated) truncated = true;
                return;
              }
              stderrBuf += redacted;
              opts.onStderr?.(redacted);
            }),
          );
        }

        if (reads.length === 0) break;
        await Promise.all(reads);
      }
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      opts.signal?.removeEventListener("abort", abortHandler);
    }

    const exitCode = proc.exitCode;
    const exitSignal = proc.killed
      ? proc.signalCode
        ? String(proc.signalCode)
        : "SIGKILL"
      : null;

    return {
      exitCode,
      stdout: stdoutBuf.slice(0, MAX_STDOUT_BYTES),
      stderr: stderrBuf.slice(0, MAX_STDERR_BYTES),
      timedOut,
      truncated,
      exitSignal,
    };
  }
}
