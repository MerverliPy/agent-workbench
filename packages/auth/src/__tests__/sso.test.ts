/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { SsoManager } from "../sso";

describe("SsoManager", () => {
  describe("configuration", () => {
    it("starts disabled by default", () => {
      const sso = new SsoManager();
      expect(sso.enabled).toBe(false);
      const config = sso.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.oidc).toBeUndefined();
      expect(config.defaultRole).toBe("viewer");
    });

    it("reads enabled from env", () => {
      process.env.AGENT_WORKBENCH_SSO_ENABLED = "true";
      process.env.AGENT_WORKBENCH_OIDC_ISSUER = "https://auth.example.com";
      process.env.AGENT_WORKBENCH_OIDC_CLIENT_ID = "client123";

      const sso = new SsoManager();
      expect(sso.enabled).toBe(true);
      const config = sso.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.oidc?.issuer).toBe("https://auth.example.com");
      expect(config.oidc?.clientId).toBe("client123");

      delete process.env.AGENT_WORKBENCH_SSO_ENABLED;
      delete process.env.AGENT_WORKBENCH_OIDC_ISSUER;
      delete process.env.AGENT_WORKBENCH_OIDC_CLIENT_ID;
    });

    it("accepts constructor override", () => {
      const sso = new SsoManager({
        enabled: true,
        oidc: {
          issuer: "https://my-issuer.com",
          clientId: "my-client",
          clientSecret: undefined,
          audience: undefined,
          groupsClaim: "roles",
        },
      });
      expect(sso.enabled).toBe(true);
      const config = sso.getConfig();
      expect(config.oidc?.issuer).toBe("https://my-issuer.com");
      expect(config.oidc?.groupsClaim).toBe("roles");
      expect(config.defaultRole).toBe("viewer");
    });

    it("reads default role from env", () => {
      process.env.AGENT_WORKBENCH_SSO_ENABLED = "true";
      process.env.AGENT_WORKBENCH_OIDC_ISSUER = "https://auth.example.com";
      process.env.AGENT_WORKBENCH_OIDC_CLIENT_ID = "client123";
      process.env.AGENT_WORKBENCH_SSO_DEFAULT_ROLE = "developer";

      const sso = new SsoManager();
      expect(sso.getConfig().defaultRole).toBe("developer");

      delete process.env.AGENT_WORKBENCH_SSO_ENABLED;
      delete process.env.AGENT_WORKBENCH_OIDC_ISSUER;
      delete process.env.AGENT_WORKBENCH_OIDC_CLIENT_ID;
      delete process.env.AGENT_WORKBENCH_SSO_DEFAULT_ROLE;
    });
  });

  describe("validateToken", () => {
    it("returns error when disabled", async () => {
      const sso = new SsoManager();
      const result = await sso.validateToken("some-token");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not enabled");
    });

    it("returns error when OIDC is not configured", async () => {
      const sso = new SsoManager({ enabled: true });
      const result = await sso.validateToken("some-token");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not configured");
    });

    it("returns error for malformed JWT", async () => {
      const sso = new SsoManager({
        enabled: true,
        oidc: {
          issuer: "https://auth.example.com",
          clientId: "client123",
          clientSecret: undefined,
          audience: undefined,
          groupsClaim: "groups",
        },
      });
      const result = await sso.validateToken("not-a-jwt");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("rejects token with invalid signature (no network needed)", async () => {
      // Create a self-signed JWT that won't match any real JWKS
      const header = btoa(JSON.stringify({ alg: "RS256", kid: "test" }));
      const payload = btoa(
        JSON.stringify({
          sub: "user123",
          iss: "https://auth.example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      const fakeToken = `${header}.${payload}.invalidsignature`;

      const sso = new SsoManager({
        enabled: true,
        oidc: {
          issuer: "https://auth.example.com",
          clientId: "client123",
          clientSecret: undefined,
          audience: undefined,
          groupsClaim: "groups",
        },
      });

      const result = await sso.validateToken(fakeToken);
      expect(result.valid).toBe(false);
    });
  });

  describe("getAuthorizationUrl", () => {
    it("returns null when OIDC is not configured", () => {
      const sso = new SsoManager({ enabled: true });
      const url = sso.getAuthorizationUrl("https://app.com/callback");
      expect(url).toBeNull();
    });

    it("builds correct authorize URL", () => {
      const sso = new SsoManager({
        enabled: true,
        oidc: {
          issuer: "https://accounts.example.com",
          clientId: "app123",
          clientSecret: undefined,
          audience: undefined,
          groupsClaim: "groups",
        },
      });

      const url = sso.getAuthorizationUrl(
        "https://app.com/auth/sso/callback",
        "state123",
      );
      expect(url).toBe(`https://accounts.example.com/authorize?response_type=code&client_id=app123&redirect_uri=https%3A%2F%2Fapp.com%2Fauth%2Fsso%2Fcallback&scope=openid+profile+email&state=state123`);
    });
  });

  describe("isTokenValid", () => {
    it("returns false when SSO is disabled", async () => {
      const sso = new SsoManager();
      expect(await sso.isTokenValid("any-token")).toBe(false);
    });
  });
});
