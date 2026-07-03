import { PtyOutputBuffer } from "./pty-output-buffer";
import {
  createPtyResizeHandler,
  DEFAULT_PTY_SIZE,
  type PtyResizeHandler,
  type PtySize,
} from "./pty-resize";
import { redactSecrets } from "./redact";
import type { ShellResult, ShellRunOptions } from "./types";
import { DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS } from "./types";

const encoder = new TextEncoder();

function _byteLength(s: string): number {
  return encoder.encode(s).length;
}

/**
 * PTY-based command runner using the system `script` command.
 *
 * Bun's native `Bun.spawn()` does not create pseudo-terminals, so
 * interactive programs (vim, python REPL, less, htop) won't work.
 * This runner wraps commands in `/usr/bin/script` to allocate a PTY,
 * enabling full interactive terminal support.
 *
 * Architecture boundaries:
 *  - PTY output is buffered (not stored in the ledger unbounded)
 *  - Output is streamed via onStdout/onStderr callbacks
 *  - Resize events propagate ANSI escape sequences to the child
 *  - Abort/timeout sends signals to the foreground process group
 */
export class PtyCommandRunner {
  private readonly outputBuffer = new PtyOutputBuffer();
  private currentSize: PtySize = DEFAULT_PTY_SIZE;

  /**
   * Run a command in a PTY, enabling interactive terminal programs.
   *
   * Uses `/usr/bin/script -q -c "<command>" /dev/null` to allocate a PTY.
   * Falls back to SimpleCommandRunner behavior if `script` is unavailable.
   */
  async run(
    opts: ShellRunOptions & { onResize?: (handler: PtyResizeHandler) => void },
  ): Promise<ShellResult> {
    const effectiveTimeout = Math.min(
      opts.timeout ?? DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );

    this.outputBuffer.clear();
    let _stdoutBuf = "";
    let stderrBuf = "";
    let timedOut = false;
    let exitSignal: string | null = null;

    // Build the PTY-wrapped command using `script`
    const ptyCommand = `script -q -c ${this.escapeShellArg(opts.command)} /dev/null`;

    const proc = Bun.spawn(["sh", "-c", ptyCommand], {
      cwd: opts.cwd,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...Bun.env,
        PATH: Bun.env.PATH ?? "/usr/bin:/bin",
        TERM: "xterm-256color",
        COLUMNS: String(this.currentSize.columns),
        LINES: String(this.currentSize.rows),
      },
    });

    // Set up resize handler if requested
    const resizeWriter = (data: string) => {
      proc.stdin.write(new TextEncoder().encode(data));
    };
    opts.onResize?.(createPtyResizeHandler(resizeWriter));

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
      // Send SIGINT to the foreground process group
      proc.stdin.write(new TextEncoder().encode("\x03")); // Ctrl+C
      setTimeout(() => {
        if (proc.exitCode === null && proc.killed === false) {
          proc.kill("SIGTERM");
          setTimeout(() => {
            if (proc.exitCode === null && proc.killed === false) {
              proc.kill("SIGKILL");
            }
          }, 3000);
        }
      }, 1000);
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
              this.outputBuffer.append(redacted);
              _stdoutBuf += redacted;
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
    exitSignal = proc.killed
      ? proc.signalCode
        ? String(proc.signalCode)
        : "SIGKILL"
      : null;

    // Return a summary only — full output lives in the buffer
    return {
      exitCode,
      stdout: this.outputBuffer.snapshot(),
      stderr: stderrBuf.slice(0, 50000),
      timedOut,
      truncated: this.outputBuffer.byteCount > 100_000,
      exitSignal,
    };
  }

  /** Get the current output buffer (for UI polling). */
  getOutputBuffer(): PtyOutputBuffer {
    return this.outputBuffer;
  }

  /** Update the terminal size for the next command. */
  setSize(size: PtySize): void {
    this.currentSize = size;
  }

  /** Shell-escape a command argument for use with `script -c`. */
  private escapeShellArg(arg: string): string {
    // Wrap in single quotes, escaping internal single quotes
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
}
