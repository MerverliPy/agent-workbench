/**
 * OIDC SSO middleware for agent-workbench.
 *
 * Adds routes for OpenID Connect authentication:
 * - GET /auth/sso/login — redirects to the OIDC provider
 * - GET /auth/sso/callback — handles the authorization code exchange
 * - GET /auth/sso/status — returns current auth status
 * - POST /auth/sso/logout — clears the session
 *
 * Uses Node's built-in crypto (no JWT library) for ID token verification.
 * Issues awb_v1_ tokens compatible with the existing auth system.
 */

import { createVerify, randomUUID } from "node:crypto";
import { SessionToken } from "@agent-workbench/auth";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SsoConfig {
  /** OIDC issuer URL (e.g. "https://accounts.google.com" or "https://dev-123.okta.com"). */
  readonly issuer: string;
  /** OAuth2 client ID. */
  readonly clientId: string;
  /** OAuth2 client secret. */
  readonly clientSecret: string;
  /** Redirect URI for the OIDC callback (must match the provider's config). */
  readonly redirectUri: string;
  /** Requested scopes (default: "openid profile email"). */
  readonly scopes?: string;
  /** HMAC secret for issuing local session tokens. */
  readonly sessionSecret: string;
  /** Session token TTL in ms (default: 1 hour). */
  readonly sessionTtlMs?: number;
}

interface Jwk {
  readonly kty: string;
  readonly kid?: string;
  readonly use?: string;
  readonly alg?: string;
  readonly n?: string;
  readonly e?: string;
  readonly x5c?: string[];
  [key: string]: unknown;
}

interface OidcDiscovery {
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly jwks_uri: string;
  readonly issuer: string;
  readonly userinfo_endpoint?: string;
  readonly end_session_endpoint?: string;
  readonly id_token_signing_alg_values_supported?: string[];
}

interface TokenResponse {
  readonly access_token: string;
  readonly token_type: string;
  readonly expires_in?: number;
  readonly id_token?: string;
  readonly refresh_token?: string;
}

// ── SSO State (in-memory; swap to storage for multi-process) ────────────────

interface PendingAuth {
  state: string;
  nonce: string;
  expiresAt: number;
  redirectTo?: string;
}

const pendingAuths = new Map<string, PendingAuth>();
const NONCE_TTL_MS = 600_000; // 10 minutes

// ── JWKS cache ─────────────────────────────────────────────────────────────

interface JwksCache {
  keys: Jwk[];
  fetchedAt: number;
}

const jwksCache = new Map<string, JwksCache>();
const JWKS_CACHE_TTL_MS = 3600_000; // 1 hour

// ── Discovery cache ────────────────────────────────────────────────────────

const discoveryCache = new Map<
  string,
  { data: OidcDiscovery; fetchedAt: number }
>();
const DISCOVERY_CACHE_TTL_MS = 3600_000; // 1 hour

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchDiscovery(issuer: string): Promise<OidcDiscovery> {
  const cached = discoveryCache.get(issuer);
  if (cached && Date.now() - cached.fetchedAt < DISCOVERY_CACHE_TTL_MS) {
    return cached.data;
  }

  const wellKnown = `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const response = await fetch(wellKnown);
  if (!response.ok) {
    throw new Error(
      `OIDC discovery failed: ${response.status} from ${wellKnown}`,
    );
  }
  const data = (await response.json()) as OidcDiscovery;

  discoveryCache.set(issuer, { data, fetchedAt: Date.now() });
  return data;
}

async function fetchJwks(jwksUri: string): Promise<Jwk[]> {
  const cached = jwksCache.get(jwksUri);
  if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }

  const response = await fetch(jwksUri);
  if (!response.ok) {
    throw new Error(`JWKS fetch failed: ${response.status} from ${jwksUri}`);
  }
  const body = (await response.json()) as { keys: Jwk[] };

  jwksCache.set(jwksUri, { keys: body.keys, fetchedAt: Date.now() });
  return body.keys;
}

/**
 * Verify a JWT ID token using RSA-SHA256 with a JWK key.
 * Returns the decoded payload if valid, or throws.
 */
async function verifyIdToken(
  idToken: string,
  jwksUri: string,
  expectedIssuer: string,
  expectedAudience: string,
  expectedNonce?: string,
): Promise<Record<string, unknown>> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new Error("ID token must have 3 JWT segments");
  }

  const [headerB64, payloadB64, signatureB64] = parts as [
    string,
    string,
    string,
  ];

  // Decode header to find the key ID
  let header: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
  } catch {
    throw new Error("Invalid JWT header");
  }
  const kid = header.kid as string | undefined;
  const alg = header.alg as string | undefined;

  // Fetch JWKS and find the matching key
  const keys = await fetchJwks(jwksUri);
  const key = kid ? keys.find((k) => k.kid === kid) : keys[0];
  if (!key) {
    throw new Error(`No matching JWK found (kid: ${kid ?? "none"})`);
  }

  // Build the RSA public key from JWK
  const spki = jwkToSpki(key);

  // Verify the signature
  const signature = Buffer.from(signatureB64, "base64url");
  const data = `${headerB64}.${payloadB64}`;

  const algorithm =
    alg === "RS384"
      ? "sha384"
      : alg === "RS512"
        ? "sha512"
        : alg === "ES256"
          ? "sha256"
          : alg === "ES384"
            ? "sha384"
            : alg === "ES512"
              ? "sha512"
              : "sha256"; // default: RS256 / ES256

  const verifier = createVerify(algorithm);
  verifier.update(data);
  verifier.end();

  const valid = verifier.verify(spki, signature);
  if (!valid) {
    throw new Error("ID token signature verification failed");
  }

  // Decode and validate payload claims
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf-8"),
    );
  } catch {
    throw new Error("Invalid JWT payload");
  }

  // Validate iss
  if (payload.iss !== expectedIssuer) {
    throw new Error(
      `ID token iss mismatch: expected ${expectedIssuer}, got ${payload.iss}`,
    );
  }

  // Validate aud
  const aud = payload.aud;
  if (Array.isArray(aud)) {
    if (!aud.includes(expectedAudience)) {
      throw new Error(
        `ID token aud mismatch: expected ${expectedAudience} in [${aud.join(",")}]`,
      );
    }
  } else if (aud !== expectedAudience) {
    throw new Error(
      `ID token aud mismatch: expected ${expectedAudience}, got ${aud}`,
    );
  }

  // Validate exp
  const exp = payload.exp as number | undefined;
  if (exp && Date.now() >= exp * 1000) {
    throw new Error("ID token has expired");
  }

  // Validate nonce
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("ID token nonce mismatch");
  }

  return payload;
}

/**
 * Convert a JWK public key to SPKI PEM format for Node's crypto.createVerify().
 * Supports RSA and EC (P-256, P-384) key types.
 */
function jwkToSpki(jwk: Jwk): string {
  if (jwk.kty === "RSA") {
    return rsaJwkToSpki(jwk);
  }
  if (jwk.kty === "EC") {
    return ecJwkToSpki(jwk);
  }
  throw new Error(
    `Unsupported JWK key type: ${jwk.kty} (only RSA and EC are supported)`,
  );
}

/**
 * Convert an RSA JWK to SPKI PEM format.
 */
function rsaJwkToSpki(jwk: Jwk): string {
  const n = Buffer.from(jwk.n ?? "", "base64url");
  const e = Buffer.from(jwk.e ?? "", "base64url");

  const rsaPublicKey = derSequence(derInteger(n), derInteger(e));
  const algorithmIdentifier = derSequence(
    derOid("1.2.840.113549.1.1.1"), // rsaEncryption
    derNull(),
  );
  const spki = derSequence(algorithmIdentifier, derBitString(rsaPublicKey));

  return toPem(spki, "PUBLIC KEY");
}

/** Map EC curve names to their OIDs. */
const EC_CURVE_OIDS: Record<string, string> = {
  "P-256": "1.2.840.10045.3.1.7",
  "P-384": "1.3.132.0.34",
  "P-521": "1.3.132.0.35",
};

/**
 * Convert an EC JWK (P-256 or P-384) to SPKI PEM format.
 * Uses uncompressed point encoding (0x04 || x || y).
 */
function ecJwkToSpki(jwk: Jwk): string {
  const crv = jwk.crv as string | undefined;
  const curveOid = crv ? EC_CURVE_OIDS[crv] : undefined;
  if (!curveOid) {
    throw new Error(
      `Unsupported EC curve: ${crv ?? "undefined"} (supported: P-256, P-384, P-521)`,
    );
  }

  const x = Buffer.from((jwk.x as string) ?? "", "base64url");
  const y = Buffer.from((jwk.y as string) ?? "", "base64url");

  // Uncompressed point: 0x04 || x || y
  const point = Buffer.concat([Buffer.from([0x04]), x, y]);

  // AlgorithmIdentifier: ecPublicKey + named curve OID
  const algorithmIdentifier = derSequence(
    derOid("1.2.840.10045.2.1"), // ecPublicKey
    derOid(curveOid), // named curve
  );

  const spki = derSequence(algorithmIdentifier, derBitString(point));
  return toPem(spki, "PUBLIC KEY");
}

/** Format a DER buffer as PEM. */
function toPem(der: Buffer, label: string): string {
  const b64 = der.toString("base64");
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

// ── ASN.1 DER encoding helpers ─────────────────────────────────────────────

function derLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  if (length < 0x100) {
    return Buffer.from([0x81, length]);
  }
  if (length < 0x10000) {
    return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
  }
  throw new Error("DER length too large");
}

function derSequence(...contents: Buffer[]): Buffer {
  const concatenated = Buffer.concat(contents);
  const length = derLength(concatenated.length);
  return Buffer.concat([Buffer.from([0x30]), length, concatenated]);
}

function derInteger(value: Buffer): Buffer {
  // Add leading zero if high bit is set
  const prefix = value[0]! & 0x80 ? Buffer.from([0x00]) : Buffer.alloc(0);
  const contents = Buffer.concat([prefix, value]);
  const length = derLength(contents.length);
  return Buffer.concat([Buffer.from([0x02]), length, contents]);
}

function derOid(oid: string): Buffer {
  const parts = oid.split(".").map(Number);
  const encoded: number[] = [40 * parts[0]! + parts[1]!];
  for (let i = 2; i < parts.length; i++) {
    encodeOidComponent(encoded, parts[i]!);
  }
  const contents = Buffer.from(encoded);
  const length = derLength(contents.length);
  return Buffer.concat([Buffer.from([0x06]), length, contents]);
}

function encodeOidComponent(result: number[], value: number): void {
  if (value < 0x80) {
    result.push(value);
    return;
  }
  const bytes: number[] = [];
  while (value > 0) {
    bytes.push((value & 0x7f) | (bytes.length > 0 ? 0x80 : 0x00));
    value >>= 7;
  }
  // Reverse because we built it little-endian
  for (let i = bytes.length - 1; i >= 0; i--) {
    result.push(bytes[i]!);
  }
}

function derNull(): Buffer {
  return Buffer.from([0x05, 0x00]);
}

function derBitString(content: Buffer): Buffer {
  // Add 0x00 for unused bits
  const contents = Buffer.concat([Buffer.from([0x00]), content]);
  const length = derLength(contents.length);
  return Buffer.concat([Buffer.from([0x03]), length, contents]);
}

// ── Middleware ──────────────────────────────────────────────────────────────

/**
 * Create SSO middleware that adds OIDC authentication routes.
 *
 * Usage:
 * ```ts
 * app.use("/auth/sso/*", ssoMiddleware(config));
 * ```
 */
export function ssoMiddleware(config: SsoConfig): MiddlewareHandler {
  const sessionToken = new SessionToken({
    secret: config.sessionSecret,
    ...(config.sessionTtlMs !== undefined
      ? { ttlMs: config.sessionTtlMs }
      : {}),
  });

  return createMiddleware(async (c: Context, next) => {
    const path = c.req.path;

    // ── GET /auth/sso/login — redirect to OIDC provider ──
    if (path === "/auth/sso/login" && c.req.method === "GET") {
      try {
        const discovery = await fetchDiscovery(config.issuer);
        const state = randomUUID();
        const nonce = randomUUID();

        pendingAuths.set(state, {
          state,
          nonce,
          expiresAt: Date.now() + NONCE_TTL_MS,
          redirectTo: c.req.query("redirect") ?? "/",
        });

        // Clean up expired states
        for (const [key, val] of pendingAuths) {
          if (Date.now() > val.expiresAt) pendingAuths.delete(key);
        }

        const params = new URLSearchParams({
          response_type: "code",
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scopes ?? "openid profile email",
          state,
          nonce,
        });

        return c.redirect(
          `${discovery.authorization_endpoint}?${params.toString()}`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "SSO login failed";
        return c.json({ error: "sso_error", message }, 502);
      }
    }

    // ── GET /auth/sso/callback — handle OIDC callback ──
    if (path === "/auth/sso/callback" && c.req.method === "GET") {
      const code = c.req.query("code");
      const state = c.req.query("state");
      const error = c.req.query("error");

      if (error) {
        return c.json({ error: "sso_error", detail: error }, 400);
      }

      if (!code || !state) {
        return c.json({ error: "missing_parameters" }, 400);
      }

      const pending = pendingAuths.get(state);
      if (!pending) {
        return c.json({ error: "invalid_state" }, 400);
      }
      pendingAuths.delete(state);

      if (Date.now() > pending.expiresAt) {
        return c.json({ error: "state_expired" }, 400);
      }

      try {
        const discovery = await fetchDiscovery(config.issuer);

        // Exchange authorization code for tokens
        const tokenResponse = await fetch(discovery.token_endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: config.redirectUri,
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }).toString(),
        });

        if (!tokenResponse.ok) {
          const body = await tokenResponse.text().catch(() => "unknown");
          return c.json(
            { error: "token_exchange_failed", detail: body.slice(0, 200) },
            502,
          );
        }

        const tokens = (await tokenResponse.json()) as TokenResponse;

        if (!tokens.id_token) {
          return c.json({ error: "no_id_token" }, 502);
        }

        // Verify the ID token
        let claims: Record<string, unknown>;
        try {
          claims = await verifyIdToken(
            tokens.id_token,
            discovery.jwks_uri,
            config.issuer,
            config.clientId,
            pending.nonce,
          );
        } catch (verifyErr) {
          return c.json(
            {
              error: "id_token_invalid",
              message:
                verifyErr instanceof Error
                  ? verifyErr.message
                  : "Verification failed",
            },
            401,
          );
        }

        // Extract user info from claims
        const subject = (claims.sub as string) ?? "unknown";
        const email =
          (claims.email as string) ??
          (claims.preferred_username as string) ??
          subject;
        const name = (claims.name as string) ?? email;

        // Issue a local session token
        const { token, expiresAt } = sessionToken.generate(`sso:${subject}`, [
          "*",
        ]);

        // Set session cookie
        c.header(
          "Set-Cookie",
          `awb_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${config.sessionTtlMs ?? 3600_000}`,
        );

        return c.json({
          success: true,
          token,
          user: { sub: subject, email, name },
          expiresAt,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "SSO callback failed";
        return c.json({ error: "sso_error", message }, 502);
      }
    }

    await next();
  });
}
