import { describe, it, expect } from "bun:test";
import { hasRole, getScopesForRole, getRoleFromScopes, listRoles } from "./roles";
import { Scope } from "./scopes";

describe("RBAC roles", () => {
  describe("getScopesForRole", () => {
    it("viewer has read-only scopes", () => {
      const scopes = getScopesForRole("viewer");
      expect(scopes).toContain(Scope.SESSION_READ);
      expect(scopes).toContain(Scope.MESSAGE_READ);
      expect(scopes).toContain(Scope.FILE_READ);
      expect(scopes).not.toContain(Scope.SESSION_WRITE);
      expect(scopes).not.toContain(Scope.FILE_WRITE);
      expect(scopes).not.toContain(Scope.SHELL_EXEC);
    });

    it("developer has full read+write", () => {
      const scopes = getScopesForRole("developer");
      expect(scopes).toContain(Scope.SESSION_READ);
      expect(scopes).toContain(Scope.SESSION_WRITE);
      expect(scopes).toContain(Scope.FILE_WRITE);
      expect(scopes).toContain(Scope.SHELL_EXEC);
      expect(scopes).not.toContain(Scope.ADMIN);
    });

    it("admin grants only the admin wildcard", () => {
      const scopes = getScopesForRole("admin");
      expect(scopes).toContain(Scope.ADMIN);
      // Admin has the wildcard — specific scopes don't matter
    });
  });

  describe("hasRole", () => {
    it("viewer scopes satisfy viewer role", () => {
      const viewerScopes = getScopesForRole("viewer");
      expect(hasRole("viewer", viewerScopes)).toBe(true);
    });

    it("viewer scopes do NOT satisfy developer role", () => {
      const viewerScopes = getScopesForRole("viewer");
      expect(hasRole("developer", viewerScopes)).toBe(false);
    });

    it("developer scopes satisfy both viewer and developer roles", () => {
      const devScopes = getScopesForRole("developer");
      expect(hasRole("viewer", devScopes)).toBe(true);
      expect(hasRole("developer", devScopes)).toBe(true);
    });

    it("admin wildcard satisfies all roles", () => {
      const adminScopes = [Scope.ADMIN];
      expect(hasRole("viewer", adminScopes)).toBe(true);
      expect(hasRole("developer", adminScopes)).toBe(true);
      expect(hasRole("admin", adminScopes)).toBe(true);
    });

    it("returns false for undefined scopes", () => {
      expect(hasRole("viewer", undefined)).toBe(false);
      expect(hasRole("viewer", null)).toBe(false);
    });

    it("returns false for empty scopes", () => {
      expect(hasRole("viewer", [])).toBe(false);
    });

    it("returns false for non-matching scopes", () => {
      expect(hasRole("viewer", ["unknown:scope"])).toBe(false);
    });
  });

  describe("getRoleFromScopes", () => {
    it("identifies admin from wildcard", () => {
      expect(getRoleFromScopes([Scope.ADMIN])).toBe("admin");
    });

    it("identifies developer from write scopes", () => {
      const devScopes = getScopesForRole("developer");
      expect(getRoleFromScopes(devScopes)).toBe("developer");
    });

    it("identifies viewer from read-only scopes", () => {
      const viewerScopes = getScopesForRole("viewer");
      expect(getRoleFromScopes(viewerScopes)).toBe("viewer");
    });

    it("returns null for unrecognized scopes", () => {
      expect(getRoleFromScopes(["unknown:scope"])).toBeNull();
    });

    it("returns null for undefined/null scopes", () => {
      expect(getRoleFromScopes(undefined)).toBeNull();
      expect(getRoleFromScopes(null)).toBeNull();
    });
  });

  describe("role hierarchy", () => {
    it("viewer < developer < admin", () => {
      const roles = listRoles();
      expect(roles).toEqual(["viewer", "developer", "admin"]);
    });

    it("developer scopes include all viewer scopes", () => {
      const viewer = new Set(getScopesForRole("viewer"));
      const developer = new Set(getScopesForRole("developer"));
      for (const scope of viewer) {
        expect(developer.has(scope)).toBe(true);
      }
    });
  });
});
