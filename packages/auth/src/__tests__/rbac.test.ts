/// <reference types="bun" />
import { describe, expect, it, beforeAll } from "bun:test";
import {
  ROLES,
  getRoleScopes,
  roleHasScope,
  resolveRole,
  isValidRole,
  ENV_RBAC_ENABLED,
  ENV_DEFAULT_ROLE,
} from "../rbac";
import { Scope } from "../scopes";
import { AuthManager } from "../auth-manager";
import { rbacMiddleware } from "../rbac-middleware";
import type { RbacMiddlewareOptions } from "../rbac-middleware";
import { Hono } from "hono";

// ── RBAC helpers ─────────────────────────────────────────────────────────────

describe("RBAC — roles and permission matrix", () => {
  describe("ROLES constant", () => {
    it("defines viewer, developer, admin", () => {
      expect(ROLES).toEqual(["viewer", "developer", "admin"]);
    });
  });

  describe("isValidRole", () => {
    it("returns true for valid roles", () => {
      expect(isValidRole("viewer")).toBe(true);
      expect(isValidRole("developer")).toBe(true);
      expect(isValidRole("admin")).toBe(true);
    });

    it("returns false for invalid roles", () => {
      expect(isValidRole("superadmin")).toBe(false);
      expect(isValidRole("")).toBe(false);
      expect(isValidRole("user")).toBe(false);
    });
  });

  describe("getRoleScopes", () => {
    it("viewer has read-only access", () => {
      const scopes = getRoleScopes("viewer");
      expect(scopes).toContain(Scope.SESSION_READ);
      expect(scopes).toContain(Scope.FILE_READ);
      expect(scopes).toContain(Scope.MESSAGE_READ);
      expect(scopes).toContain(Scope.TOOL_READ);
      expect(scopes).toContain(Scope.PRESENCE_READ);
      expect(scopes).toContain(Scope.SHARE_READ);
      expect(scopes).toContain("metrics:read");
      expect(scopes).toContain("config:read");
      // Viewer should NOT have write scopes
      expect(scopes).not.toContain(Scope.FILE_WRITE);
      expect(scopes).not.toContain(Scope.SHELL_EXEC);
      expect(scopes).not.toContain(Scope.ADMIN);
    });

    it("developer has read-write-exec access", () => {
      const scopes = getRoleScopes("developer");
      expect(scopes).toContain(Scope.SESSION_READ);
      expect(scopes).toContain(Scope.SESSION_WRITE);
      expect(scopes).toContain(Scope.FILE_READ);
      expect(scopes).toContain(Scope.FILE_WRITE);
      expect(scopes).toContain(Scope.SHELL_EXEC);
      expect(scopes).toContain(Scope.TOOL_READ);
      expect(scopes).toContain(Scope.TOOL_WRITE);
      expect(scopes).toContain(Scope.PRESENCE_READ);
      expect(scopes).toContain(Scope.SHARE_CREATE);
      expect(scopes).toContain(Scope.SHARE_READ);
      expect(scopes).toContain(Scope.REVIEW_SUBMIT);
      expect(scopes).toContain("metrics:read");
      expect(scopes).toContain("config:read");
      expect(scopes).toContain("eval:*");
      // Developer should NOT have admin
      expect(scopes).not.toContain(Scope.ADMIN);
    });

    it("admin has the admin wildcard scope", () => {
      const scopes = getRoleScopes("admin");
      expect(scopes).toContain(Scope.ADMIN);
    });
  });

  describe("roleHasScope", () => {
    it("viewer is allowed session:read", () => {
      expect(roleHasScope("viewer", [Scope.SESSION_READ])).toBe(true);
    });

    it("viewer is NOT allowed file:write", () => {
      expect(roleHasScope("viewer", [Scope.FILE_WRITE])).toBe(false);
    });

    it("viewer is NOT allowed shell:exec", () => {
      expect(roleHasScope("viewer", [Scope.SHELL_EXEC])).toBe(false);
    });

    it("developer is allowed shell:exec", () => {
      expect(roleHasScope("developer", [Scope.SHELL_EXEC])).toBe(true);
    });

    it("developer is allowed file:write", () => {
      expect(roleHasScope("developer", [Scope.FILE_WRITE])).toBe(true);
    });

    it("developer is NOT allowed admin", () => {
      expect(roleHasScope("developer", [Scope.ADMIN])).toBe(false);
    });

    it("admin is allowed everything (wildcard)", () => {
      expect(roleHasScope("admin", [Scope.ADMIN])).toBe(true);
      expect(roleHasScope("admin", [Scope.SHELL_EXEC])).toBe(true);
      expect(roleHasScope("admin", [Scope.FILE_WRITE])).toBe(true);
      expect(roleHasScope("admin", ["anything:random"])).toBe(true);
    });

    it("checking multiple required scopes — any match suffices", () => {
      expect(roleHasScope("viewer", [Scope.FILE_WRITE, Scope.FILE_READ])).toBe(true);
      expect(roleHasScope("viewer", [Scope.FILE_WRITE, Scope.SHELL_EXEC])).toBe(false);
    });
  });

  describe("resolveRole", () => {
    it("resolves known role strings", () => {
      expect(resolveRole("admin")).toBe("admin");
      expect(resolveRole("developer")).toBe("developer");
      expect(resolveRole("viewer")).toBe("viewer");
    });

    it("falls back to viewer for unknown values", () => {
      expect(resolveRole("superadmin")).toBe("viewer");
      expect(resolveRole("")).toBe("viewer");
    });

    it("falls back to viewer for null/undefined", () => {
      expect(resolveRole(null)).toBe("viewer");
      expect(resolveRole(undefined)).toBe("viewer");
    });

    it("uses env var default role when set", () => {
      const prev = process.env[ENV_DEFAULT_ROLE];
      try {
        process.env[ENV_DEFAULT_ROLE] = "developer";
        expect(resolveRole(null)).toBe("developer");
      } finally {
        process.env[ENV_DEFAULT_ROLE] = prev;
      }
    });
  });
});

// ── AuthManager role methods ─────────────────────────────────────────────────

describe("AuthManager — role methods", () => {
  const AUTH_SECRET = "test-secret-at-least-16-chars!!";

  beforeAll(() => {
    process.env.AGENT_WORKBENCH_AUTH_SECRET = AUTH_SECRET;
    process.env.AGENT_WORKBENCH_AUTH_ENABLED = "true";
  });

  it("generateToken stores role in token record", () => {
    const auth = new AuthManager();
    const result = auth.generateToken("test-device", ["*"], "developer");
    expect(result).not.toBeNull();
    expect(result!.token).toBeTruthy();
    expect(result!.expiresAt).toBeTruthy();

    // Validate and check role
    const validated = auth.validateToken(result!.token);
    expect(validated).not.toBeNull();
    expect(validated!.role).toBe("developer");
  });

  it("generateToken defaults to no role when not provided", () => {
    const auth = new AuthManager();
    const result = auth.generateToken("test-device");
    expect(result).not.toBeNull();

    const validated = auth.validateToken(result!.token);
    expect(validated!.role).toBeUndefined();
  });

  it("generateToken accepts viewer role", () => {
    const auth = new AuthManager();
    const result = auth.generateToken("viewer-device", ["*"], "viewer");
    expect(result).not.toBeNull();

    const validated = auth.validateToken(result!.token);
    expect(validated!.role).toBe("viewer");
  });

  it("generateToken accepts admin role", () => {
    const auth = new AuthManager();
    const result = auth.generateToken("admin-device", ["*"], "admin");
    expect(result).not.toBeNull();

    const validated = auth.validateToken(result!.token);
    expect(validated!.role).toBe("admin");
  });

  it("getUserRole returns resolved role for valid token", () => {
    const auth = new AuthManager();
    const result = auth.generateToken("test", ["*"], "developer");
    const role = auth.getUserRole(result!.token);
    expect(role).toBe("developer");
  });

  it("getUserRole returns viewer for token without role", () => {
    const auth = new AuthManager();
    const result = auth.generateToken("test");
    const role = auth.getUserRole(result!.token);
    expect(role).toBe("viewer"); // default fallback
  });

  it("getUserRole returns null for invalid token", () => {
    const auth = new AuthManager();
    const role = auth.getUserRole("invalid-token");
    expect(role).toBeNull();
  });

  it("getUserRole returns null when auth is disabled", () => {
    process.env.AGENT_WORKBENCH_AUTH_ENABLED = "false";
    const auth = new AuthManager();
    const role = auth.getUserRole("some-token");
    expect(role).toBeNull();
    process.env.AGENT_WORKBENCH_AUTH_ENABLED = "true";
  });
});

// ── RBAC Middleware ──────────────────────────────────────────────────────────

describe("RBAC middleware", () => {
  const AUTH_SECRET = "test-secret-at-least-16-chars!!";

  function createTestApp() {
    process.env.AGENT_WORKBENCH_AUTH_SECRET = AUTH_SECRET;
    process.env.AGENT_WORKBENCH_AUTH_ENABLED = "true";
    process.env[ENV_RBAC_ENABLED] = "true";

    const auth = new AuthManager();

    const app = new Hono();

    // Admin-only route
    app.get("/admin/settings", rbacMiddleware({
      auth,
      requiredScopes: ["admin"],
    }), (c) => c.json({ ok: true }));

    // Developer route (requires shell:exec)
    app.post("/api/execute", rbacMiddleware({
      auth,
      requiredScopes: ["shell:exec"],
    }), (c) => c.json({ ok: true }));

    // Viewer route (read-only)
    app.get("/api/sessions", rbacMiddleware({
      auth,
      requiredScopes: ["session:read"],
    }), (c) => c.json({ ok: true }));

    // Exempt path
    app.get("/health", rbacMiddleware({
      auth,
      requiredScopes: ["admin"],
      excludePaths: ["/health"],
    }), (c) => c.json({ ok: true }));

    return { app, auth };
  }

  it("returns 401 when no auth header is provided", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 for invalid token", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/sessions", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status).toBe(401);
  });

  it("allows viewer token to access read-only route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("viewer-device", ["*"], "viewer")!;
    const res = await app.request("/api/sessions", {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(200);
  });

  it("blocks viewer token from accessing developer route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("viewer-device", ["*"], "viewer")!;
    const res = await app.request("/api/execute", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(body.message).toContain("viewer");
  });

  it("blocks viewer token from accessing admin route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("viewer-device", ["*"], "viewer")!;
    const res = await app.request("/admin/settings", {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(403);
  });

  it("allows developer token to access developer route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("dev-device", ["*"], "developer")!;
    const res = await app.request("/api/execute", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(200);
  });

  it("blocks developer token from accessing admin route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("dev-device", ["*"], "developer")!;
    const res = await app.request("/admin/settings", {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(403);
  });

  it("allows admin token to access admin route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("admin-device", ["*"], "admin")!;
    const res = await app.request("/admin/settings", {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(200);
  });

  it("allows admin token to access any route", async () => {
    const { app, auth } = createTestApp();
    const token = auth.generateToken("admin-device", ["*"], "admin")!;
    const res = await app.request("/api/sessions", {
      headers: { Authorization: `Bearer ${token.token}` },
    });
    expect(res.status).toBe(200);
  });

  it("respects excludePaths", async () => {
    const { app } = createTestApp();
    // Exempt /health should pass even without token
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  it("passes through when RBAC env var is disabled", async () => {
    const { app } = createTestApp();
    // Override after creation — middleware reads env var at request time
    process.env[ENV_RBAC_ENABLED] = "false";
    // RBAC disabled → middleware passes through → handler runs → 200
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);
    process.env[ENV_RBAC_ENABLED] = "true";
  });

  it("passes through when auth is disabled globally", async () => {
    process.env.AGENT_WORKBENCH_AUTH_ENABLED = "false";
    const auth = new AuthManager();
    const app = new Hono();
    app.get("/test", rbacMiddleware({ auth, requiredScopes: ["admin"] }), (c) => c.json({ ok: true }));

    const res = await app.request("/test");
    expect(res.status).toBe(200);
    process.env.AGENT_WORKBENCH_AUTH_ENABLED = "true";
  });
});
