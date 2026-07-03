/**
 * Time-limited session tokens.
 *
 * Phase 27: Tokens are generated using a HMAC-SHA256 signature
 * derived from a shared secret. The token encodes:
 *   - A unique token ID (ULID)
 *   - An expiry timestamp
 *   - A signature (HMAC-SHA256 over the token payload)
 *
 * Token format: `awb_v1_<base64-payload>_<base64-signature>`
 *
 * Future: Support JWT format for integration with OIDC providers.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { ulid } from "ulid";

// ── Constants ──────────────────────────────────────────────────────────────

const TOKEN_PREFIX = "awb_v1_";
const DEFAULT_TTL_MS = 3_600_000; // 1 hour
const MAX_TTL_MS = 86_400_000; // 24 hours
const PAYLOAD_SEPARATOR = ".";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SessionTokenConfig {
  /** Shared secret for HMAC signing (required). */
  readonly secret: string;
  /** Token time-to-live in milliseconds (default: 1 hour, max: 24 hours). */
  readonly ttlMs?: number;
}

interface TokenPayload {
  readonly jti: string; // Token ID (ULID)
  readonly sub: string; // Subject / label
  readonly iat: number; // Issued-at (unix ms)
  readonly exp: number; // Expires (unix ms)
  readonly scopes: readonly string[];
}

// ── SessionToken ───────────────────────────────────────────────────────────

export class SessionToken {
  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(config: SessionTokenConfig) {
    if (!config.secret || config.secret.length < 16) {
      throw new Error(
        "Auth secret must be at least 16 characters. " +
          "Set AGENT_WORKBENCH_AUTH_SECRET to a secure random string.",
      );
    }
    this.secret = config.secret;
    this.ttlMs = Math.min(config.ttlMs ?? DEFAULT_TTL_MS, MAX_TTL_MS);
  }

  /** Generate a new token for the given subject/label. */
  generate(
    label: string,
    scopes: string[] = ["*"],
  ): { token: string; expiresAt: string } {
    const now = Date.now();
    const payload: TokenPayload = {
      jti: ulid(),
      sub: label,
      iat: now,
      exp: now + this.ttlMs,
      scopes,
    };

    const encoded = this.encodePayload(payload);
    const signature = this.sign(encoded);

    return {
      token: `${TOKEN_PREFIX}${encoded}${PAYLOAD_SEPARATOR}${signature}`,
      expiresAt: new Date(payload.exp).toISOString(),
    };
  }

  /** Validate and decode a token. Returns the payload, or null if invalid/expired. */
  validate(token: string): TokenPayload | null {
    if (!token.startsWith(TOKEN_PREFIX)) return null;

    const rest = token.slice(TOKEN_PREFIX.length);
    const separatorIndex = rest.lastIndexOf(PAYLOAD_SEPARATOR);
    if (separatorIndex === -1) return null;

    const encoded = rest.slice(0, separatorIndex);
    const providedSignature = rest.slice(separatorIndex + 1);

    // Verify signature first (constant-time comparison)
    const expectedSignature = this.sign(encoded);
    if (!this.constantTimeEqual(providedSignature, expectedSignature)) {
      return null;
    }

    // Decode and check expiry
    try {
      const payload = this.decodePayload(encoded);
      if (Date.now() >= payload.exp) return null; // Expired
      return payload;
    } catch {
      return null;
    }
  }

  /** Extract the subject/label from a token (without full validation). */
  peek(token: string): { label: string; expiresAt: string } | null {
    if (!token.startsWith(TOKEN_PREFIX)) return null;
    const rest = token.slice(TOKEN_PREFIX.length);
    const separatorIndex = rest.lastIndexOf(PAYLOAD_SEPARATOR);
    if (separatorIndex === -1) return null;

    try {
      const payload = this.decodePayload(rest.slice(0, separatorIndex));
      return {
        label: payload.sub,
        expiresAt: new Date(payload.exp).toISOString(),
      };
    } catch {
      return null;
    }
  }

  /** Refresh a token's expiry (extends by ttlMs from now). Returns new token or null if original is invalid. */
  refresh(token: string): { token: string; expiresAt: string } | null {
    const payload = this.validate(token);
    if (!payload) return null;
    return this.generate(payload.sub, [...payload.scopes]);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private encodePayload(payload: TokenPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  private decodePayload(encoded: string): TokenPayload {
    return JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8"),
    ) as TokenPayload;
  }

  private sign(data: string): string {
    return createHmac("sha256", this.secret).update(data).digest("base64url");
  }

  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }
}
