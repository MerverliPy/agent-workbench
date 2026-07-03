import type { PtyCommandRunner } from "@agent-workbench/shell";

/**
 * PTY orchestrator — manages the PTY lifecycle at the core level.
 *
 * Responsibilities:
 *  - Session-scoped PTY allocation (one PTY per session)
 *  - Permission gating via the same permission engine as bash
 *  - Output buffering with scrollback (via PtyOutputBuffer)
 *  - Ledger recording: only exit code + summary metadata (NOT full output)
 *  - Abort/timeout forwarding to the PTY process group
 *
 * Architecture boundary: this orchestrator delegates to PtyCommandRunner
 * for actual process execution. Permission decisions happen upstream
 * in ToolDispatcher/SessionRunner before reaching this point.
 */
export class PtyOrchestrator {
  private activeProcesses = new Map<string, { abort: () => void }>();

  constructor(private readonly runner: PtyCommandRunner) {}

  /**
   * Get the underlying PTY runner (used by the pty-shell tool).
   */
  getRunner(): PtyCommandRunner {
    return this.runner;
  }

  /**
   * Register an active PTY process for a session.
   * Only one active PTY per session.
   */
  register(sessionId: string, abort: () => void): void {
    // Abort any existing PTY for this session
    this.abort(sessionId);
    this.activeProcesses.set(sessionId, { abort });
  }

  /**
   * Abort the PTY for a given session (sends Ctrl+C then SIGTERM).
   */
  abort(sessionId: string): void {
    const proc = this.activeProcesses.get(sessionId);
    if (proc) {
      proc.abort();
      this.activeProcesses.delete(sessionId);
    }
  }

  /**
   * Check if a session has an active PTY.
   */
  isActive(sessionId: string): boolean {
    return this.activeProcesses.has(sessionId);
  }

  /**
   * Get the output buffer from the runner (for UI polling).
   */
  getOutputBuffer() {
    return this.runner.getOutputBuffer();
  }

  /**
   * Clean up all active PTYs (e.g., on server shutdown).
   */
  shutdown(): void {
    for (const [, proc] of this.activeProcesses) {
      proc.abort();
    }
    this.activeProcesses.clear();
  }
}
