/**
 * PermissionGate — async pause/resume for ask-gated tool calls.
 *
 * When the PermissionEngine returns "ask", the core runtime:
 *   1. Persists a PermissionRequest in storage.
 *   2. Emits a permission.requested SSE event.
 *   3. Calls gate.waitForDecision(requestId, signal) — this suspends the run.
 *
 * When the user approves or denies via POST /permission/request/:id/decision:
 *   4. The server route calls gate.resolve(requestId, "allow" | "deny").
 *   5. The suspended Promise in the core runtime resolves.
 *   6. The run continues or records a denial.
 *
 * Safety properties:
 *   - Abort signal fires → waitForDecision resolves to "deny" (never hangs).
 *   - resolve() called for unknown requestId → returns false, caller logs.
 *   - Each requestId can only be resolved once (entry is deleted on resolve).
 *   - No timeouts enforced in Phase 8 (PERM-EXPIRY: not implemented).
 *
 * This class is stateful and must be a shared singleton between
 * packages/core (waits) and apps/server (resolves).
 */

export type PermissionDecisionValue = "allow" | "deny";

interface PendingEntry {
  resolve: (decision: PermissionDecisionValue) => void;
}

export class PermissionGate {
  private readonly pending = new Map<string, PendingEntry>();

  /**
   * Suspend the caller until a decision is submitted for the given requestId.
   *
   * If the provided AbortSignal fires before a decision arrives, the promise
   * resolves to "deny" so the run can record a denial and clean up.
   *
   * @param requestId  The ID of the persisted PermissionRequest.
   * @param signal     The run's AbortSignal (optional but strongly recommended).
   * @returns          "allow" or "deny" once the gate is resolved or aborted.
   */
  waitForDecision(
    requestId: string,
    signal?: AbortSignal,
  ): Promise<PermissionDecisionValue> {
    return new Promise<PermissionDecisionValue>((resolve) => {
      // If already aborted, resolve immediately.
      if (signal?.aborted) {
        resolve("deny");
        return;
      }

      const entry: PendingEntry = { resolve };
      this.pending.set(requestId, entry);

      // Wire abort signal to auto-resolve as deny and clean up.
      if (signal !== undefined) {
        const onAbort = () => {
          if (this.pending.has(requestId)) {
            this.pending.delete(requestId);
            resolve("deny");
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  }

  /**
   * Resolve a pending decision.
   *
   * Called by the server route handler after the user submits a decision.
   *
   * @param requestId  Must match the ID passed to waitForDecision().
   * @param decision   The user's choice.
   * @returns          true if a pending entry was found and resolved,
   *                   false if requestId was unknown (already resolved/aborted).
   */
  resolve(requestId: string, decision: PermissionDecisionValue): boolean {
    const entry = this.pending.get(requestId);
    if (entry === undefined) {
      // The request was aborted or already resolved — log but do not throw.
      console.warn(
        `[PermissionGate] resolve() called for unknown requestId: ${requestId}. ` +
          "The request may have been aborted or already decided.",
      );
      return false;
    }
    this.pending.delete(requestId);
    entry.resolve(decision);
    return true;
  }

  /** Return whether the gate has a pending entry for the given requestId. */
  hasPending(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  /** Total count of currently suspended decisions. Useful for diagnostics. */
  pendingCount(): number {
    return this.pending.size;
  }
}
