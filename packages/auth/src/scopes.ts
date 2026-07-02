/**
 * Authorization scope constants for agent-workbench.
 *
 * Phase 27: Defines the standard scope strings used by bearer tokens
 * for route-level authorization. Tokens carry a `scopes` array that
 * is checked against the required scope for each route.
 *
 * ## Scope conventions
 *
 * - `resource:action` — standard CRUD-style format
 * - `admin` — wildcard scope that grants access to everything
 * - Scopes are matched as prefixes: `session:read` matches `session:read`
 * - `admin` matches any scope check
 *
 * ## Usage
 *
 * ```ts
 * import { Scope } from "@agent-workbench/auth";
 *
 * // Check if a token's scopes include a required scope
 * const hasAccess = Scopes.hasAny(["session:read", "session:write"], tokenScopes);
 * ```
 */

// ── Scope constants ────────────────────────────────────────────────────────

export const Scope = {
  // Sessions
  SESSION_READ: "session:read",
  SESSION_WRITE: "session:write",

  // Messages
  MESSAGE_READ: "message:read",
  MESSAGE_WRITE: "message:write",

  // Files
  FILE_READ: "file:read",
  FILE_WRITE: "file:write",

  // Shell
  SHELL_EXEC: "shell:exec",

  // Tools
  TOOL_READ: "tool:read",
  TOOL_WRITE: "tool:write",

  // Collaboration (Phase 27)
  SHARE_CREATE: "share:create",
  SHARE_READ: "share:read",
  REVIEW_SUBMIT: "review:submit",
  REVIEW_DECIDE: "review:decide",

  // Presence
  PRESENCE_READ: "presence:read",

  // Administration
  ADMIN: "admin",
} as const;

export type ScopeValue = (typeof Scope)[keyof typeof Scope];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Check if a token's scopes include at least one of the required scopes.
 * `admin` is treated as a wildcard that matches everything.
 */
export function hasScope(
  requiredScopes: readonly string[],
  tokenScopes: readonly string[] | undefined | null,
): boolean {
  if (!tokenScopes || tokenScopes.length === 0) return false;
  if (tokenScopes.includes(Scope.ADMIN)) return true;
  return requiredScopes.some((required) => tokenScopes.includes(required));
}

/**
 * Get the default scopes for a token that doesn't specify any.
 * Read-write by default (no restrictions).
 */
export function defaultScopes(): string[] {
  return ["*"];
}

/**
 * Check if a scope value matches a required scope.
 * Supports wildcard matching: `*` matches everything.
 */
export function scopeMatches(
  required: string,
  tokenScope: string,
): boolean {
  if (tokenScope === "*") return true;
  return tokenScope === required;
}
