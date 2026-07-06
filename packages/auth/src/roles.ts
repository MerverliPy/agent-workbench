/**
 * Role-Based Access Control (RBAC) — Phase 30.
 *
 * Defines roles and maps them to sets of authorization scopes.
 * Integrates with the existing scope-based auth system:
 * the auth middleware validates tokens and sets `c.get("auth")`,
 * and this module checks if the authenticated user has the
 * required role/scopes for a given route.
 */

import { Scope, hasScope } from "./scopes";

// ── Role definitions ────────────────────────────────────────────────────────

export type Role = "admin" | "developer" | "viewer";

/**
 * Scope-to-role mapping.
 * Each role is granted a set of scopes. Higher roles inherit
 * all scopes from lower roles.
 *
 * - `admin`: Everything (wildcard)
 * - `developer`: Full read+write on sessions, messages, files, shell, tools, collaboration
 * - `viewer`: Read-only access to sessions, messages, files, presence
 */
const ROLE_SCOPES: Record<Role, readonly string[]> = {
  admin: [Scope.ADMIN],

  developer: [
    Scope.SESSION_READ,
    Scope.SESSION_WRITE,
    Scope.MESSAGE_READ,
    Scope.MESSAGE_WRITE,
    Scope.FILE_READ,
    Scope.FILE_WRITE,
    Scope.SHELL_EXEC,
    Scope.TOOL_READ,
    Scope.TOOL_WRITE,
    Scope.SHARE_CREATE,
    Scope.SHARE_READ,
    Scope.REVIEW_SUBMIT,
    Scope.REVIEW_DECIDE,
    Scope.PRESENCE_READ,
  ],

  viewer: [
    Scope.SESSION_READ,
    Scope.MESSAGE_READ,
    Scope.FILE_READ,
    Scope.PRESENCE_READ,
    Scope.SHARE_READ,
  ],
};

// ── Role hierarchy (for inheritance) ────────────────────────────────────────

const ROLE_HIERARCHY: Role[] = ["viewer", "developer", "admin"];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Get all scopes granted to a role (including inherited scopes).
 */
export function getScopesForRole(role: Role): readonly string[] {
  const idx = ROLE_HIERARCHY.indexOf(role);
  if (idx === -1) return ROLE_SCOPES[role] ?? [];

  // Collect all scopes from this role and below
  const scopes = new Set<string>();
  for (let i = 0; i <= idx; i++) {
    for (const scope of ROLE_SCOPES[ROLE_HIERARCHY[i]!] ?? []) {
      scopes.add(scope);
    }
  }
  return [...scopes];
}

/**
 * Check whether a set of token scopes satisfies a required role.
 * Admin matches everything (wildcard).
 */
export function hasRole(
  requiredRole: Role,
  tokenScopes: readonly string[] | undefined | null,
): boolean {
  if (!tokenScopes || tokenScopes.length === 0) return false;
  if (tokenScopes.includes(Scope.ADMIN)) return true;

  const requiredScopes = getScopesForRole(requiredRole);
  // Token must have ALL scopes required by the role
  return requiredScopes.every((required) => tokenScopes.includes(required));
}

/**
 * Get the highest role that a set of scopes satisfies.
 * Returns the role name, or null if no role matches.
 */
export function getRoleFromScopes(
  tokenScopes: readonly string[] | undefined | null,
): Role | null {
  if (!tokenScopes || tokenScopes.length === 0) return null;
  if (tokenScopes.includes(Scope.ADMIN)) return "admin";

  // Check from highest to lowest
  for (let i = ROLE_HIERARCHY.length - 1; i >= 0; i--) {
    const role = ROLE_HIERARCHY[i]!;
    if (hasRole(role, tokenScopes)) return role;
  }
  return null;
}

/**
 * List all defined roles in ascending privilege order.
 */
export function listRoles(): readonly Role[] {
  return [...ROLE_HIERARCHY];
}
