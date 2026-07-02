/**
 * Presence manager — real-time user presence for sessions.
 *
 * Phase 27: Tracks which users are actively viewing or participating in a
 * session. Uses `SharedSessionManager` as the underlying state store and
 * relays events through the shared EventBus for SSE delivery.
 *
 * Provides higher-level session-scoped operations like enter/leave/heartbeat
 * that emit the collab.user_joined / collab.user_left / collab.user_activity
 * events consumed by the SSE endpoint at `/events`.
 *
 * ## Usage
 *
 * ```ts
 * import { PresenceManager } from "@agent-workbench/collab";
 *
 * const presence = new PresenceManager(sharedSessionManager);
 *
 * // User opens a session view
 * presence.enterSession("session-123", "alice", "Alice's iPhone");
 *
 * // Heartbeat (e.g. every 60s from the client)
 * presence.heartbeat("session-123", "alice");
 *
 * // Get active users
 * const state = presence.getPresence("session-123");
 * // → { sessionId: "session-123", activeUsers: [...], totalUsers: 1 }
 * ```
 */

import { SharedSessionManager } from "./shared-session";
import type { SharedSessionUser, SharedSessionRole } from "./shared-session";

// ── Types ──────────────────────────────────────────────────────────────────

/** The full presence state for a session. */
export interface SessionPresence {
  readonly sessionId: string;
  readonly activeUsers: readonly SharedSessionUser[];
  readonly totalUsers: number;
}

/** Options when entering a session. */
export interface EnterSessionOptions {
  /** Human-readable label (display name, device, etc.). */
  readonly label: string;
  /** Access role. Defaults to "viewer" for presence (view-only tracking). */
  readonly role?: SharedSessionRole;
}

// ── PresenceManager ────────────────────────────────────────────────────────

/**
 * Tracks user presence across sessions.
 *
 * Wraps `SharedSessionManager` with higher-level operations and maintains
 * a reverse index of which users are in which sessions for quick lookups.
 */
export class PresenceManager {
  private readonly sessionManager: SharedSessionManager;
  /** Map<userId, Set<sessionId>> — reverse index for getUserSessions(). */
  private readonly userSessions = new Map<string, Set<string>>();

  constructor(sessionManager: SharedSessionManager) {
    this.sessionManager = sessionManager;
  }

  // ── Core operations ─────────────────────────────────────────────────────

  /**
   * Mark a user as present in a session.
   * If the user is already present, updates their lastActivityAt.
   *
   * Emits `collab.user_joined` via the SharedSessionManager.
   */
  enterSession(sessionId: string, options: EnterSessionOptions): SharedSessionUser {
    const user = this.sessionManager.join(sessionId, {
      label: options.label,
      role: options.role ?? "viewer",
    });

    // Update the reverse index
    let sessions = this.userSessions.get(options.label);
    if (!sessions) {
      sessions = new Set();
      this.userSessions.set(options.label, sessions);
    }
    sessions.add(sessionId);

    return user;
  }

  /**
   * Mark a user as no longer present in a session.
   *
   * Emits `collab.user_left` via the SharedSessionManager.
   */
  leaveSession(sessionId: string, userId: string): boolean {
    const result = this.sessionManager.leave(sessionId, userId);

    // Update the reverse index
    const sessions = this.userSessions.get(userId);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }

    return result;
  }

  /**
   * Update the last activity timestamp for a user in a session.
   * Clients should call this periodically (e.g. every 60s) to avoid
   * being pruned as a stale user.
   *
   * Emits `collab.user_activity` via the SharedSessionManager.
   */
  heartbeat(sessionId: string, userId: string): boolean {
    return this.sessionManager.updateActivity(sessionId, userId);
  }

  /**
   * Remove a user from ALL sessions they're currently in.
   * Useful for disconnect/offline events.
   */
  leaveAllSessions(userId: string): number {
    const sessions = this.userSessions.get(userId);
    if (!sessions) return 0;

    let count = 0;
    for (const sessionId of sessions) {
      if (this.sessionManager.leave(sessionId, userId)) {
        count++;
      }
    }
    this.userSessions.delete(userId);
    return count;
  }

  // ── Queries ──────────────────────────────────────────────────────────────

  /** Get the current presence state for a session. */
  getPresence(sessionId: string): SessionPresence {
    const activeUsers = this.sessionManager.getUsers(sessionId);
    return {
      sessionId,
      activeUsers,
      totalUsers: activeUsers.length,
    };
  }

  /** Get the raw SharedSessionUser objects for a session. */
  getUsers(sessionId: string): readonly SharedSessionUser[] {
    return this.sessionManager.getUsers(sessionId);
  }

  /** Number of users currently present in a session. */
  getUserCount(sessionId: string): number {
    return this.sessionManager.getUserCount(sessionId);
  }

  /** Check if a user is currently present in a session. */
  isUserPresent(sessionId: string, userId: string): boolean {
    return this.sessionManager.isUserInSession(sessionId, userId);
  }

  /** Get all sessions a user is currently in. */
  getUserSessions(userId: string): readonly string[] {
    return Array.from(this.userSessions.get(userId) ?? []);
  }

  /** Get presence for all currently active sessions. */
  getAllPresence(): Record<string, SessionPresence> {
    const all: Record<string, SessionPresence> = {};
    for (const sessionId of this.sessionManager.getActiveSessionIds()) {
      all[sessionId] = this.getPresence(sessionId);
    }
    return all;
  }

  // ── Diagnostics ─────────────────────────────────────────────────────────

  /** Total active sessions with users present. */
  get totalActiveSessions(): number {
    return this.sessionManager.totalActiveSessions;
  }

  /** Total users across all sessions. */
  get totalActiveUsers(): number {
    return this.sessionManager.totalActiveUsers;
  }

  /** Total unique users tracked by the presence system. */
  get totalUniqueUsers(): number {
    return this.userSessions.size;
  }
}
