/**
 * Shared session state — tracks multi-user participation in a session.
 *
 * Phase 27: Provides the runtime state for presence, session sharing, and
 * collaborative review features. Each session can have multiple users with
 * different roles (viewer, editor, admin). The manager is in-memory only —
 * presence is ephemeral and does not need persistence.
 *
 * ## Usage
 *
 * ```ts
 * import { SharedSessionManager } from "@agent-workbench/collab";
 *
 * const manager = new SharedSessionManager({ eventBus });
 *
 * // User joins a session
 * manager.join("session-123", { label: "Alice" });
 *
 * // List active users
 * const users = manager.getUsers("session-123");
 * // → [{ userId: "alice", label: "Alice", role: "editor", joinedAt: "...", lastActivityAt: "..." }]
 *
 * // User leaves
 * manager.leave("session-123", "alice");
 * ```
 */

import type { EventBus } from "@agent-workbench/events";
import { EventName } from "@agent-workbench/events";
import type { EventEnvelope } from "@agent-workbench/protocol";

// ── Types ──────────────────────────────────────────────────────────────────

/** The role/access level of a user in a shared session. */
export type SharedSessionRole = "viewer" | "editor" | "admin";

/** A user currently participating in a shared session. */
export interface SharedSessionUser {
  readonly userId: string;
  readonly label: string;
  readonly role: SharedSessionRole;
  readonly joinedAt: string;
  readonly lastActivityAt: string;
}

/** Options when joining a session. */
export interface JoinSessionOptions {
  /** Human-readable label (display name, device name, etc.). */
  readonly label: string;
  /** Access role. Defaults to "editor". */
  readonly role?: SharedSessionRole;
  /** Optional scopes for fine-grained authorization. */
  readonly scopes?: readonly string[];
}

// ── Manager ────────────────────────────────────────────────────────────────

/**
 * Manages multi-user participation state for sessions.
 *
 * In-memory only — presence is ephemeral by design. Uses the EventBus to
 * emit join/leave/activity events for SSE subscribers.
 */
export class SharedSessionManager {
  /** Map<sessionId, Map<userId, SharedSessionUser>> */
  private readonly sessions = new Map<string, Map<string, SharedSessionUser>>();
  private readonly eventBus: EventBus | undefined;
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;
  private readonly staleTimeoutMs: number;

  constructor(options?: {
    eventBus?: EventBus | undefined;
    /** How long without activity before a user is considered stale and auto-removed. Default: 5 minutes. */
    staleTimeoutMs?: number;
    /** Auto-start the stale-user cleanup interval. Default: true. */
    autoCleanup?: boolean;
  }) {
    this.eventBus = options?.eventBus;
    this.staleTimeoutMs = options?.staleTimeoutMs ?? 300_000;

    if (options?.autoCleanup !== false) {
      this.startCleanup();
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Add a user to a session. If the user is already in the session, updates
   * their lastActivityAt timestamp.
   *
   * Emits `collab.user_joined` on the event bus.
   */
  join(sessionId: string, options: JoinSessionOptions): SharedSessionUser {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new Map();
      this.sessions.set(sessionId, session);
    }

    const existing = session.get(options.label);
    if (existing) {
      const updated: SharedSessionUser = {
        ...existing,
        lastActivityAt: new Date().toISOString(),
      };
      session.set(options.label, updated);
      return updated;
    }

    const now = new Date().toISOString();
    const user: SharedSessionUser = {
      userId: options.label,
      label: options.label,
      role: options.role ?? "editor",
      joinedAt: now,
      lastActivityAt: now,
    };

    session.set(options.label, user);
    this.emitCollabEvent(EventName.COLLAB_USER_JOINED, sessionId, {
      user,
      activeUsers: this.getUsers(sessionId),
    });

    return user;
  }

  /**
   * Remove a user from a session.
   *
   * Emits `collab.user_left` on the event bus.
   * If the session becomes empty, it is cleaned up.
   */
  leave(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const user = session.get(userId);
    if (!user) return false;

    session.delete(userId);

    this.emitCollabEvent(EventName.COLLAB_USER_LEFT, sessionId, {
      userId,
      label: user.label,
      activeUsers: this.getUsers(sessionId),
    });

    if (session.size === 0) {
      this.sessions.delete(sessionId);
    }

    return true;
  }

  /**
   * Update the last activity timestamp for a user.
   *
   * Emits `collab.user_activity` if the user exists.
   */
  updateActivity(sessionId: string, userId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const user = session.get(userId);
    if (!user) return false;

    const now = new Date().toISOString();
    const updated: SharedSessionUser = { ...user, lastActivityAt: now };
    session.set(userId, updated);

    this.emitCollabEvent(EventName.COLLAB_USER_ACTIVITY, sessionId, {
      userId,
      label: user.label,
      timestamp: now,
    });

    return true;
  }

  /** Get all active users in a session, sorted by join time. */
  getUsers(sessionId: string): readonly SharedSessionUser[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return Array.from(session.values()).sort((a, b) =>
      a.joinedAt.localeCompare(b.joinedAt),
    );
  }

  /** Number of active users in a session. */
  getUserCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.size ?? 0;
  }

  /** Check if a user is currently in a session. */
  isUserInSession(sessionId: string, userId: string): boolean {
    return this.sessions.get(sessionId)?.has(userId) ?? false;
  }

  /** Remove a session entirely (e.g. when it's deleted or expired). */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Get all session IDs that currently have active users. */
  getActiveSessionIds(): readonly string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get a combined snapshot of all sessions and their users.
   * Useful for debug/diagnostic endpoints.
   */
  getSnapshot(): Record<string, readonly SharedSessionUser[]> {
    const snapshot: Record<string, readonly SharedSessionUser[]> = {};
    for (const [sessionId, users] of this.sessions) {
      snapshot[sessionId] = Array.from(users.values());
    }
    return snapshot;
  }

  /** Total active sessions (non-empty). */
  get totalActiveSessions(): number {
    return this.sessions.size;
  }

  /** Total users across all sessions. */
  get totalActiveUsers(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      count += session.size;
    }
    return count;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  /** Start the periodic stale-user cleanup interval (at most every 60s). */
  startCleanup(): void {
    if (this.cleanupInterval) return;
    const interval = Math.min(this.staleTimeoutMs, 60_000);
    this.cleanupInterval = setInterval(() => {
      this.removeStaleUsers();
    }, interval);
  }

  /** Stop the periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /** Remove users who haven't had activity within the stale timeout. */
  private removeStaleUsers(): void {
    const cutoff = Date.now() - this.staleTimeoutMs;
    const stale: Array<{ sessionId: string; userId: string }> = [];

    for (const [sessionId, users] of this.sessions) {
      for (const [userId, user] of users) {
        if (new Date(user.lastActivityAt).getTime() < cutoff) {
          stale.push({ sessionId, userId });
        }
      }
    }

    for (const { sessionId, userId } of stale) {
      this.leave(sessionId, userId);
    }
  }

  // ── Events ──────────────────────────────────────────────────────────────

  /** Emit a collaboration event on the event bus, if one is configured. */
  private emitCollabEvent(
    type: string,
    sessionId: string,
    payload: Record<string, unknown>,
  ): void {
    if (!this.eventBus) return;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
    const envelope: EventEnvelope = {
      id: ulid,
      type,
      sessionId,
      timestamp: new Date().toISOString(),
      payload,
    };
    this.eventBus.publish(envelope);
  }
}
