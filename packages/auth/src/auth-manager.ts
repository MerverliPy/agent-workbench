/**
 * AuthManager — coordinates token issuance, validation, and lifecycle.
 *
 * Phase 27: The single entry point for authentication operations.
 * Reads configuration from environment variables.
 */

import { SessionToken } from "./session-tokens";
import { InMemoryTokenStore } from "./token-store";
import type { TokenRecord } from "./token-store";

// ── Defaults ───────────────────────────────────────────────────────────────

const ENV_SECRET = "AGENT_WORKBENCH_AUTH_SECRET";
const ENV_ENABLED = "AGENT_WORKBENCH_AUTH_ENABLED";
const ENV_TOKEN_TTL = "AGENT_WORKBENCH_TOKEN_TTL_MS";
const ENV_TLS_ENABLED = "AGENT_WORKBENCH_TLS_ENABLED";

// ── AuthManager ────────────────────────────────────────────────────────────

export class AuthManager {
  private readonly sessionToken: SessionToken | null;
  private readonly store: InMemoryTokenStore;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = this.readEnabled();
    this.store = new InMemoryTokenStore();

    if (this.enabled) {
      const secret = this.readSecret();
      const ttlMs = this.readTokenTtl();
      this.sessionToken = new SessionToken({ secret, ttlMs });
      this.store.startCleanup();
    } else {
      this.sessionToken = null;
    }
  }

  /** Whether authentication is enabled. */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Whether TLS is enabled (read from env). */
  get isTlsEnabled(): boolean {
    return process.env[ENV_TLS_ENABLED] === "true" || process.env[ENV_TLS_ENABLED] === "1";
  }

  /** Get the shared secret for HMAC signing. */
  get secret(): string | null {
    return process.env[ENV_SECRET] ?? null;
  }

  /** Generate a new bearer token for the given label. */
  generateToken(label: string, scopes?: string[]): { token: string; expiresAt: string } | null {
    if (!this.sessionToken) return null;
    const result = this.sessionToken.generate(label, scopes);
    this.store.set({
      token: result.token,
      label,
      expiresAt: result.expiresAt,
      createdAt: new Date().toISOString(),
      scopes: scopes ?? ["*"],
    });
    return result;
  }

  /** Validate a bearer token. Returns the token label if valid, null otherwise. */
  validateToken(token: string): { label: string; expiresAt: string; scopes: readonly string[] } | null {
    if (!this.sessionToken) return null;

    // Check the store first (fast path)
    const record = this.store.get(token);
    if (record) {
      return { label: record.label, expiresAt: record.expiresAt, scopes: record.scopes };
    }

    // Validate cryptographically (handles tokens from other instances)
    const payload = this.sessionToken.validate(token);
    if (!payload) return null;

    // Cache in store for fast subsequent lookups
    this.store.set({
      token,
      label: payload.sub,
      expiresAt: new Date(payload.exp).toISOString(),
      createdAt: new Date(payload.iat).toISOString(),
      scopes: payload.scopes,
    });

    return { label: payload.sub, expiresAt: new Date(payload.exp).toISOString(), scopes: payload.scopes };
  }

  /** Revoke a token. */
  revokeToken(token: string): boolean {
    return this.store.delete(token);
  }

  /** List all active tokens. */
  listTokens(): TokenRecord[] {
    return this.store.list();
  }

  /** Get the shared secret (for token endpoint auth). */
  getSharedSecret(): string | null {
    return process.env[ENV_SECRET] ?? null;
  }

  /** Check the health of the auth system. */
  health(): { enabled: boolean; activeTokens: number; tlsEnabled: boolean; hint: string | undefined } {
    const hint: string | undefined = this.enabled
      ? undefined
      : `Auth is disabled. Set ${ENV_SECRET} and ${ENV_ENABLED}=true to enable.`;
    return { enabled: this.enabled, activeTokens: this.store.list().length, tlsEnabled: this.isTlsEnabled, hint };
  }

  // ── Env helpers ─────────────────────────────────────────────────────────

  private readEnabled(): boolean {
    const val = process.env[ENV_ENABLED];
    return val === "true" || val === "1";
  }

  private readSecret(): string {
    const secret = process.env[ENV_SECRET];
    if (!secret || secret.length < 16) {
      // For initial setup, generate a warning. In production, the server
      // should refuse to start if auth is enabled but secret is too short.
      console.warn(
        `[auth] ${ENV_SECRET} is missing or too short (< 16 chars). ` +
        `Generate one with: openssl rand -base64 32`
      );
      return "CHANGE-ME-in-production-use-a-64-char-secret!"; // 52 chars
    }
    return secret;
  }

  private readTokenTtl(): number {
    const raw = process.env[ENV_TOKEN_TTL];
    if (!raw) return 3_600_000; // 1 hour default
    const ms = Number(raw);
    if (!Number.isFinite(ms) || ms < 60_000 || ms > 86_400_000) {
      console.warn(`[auth] Invalid ${ENV_TOKEN_TTL}: ${raw}. Using default (1 hour).`);
      return 3_600_000;
    }
    return ms;
  }
}
