/**
 * Share manager — generates and validates session share tokens.
 *
 * Phase 27: Allows a session owner to generate a time-limited, view-only
 * share link that grants read-only access to the session's messages and
 * metadata. The token is a cryptographically random string mapped to a
 * session ID with optional expiry.
 *
 * ## Usage
 *
 * ```ts
 * import { ShareManager } from "@agent-workbench/collab";
 *
 * const shares = new ShareManager();
 *
 * // Generate a 24-hour share
 * const share = shares.create("session-123", { label: "Alice review", expiresInMs: 86_400_000 });
 * // → { token: "shr_abc...", sessionId: "session-123", expiresAt: "...", url: "http://host:port/share/shr_abc..." }
 *
 * // Validate and look up
 * const result = shares.validate("shr_abc...");
 * // → { sessionId: "session-123", label: "Alice review", expiresAt: "..." } or null if expired
 * ```
 */

import { EventName } from "@agent-workbench/events";
import type { EventBus } from "@agent-workbench/events";

// ── Types ──────────────────────────────────────────────────────────────────

/** A share record linking a token to a session. */
export interface ShareRecord {
  /** Unique share token (e.g. "shr_01AR2..."). */
  readonly token: string;
  /** The session being shared. */
  readonly sessionId: string;
  /** Human-readable label (e.g. "PR #42 review"). */
  readonly label: string;
  /** ISO-8601 expiry timestamp. */
  readonly expiresAt: string;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
  /** Creator's user/device label. */
  readonly createdBy: string;
  /** Whether this share was revoked manually. */
  revoked: boolean;
}

/** Options when creating a share. */
export interface CreateShareOptions {
  /** Human-readable label for the share. */
  readonly label?: string;
  /** Time-to-live in milliseconds. Default: 7 days (604_800_000). Max: 30 days. */
  readonly expiresInMs?: number;
}

/** Result of a successful share creation. */
export interface ShareResult {
  readonly token: string;
  readonly sessionId: string;
  readonly url: string;
  readonly expiresAt: string;
  readonly label: string;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_PREFIX = "shr_";

// ── ShareManager ───────────────────────────────────────────────────────────

/**
 * Manages session share tokens.
 *
 * In-memory store with automatic expiry cleanup.
 * Tokens are prefixed with "shr_" for easy identification.
 */
export class ShareManager {
  /** Map<token, ShareRecord> */
  private readonly shares = new Map<string, ShareRecord>();
  /** Map<sessionId, Set<token>> — fast lookup of all shares for a session */
  private readonly sessionIndex = new Map<string, Set<string>>();
  private readonly eventBus: EventBus | undefined;
  private cleanupTimer: ReturnType<typeof setInterval> | undefined;
  /** Base URL for generating share links. */
  private baseUrl: string;

  constructor(options?: {
    eventBus?: EventBus | undefined;
    /** Base URL for share links (e.g. "http://localhost:3000"). Default: "http://localhost:8787". */
    baseUrl?: string;
    /** Auto-start the cleanup interval. Default: true. */
    autoCleanup?: boolean;
  }) {
    this.eventBus = options?.eventBus;
    this.baseUrl = options?.baseUrl ?? "http://localhost:8787";
    if (options?.autoCleanup !== false) {
      this.startCleanup();
    }
  }

  /**
   * Update the base URL used for generating share links.
   * Useful when the server discovers its Tailscale IP or public endpoint.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  /** Get the current base URL. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Generate a share token for a session.
   *
   * Returns the share token, URL, and expiry time.
   * Emits `collab.session_shared` on the event bus.
   */
  create(sessionId: string, createdBy: string, options?: CreateShareOptions): ShareResult {
    const label = options?.label ?? `Share ${new Date().toLocaleDateString()}`;
    const ttl = Math.min(options?.expiresInMs ?? DEFAULT_TTL_MS, MAX_TTL_MS);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl);

    const token = this.generateToken();

    const record: ShareRecord = {
      token,
      sessionId,
      label,
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString(),
      createdBy,
      revoked: false,
    };

    this.shares.set(token, record);

    // Index by session
    let sessionShares = this.sessionIndex.get(sessionId);
    if (!sessionShares) {
      sessionShares = new Set();
      this.sessionIndex.set(sessionId, sessionShares);
    }
    sessionShares.add(token);

    const url = `${this.baseUrl}/share/${token}`;

    this.emit(EventName.COLLAB_SESSION_SHARED, {
      token,
      sessionId,
      label,
      expiresAt: record.expiresAt,
      url,
      createdBy,
    });

    return { token, sessionId, url, expiresAt: record.expiresAt, label };
  }

  /**
   * Validate a share token and return the associated session ID.
   *
   * Returns null if the token is invalid, expired, or revoked.
   */
  validate(token: string): { sessionId: string; label: string; expiresAt: string } | null {
    const record = this.shares.get(token);
    if (!record) return null;
    if (record.revoked) return null;
    if (Date.now() >= new Date(record.expiresAt).getTime()) {
      this.shares.delete(token);
      this.removeFromIndex(token, record.sessionId);
      return null;
    }
    return { sessionId: record.sessionId, label: record.label, expiresAt: record.expiresAt };
  }

  /**
   * Revoke a share token. Once revoked, validate() will return null.
   * Returns true if the token was found and revoked.
   */
  revoke(token: string): boolean {
    const record = this.shares.get(token);
    if (!record) return false;
    record.revoked = true;
    return true;
  }

  /**
   * Revoke all shares for a given session.
   * Returns the number of shares revoked.
   */
  revokeAllForSession(sessionId: string): number {
    const tokens = this.sessionIndex.get(sessionId);
    if (!tokens) return 0;
    let count = 0;
    for (const token of tokens) {
      const record = this.shares.get(token);
      if (record && !record.revoked) {
        record.revoked = true;
        count++;
      }
    }
    return count;
  }

  /** List all active (non-revoked, non-expired) shares for a session. */
  listBySession(sessionId: string): readonly ShareRecord[] {
    const tokens = this.sessionIndex.get(sessionId);
    if (!tokens) return [];
    const now = Date.now();
    const results: ShareRecord[] = [];
    for (const token of tokens) {
      const record = this.shares.get(token);
      if (record && !record.revoked && now < new Date(record.expiresAt).getTime()) {
        results.push(record);
      }
    }
    return results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  /** Get a single share record by token (includes revoked/expired). */
  get(token: string): ShareRecord | undefined {
    return this.shares.get(token);
  }

  /** Get total non-expired, non-revoked share count. */
  get totalActiveShares(): number {
    const now = Date.now();
    let count = 0;
    for (const record of this.shares.values()) {
      if (!record.revoked && now < new Date(record.expiresAt).getTime()) {
        count++;
      }
    }
    return count;
  }

  /** List all active shares across all sessions (for diagnostics). */
  listAll(): readonly ShareRecord[] {
    const now = Date.now();
    return Array.from(this.shares.values())
      .filter((r) => !r.revoked && now < new Date(r.expiresAt).getTime())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  /** Start periodic expired-share cleanup (every 5 minutes). */
  startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.removeExpired();
    }, 300_000);
  }

  /** Stop periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /** Remove expired tokens from both maps. */
  private removeExpired(): void {
    const now = Date.now();
    const expired: Array<{ token: string; sessionId: string }> = [];
    for (const [token, record] of this.shares) {
      if (now >= new Date(record.expiresAt).getTime()) {
        expired.push({ token, sessionId: record.sessionId });
      }
    }
    for (const { token, sessionId } of expired) {
      this.shares.delete(token);
      this.removeFromIndex(token, sessionId);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Generate a unique share token. */
  private generateToken(): string {
    const entropy = crypto.randomUUID().replace(/-/g, "");
    const suffix = Buffer.from(entropy, "hex").toString("base64url").slice(0, 22);
    const candidate = `${TOKEN_PREFIX}${suffix}`;
    if (this.shares.has(candidate)) {
      return this.generateToken(); // Collision — extremely unlikely but handle it
    }
    return candidate;
  }

  /** Remove a token from the session index. */
  private removeFromIndex(token: string, sessionId: string): void {
    const sessionShares = this.sessionIndex.get(sessionId);
    if (!sessionShares) return;
    sessionShares.delete(token);
    if (sessionShares.size === 0) {
      this.sessionIndex.delete(sessionId);
    }
  }

  /** Emit a collab event if an EventBus is configured. */
  private emit(type: string, payload: Record<string, unknown>): void {
    if (!this.eventBus) return;
    const ulid = crypto.randomUUID().replace(/-/g, "").slice(0, 26);
    this.eventBus.publish({
      id: ulid,
      type,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
