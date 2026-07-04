/**
 * Role-Based Access Control types and permission matrix for agent-workbench.
 *
 * Phase 30: Defines the standard roles and the scope-permission mapping
 * used by the RBAC middleware to authorise requests beyond simple
 * bearer-token authentication.
 *
 * ## Roles
 *
 * | Role      | Description                                      |
 * |-----------|--------------------------------------------------|
 * | `viewer`  | Read-only access to sessions, files, metrics     |
 * | `developer` | Everything viewer can + write/edit, shell, eval  |
 * | `admin`   | Everything developer can + manage auth, plugins  |
 *
 * ## Permission matrix
 *
 * Each role maps to a set of scopes (from the existing Scope constants).
 * A request is authorised if the role's scopes include at least one of
 * the required scopes for the route.
 */

import { Scope } from "./scopes";

// ── Role type ────────────────────────────────────────────────────────────────

export const ROLES = ["viewer", "developer", "admin"] as const;

export type Role = (typeof ROLES)[number];

// ── Permission matrix ────────────────────────────────────────────────────────
// Maps each role to the set of scopes it grants.

const ROLE_SCOPES: Record<Role, readonly string[]> = {
  viewer: [
    Scope.SESSION_READ,
    Scope.MESSAGE_READ,
    Scope.FILE_READ,
    Scope.TOOL_READ,
    Scope.PRESENCE_READ,
    Scope.SHARE_READ,
    "metrics:read",
    "config:read",
  ],

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
    Scope.PRESENCE_READ,
    Scope.SHARE_CREATE,
    Scope.SHARE_READ,
    Scope.REVIEW_SUBMIT,
    "metrics:read",
    "config:read",
    "eval:*",
  ],

  admin: [
    Scope.ADMIN, // wildcard — matches everything
  ],
};

/**
 * Environment variable that controls RBAC enforcement.
 * When set to "true" (or "1"), the RBAC middleware operates.
 */
export const ENV_RBAC_ENABLED = "AGENT_WORKBENCH_RBAC_ENABLED";

/**
 * Environment variable that can set a default role for tokens
 * that don't have an explicit role assigned.
 */
export const ENV_DEFAULT_ROLE = "AGENT_WORKBENCH_DEFAULT_ROLE";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the scopes granted by a given role.
 */
export function getRoleScopes(role: Role): readonly string[] {
  return ROLE_SCOPES[role];
}

/**
 * Check whether a role has at least one of the required scopes.
 */
export function roleHasScope(
  role: Role,
  requiredScopes: readonly string[],
): boolean {
  const granted = ROLE_SCOPES[role];
  if (granted.includes(Scope.ADMIN)) return true; // admin wildcard
  return requiredScopes.some((s) => granted.includes(s));
}

/**
 * Resolve the role from a stored string value.
 * Falls back to the env-configured default role or "viewer".
 */
export function resolveRole(value: string | null | undefined): Role {
  if (value && (ROLES as readonly string[]).includes(value)) {
    return value as Role;
  }
  const envDefault = process.env[ENV_DEFAULT_ROLE];
  if (envDefault && (ROLES as readonly string[]).includes(envDefault)) {
    return envDefault as Role;
  }
  return "viewer";
}

/**
 * Assert that a role is valid.
 */
export function isValidRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
