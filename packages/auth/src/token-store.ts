/**
 * In-memory token store with automatic expiry cleanup.
 *
 * Phase 27: Stores issued bearer tokens and their metadata.
 * Future: migrate to SQLite via `@agent-workbench/storage` for persistence
 * across server restarts.
 */

export interface TokenRecord {
  /** The bearer token string. */
  readonly token: string;
  /** Human-readable label (e.g. "calvin's phone"). */
  readonly label: string;
  /** ISO-8601 expiry timestamp. */
  readonly expiresAt: string;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
  /** Scopes granted to this token. */
  readonly scopes: readonly string[];
}

/**
 * Simple in-memory token store.
 *
 * Tokens are stored in a Map keyed by the token string.
 * Expired tokens are lazily cleaned up on lookups and on a periodic timer.
 */
export class InMemoryTokenStore {
  private readonly tokens = new Map<string, TokenRecord>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Start periodic cleanup (every 5 minutes). Call once on server boot. */
  startCleanup(intervalMs = 300_000): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.removeExpired(), intervalMs);
    if (
      typeof this.cleanupTimer === "object" &&
      this.cleanupTimer !== null &&
      "unref" in this.cleanupTimer
    ) {
      // Prevent timer from keeping the process alive in Bun
    }
  }

  /** Stop periodic cleanup. */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Store a token record. */
  set(record: TokenRecord): void {
    this.tokens.set(record.token, record);
  }

  /** Look up a token by its string value. Returns undefined if expired or not found. */
  get(token: string): TokenRecord | undefined {
    const record = this.tokens.get(token);
    if (!record) return undefined;
    if (Date.now() >= new Date(record.expiresAt).getTime()) {
      this.tokens.delete(token);
      return undefined;
    }
    return record;
  }

  /** Check if a token exists and is valid. */
  has(token: string): boolean {
    return this.get(token) !== undefined;
  }

  /** Remove a token. */
  delete(token: string): boolean {
    return this.tokens.delete(token);
  }

  /** List all non-expired tokens. */
  list(): TokenRecord[] {
    this.removeExpired();
    return Array.from(this.tokens.values());
  }

  /** Remove all tokens. */
  clear(): void {
    this.tokens.clear();
  }

  /** Remove expired tokens from the store. */
  private removeExpired(): void {
    const now = Date.now();
    for (const [token, record] of this.tokens) {
      if (now >= new Date(record.expiresAt).getTime()) {
        this.tokens.delete(token);
      }
    }
  }
}
