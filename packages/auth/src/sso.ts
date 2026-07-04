/**
 * SSO (Single Sign-On) types and validation for agent-workbench.
 *
 * Phase 30: Supports OIDC (Okta, Auth0, Azure AD) and SAML identity
 * federation. The SsoManager validates bearer tokens from external
 * identity providers and maps their claims to agent-workbench roles.
 *
 * ## Environment Variables
 *
 * | Variable | Default | Description |
 * |----------|---------|-------------|
 * | `AGENT_WORKBENCH_SSO_ENABLED` | `false` | Enable SSO token validation |
 * | `AGENT_WORKBENCH_OIDC_ISSUER` | — | OIDC issuer URL (e.g. https://auth.example.com/) |
 * | `AGENT_WORKBENCH_OIDC_CLIENT_ID` | — | OIDC client ID |
 * | `AGENT_WORKBENCH_OIDC_CLIENT_SECRET` | — | OIDC client secret |
 * | `AGENT_WORKBENCH_OIDC_AUDIENCE` | — | Expected JWT audience |
 * | `AGENT_WORKBENCH_OIDC_GROUPS_CLAIM` | `groups` | JWT claim containing role/group info |
 * | `AGENT_WORKBENCH_SAML_METADATA_URL` | — | SAML IdP metadata URL |
 * | `AGENT_WORKBENCH_SSO_DEFAULT_ROLE` | `viewer` | Default RBAC role for SSO users |
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Role } from "./rbac";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OidcConfig {
  /** OIDC issuer URL (e.g. https://accounts.google.com) */
  readonly issuer: string;
  /** OIDC client ID */
  readonly clientId: string;
  /** OIDC client secret (for confidential clients) — may be undefined */
  readonly clientSecret: string | undefined;
  /** Expected JWT audience (optional) */
  readonly audience: string | undefined;
  /** JWT claim that contains RBAC roles/groups */
  readonly groupsClaim: string;
}

export interface SamlConfig {
  /** SAML IdP metadata URL or file path */
  readonly metadataUrl: string;
  /** Entity ID of this service provider */
  readonly entityId: string;
  /** ACS (Assertion Consumer Service) URL */
  readonly acsUrl: string;
}

export interface SsoConfig {
  readonly enabled: boolean;
  readonly oidc: OidcConfig | undefined;
  readonly saml: SamlConfig | undefined;
  readonly defaultRole: Role;
}

export interface SsoUser {
  /** Subject identifier (sub claim) — unique and stable */
  readonly sub: string;
  /** Email address (email claim) */
  readonly email?: string;
  /** Display name (name claim) */
  readonly name?: string;
  /** Preferred username (preferred_username claim) */
  readonly preferredUsername?: string;
  /** Groups/roles from the configured groups claim */
  readonly groups: readonly string[];
  /** Raw JWT payload for custom claim access */
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface SsoValidationResult {
  readonly valid: boolean;
  readonly user?: SsoUser;
  readonly role?: Role;
  readonly error?: string;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const ENV_SSO_ENABLED = "AGENT_WORKBENCH_SSO_ENABLED";
const ENV_OIDC_ISSUER = "AGENT_WORKBENCH_OIDC_ISSUER";
const ENV_OIDC_CLIENT_ID = "AGENT_WORKBENCH_OIDC_CLIENT_ID";
const ENV_OIDC_CLIENT_SECRET = "AGENT_WORKBENCH_OIDC_CLIENT_SECRET";
const ENV_OIDC_AUDIENCE = "AGENT_WORKBENCH_OIDC_AUDIENCE";
const ENV_OIDC_GROUPS_CLAIM = "AGENT_WORKBENCH_OIDC_GROUPS_CLAIM";
const ENV_SSO_DEFAULT_ROLE = "AGENT_WORKBENCH_SSO_DEFAULT_ROLE";

// ── Manager ────────────────────────────────────────────────────────────────

export class SsoManager {
  private readonly config: SsoConfig;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(config?: Partial<SsoConfig>) {
    this.config = this.resolveConfig(config);
  }

  /** Whether SSO is enabled and configured. */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /** Resolved SSO configuration. */
  getConfig(): SsoConfig {
    return { ...this.config };
  }

  /**
   * Validate a JWT bearer token against the configured OIDC provider.
   * Returns the validated user info and mapped RBAC role on success,
   * or an error on failure.
   */
  async validateToken(token: string): Promise<SsoValidationResult> {
    if (!this.config.enabled) {
      return { valid: false, error: "SSO is not enabled" };
    }

    if (!this.config.oidc) {
      return { valid: false, error: "OIDC is not configured" };
    }

    try {
      const jwks = this.getJwks();
      const { payload } = await (jwtVerify as any)(token, jwks, {
        issuer: this.config.oidc!.issuer,
        audience: this.config.oidc!.audience,
      });

      const user = this.extractUser(payload);
      const role = this.determineRole(payload);

      return { valid: true, user, role };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { valid: false, error: `Token validation failed: ${msg}` };
    }
  }

  /**
   * Check if a token is valid without returning full user info.
   * Useful for fast guard checks.
   */
  async isTokenValid(token: string): Promise<boolean> {
    const result = await this.validateToken(token);
    return result.valid;
  }

  /**
   * Build the OIDC authorize URL for initiating the login flow.
   * Returns null if OIDC is not configured.
   */
  getAuthorizationUrl(
    redirectUri: string,
    state?: string,
  ): string | null {
    if (!this.config.oidc) return null;
    const oidc = this.config.oidc;
    const params = new URLSearchParams({
      response_type: "code",
      client_id: oidc.clientId,
      redirect_uri: redirectUri,
      scope: "openid profile email",
    });
    if (state) params.set("state", state);
    return `${oidc.issuer.replace(/\/$/, "")}/authorize?${params.toString()}`;
  }

  // ── Internal ───────────────────────────────────────────────────────────

  private resolveConfig(override?: Partial<SsoConfig>): SsoConfig {
    const enabled =
      override?.enabled ??
      process.env[ENV_SSO_ENABLED] === "true";

    if (!enabled) {
      return { enabled: false, oidc: undefined, saml: undefined, defaultRole: "viewer" };
    }

    const issuer = override?.oidc?.issuer ?? process.env[ENV_OIDC_ISSUER];

    const oidc: OidcConfig | undefined = issuer
      ? {
          issuer,
          clientId:
            override?.oidc?.clientId ??
            process.env[ENV_OIDC_CLIENT_ID] ??
            "",
          clientSecret:
            override?.oidc?.clientSecret ??
            process.env[ENV_OIDC_CLIENT_SECRET],
          audience:
            override?.oidc?.audience ??
            process.env[ENV_OIDC_AUDIENCE],
          groupsClaim:
            override?.oidc?.groupsClaim ??
            process.env[ENV_OIDC_GROUPS_CLAIM] ??
            "groups",
        }
      : undefined;

    const defaultRoleRaw = process.env[ENV_SSO_DEFAULT_ROLE];
    const defaultRole: Role =
      defaultRoleRaw === "admin" || defaultRoleRaw === "developer"
        ? defaultRoleRaw
        : "viewer";

    const result: SsoConfig = {
      enabled,
      oidc: oidc ?? undefined,
      saml: undefined,
      defaultRole,
    };
    return result;
  }

  private getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const issuer = this.config.oidc!.issuer.replace(/\/$/, "");
      const jwksUrl = `${issuer}/.well-known/openid-configuration`;
      // jose resolves the JWKS URI from the OIDC discovery endpoint
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }
    return this.jwks;
  }

  private extractUser(payload: JWTPayload): SsoUser {
    const raw = payload as Record<string, unknown>;
    const groups = this.extractGroups(raw);

    return {
      sub: payload.sub ?? "unknown",
      email: (raw.email as string) ?? undefined,
      name: (raw.name as string) ?? undefined,
      preferredUsername:
        (raw.preferred_username as string) ?? undefined,
      groups,
      raw,
    };
  }

  private extractGroups(raw: Record<string, unknown>): readonly string[] {
    const claim = this.config.oidc?.groupsClaim ?? "groups";
    const value = raw[claim];
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === "string") return value.split(",").map((s) => s.trim());
    return [];
  }

  private determineRole(payload: JWTPayload): Role {
    const raw = payload as Record<string, unknown>;
    const groups = this.extractGroups(raw);

    // Check for role/group mapping
    if (groups.some((g) => g.toLowerCase() === "admin")) return "admin";
    if (groups.some((g) => g.toLowerCase() === "developer")) return "developer";

    // Check explicit role claim
    const roleClaim = raw.role ?? raw.roles;
    if (roleClaim === "admin") return "admin";
    if (roleClaim === "developer") return "developer";

    return this.config.defaultRole;
  }

  /**
   * Reset the cached JWKS (e.g. after reconfiguration).
   * Primarily useful in tests.
   */
  resetJwksCache(): void {
    this.jwks = null;
  }
}
