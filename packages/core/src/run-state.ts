/**
 * In-memory run state and registry used for cancellation.
 *
 * The registry maps sessionId → ActiveRun so that SessionRunner can find and
 * abort the current run for a session when requested.
 */

export interface ActiveRun {
  runId: string;
  sessionId: string;
  abortController: AbortController;
  startedAt: Date;
}

/**
 * Tracks one active run per session.
 *
 * Concurrency policy (Phase 6): one active run per session. Attempting to
 * start a second run while one is active returns an error rather than silently
 * aborting the existing run.
 */
export class RunRegistry {
  private readonly runs = new Map<string, ActiveRun>();

  /**
   * Register a new run for the given session.
   * Throws if a run is already active for that session.
   */
  register(run: ActiveRun): void {
    if (this.runs.has(run.sessionId)) {
      throw new Error(
        `Session ${run.sessionId} already has an active run (${this.runs.get(run.sessionId)?.runId}). Wait for it to complete or abort it first.`
      );
    }
    this.runs.set(run.sessionId, run);
  }

  /** Look up the active run for a session. */
  get(sessionId: string): ActiveRun | undefined {
    return this.runs.get(sessionId);
  }

  /** Remove the run entry for a session (called on completion or abort). */
  remove(sessionId: string): void {
    this.runs.delete(sessionId);
  }

  /** Whether a session has an active run. */
  hasActive(sessionId: string): boolean {
    return this.runs.has(sessionId);
  }
}
