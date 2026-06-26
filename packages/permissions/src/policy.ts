/**
 * Default permission policy for agent-workbench.
 *
 * Implements the posture defined in docs/05_PERMISSION_MODEL.md §3:
 *   read/grep/glob → allow
 *   write/edit/apply_patch/diff_preview/revert_last_change → ask
 *   bash → ask
 *   destructive shell commands → deny (CommandRule)
 *
 * Path-level sensitive patterns are Provisional — PERM-004 (unresolved).
 * Command-level destructive patterns are Provisional — PERM-005 (unresolved).
 * Exact precedence order is Provisional — PERM-002.
 *
 * This file defines a static default. The PermissionEngine accepts any
 * PermissionPolicy, so callers can inject an override policy for testing or
 * future config-driven overrides without changing this file.
 */

import type { PermissionPolicy } from "./types";

// ── Tool-level rules ─────────────────────────────────────────────────────────

/**
 * Default tool-level posture.
 *
 * Tools not listed here fall through to the engine's fallback (ask / high).
 * This covers all Phase 7 read-only tools and the Phase 9-10 tool names so
 * the engine is prepared for when those tools are registered.
 */
const TOOL_RULES: PermissionPolicy["toolRules"] = [
  // ── Read-only tools (Phase 7) ────────────────────────────────────────────
  {
    toolName: "read",
    outcome: "allow",
    riskLevel: "low",
    reason: "Read-only file access is allowed by default.",
  },
  {
    toolName: "grep",
    outcome: "allow",
    riskLevel: "low",
    reason: "Read-only file search is allowed by default.",
  },
  {
    toolName: "glob",
    outcome: "allow",
    riskLevel: "low",
    reason: "Read-only path enumeration is allowed by default.",
  },

  // ── File mutation tools (Phase 9 — defined here so policy exists before tools do) ──
  {
    toolName: "write",
    outcome: "ask",
    riskLevel: "high",
    reason: "Writing files requires user approval.",
  },
  {
    toolName: "edit",
    outcome: "ask",
    riskLevel: "high",
    reason: "Editing files requires user approval.",
  },
  {
    toolName: "apply_patch",
    outcome: "ask",
    riskLevel: "high",
    reason: "Applying patches requires user approval.",
  },
  {
    toolName: "diff_preview",
    outcome: "ask",
    riskLevel: "medium",
    reason: "Diff preview generation requires user awareness.",
  },
  {
    toolName: "revert_last_change",
    outcome: "ask",
    riskLevel: "high",
    reason: "Reverting file changes requires user approval.",
  },

  // ── Shell tool (Phase 10 — defined here so policy exists before the tool does) ──
  {
    toolName: "bash",
    outcome: "ask",
    riskLevel: "high",
    reason: "Shell execution requires user approval.",
  },
];

// ── Path-level rules ─────────────────────────────────────────────────────────

/**
 * Sensitive path patterns.
 *
 * Provisional — PERM-004: exact list is unresolved.
 * These patterns deny read/write access to sensitive files by default.
 * The engine applies the most restrictive path rule found across all targetPaths.
 *
 * Pattern semantics (see PathRule in types.ts):
 *   - Exact name match: ".env"
 *   - Extension glob: "*.pem"
 *   - Directory prefix: ".git/**"
 */
const PATH_RULES: PermissionPolicy["pathRules"] = [
  // ── Environment / secrets ────────────────────────────────────────────────
  // TODO(PERM-004): finalize path patterns after policy review
  {
    pattern: ".env",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to .env files is denied by default (sensitive secrets).",
  },
  {
    pattern: "*.env",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to .env files is denied by default (sensitive secrets).",
  },
  {
    pattern: ".env.*",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to .env.* files is denied by default (sensitive secrets).",
  },
  {
    pattern: "*.pem",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to PEM certificate/key files is denied by default.",
  },
  {
    pattern: "*.key",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to private key files is denied by default.",
  },
  {
    pattern: "*.p12",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to PKCS#12 certificate files is denied by default.",
  },

  // ── Version control internals ────────────────────────────────────────────
  {
    pattern: ".git/**",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Mutation of .git internals is denied by default.",
  },

  // ── SSH config ───────────────────────────────────────────────────────────
  {
    pattern: ".ssh/**",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Access to .ssh/ files is denied by default.",
  },

  // ── Build output / vendored deps (deny mutation, not reads) ─────────────
  // NOTE: reads of node_modules/dist/build/coverage are allowed (tool-level allow).
  // Path rules currently apply to all access uniformly. A per-operation path
  // rule type is Unresolved — for Phase 8 we only deny mutation by having these
  // be "ask" rather than "deny" since reads are generally safe.
  // TODO(PERM-004): revisit once mutation tools exist in Phase 9.
];

// ── Command-level rules ──────────────────────────────────────────────────────

/**
 * Destructive command patterns.
 *
 * Provisional — PERM-005: exact list is unresolved.
 * These are matched as case-insensitive substrings against the full command
 * string. See docs/05_PERMISSION_MODEL.md §10.
 *
 * Only evaluated when PermissionEvalInput.command is non-empty (Phase 10+).
 * Defined here so the engine handles them correctly once bash is available.
 */
const COMMAND_RULES: PermissionPolicy["commandRules"] = [
  // TODO(PERM-005): expand destructive command list after Phase 10 review
  {
    pattern: "rm -rf",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Recursive force deletion is denied by default.",
  },
  {
    pattern: "rm -fr",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Recursive force deletion is denied by default.",
  },
  {
    pattern: "sudo rm",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Privileged file deletion is denied by default.",
  },
  {
    pattern: "chmod -r",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Recursive permission change is denied by default.",
  },
  {
    pattern: "chown -r",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Recursive ownership change is denied by default.",
  },
  {
    pattern: "mkfs",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Filesystem creation is denied by default.",
  },
  {
    pattern: "dd ",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Raw disk access (dd) is denied by default.",
  },
  {
    pattern: "git reset --hard",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Hard git reset is denied by default.",
  },
  {
    pattern: "git clean -f",
    outcome: "deny",
    riskLevel: "critical",
    reason: "git clean -f is denied by default.",
  },
  {
    pattern: "git push --force",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Force git push is denied by default.",
  },
  {
    pattern: "git push -f",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Force git push is denied by default.",
  },
  {
    pattern: "truncate",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Truncating files is denied by default.",
  },
  {
    pattern: "shred",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Secure deletion (shred) is denied by default.",
  },
  {
    pattern: "curl | sh",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Pipe-to-shell execution is denied by default.",
  },
  {
    pattern: "curl|sh",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Pipe-to-shell execution is denied by default.",
  },
  {
    pattern: "wget | sh",
    outcome: "deny",
    riskLevel: "critical",
    reason: "Pipe-to-shell execution is denied by default.",
  },
];

// ── Agent-level rules ────────────────────────────────────────────────────────

/**
 * Agent-level policy overrides for Phase 11 agent modes.
 *
 * Build agent: explicit rules matching the normal posture.
 * Plan agent: restricted posture — mutation tools denied, read-only allowed, bash ask.
 *
 * Command hard-deny rules still apply first regardless of agent.
 * Path rules still apply for sensitive paths regardless of agent.
 */
const AGENT_RULES: PermissionPolicy["agentRules"] = [
  // ── Build agent (normal posture) ─────────────────────────────────────────
  {
    agentId: "build",
    toolName: "read",
    outcome: "allow",
    riskLevel: "low",
    reason: "Build agent: read-only file access is allowed.",
  },
  {
    agentId: "build",
    toolName: "grep",
    outcome: "allow",
    riskLevel: "low",
    reason: "Build agent: read-only file search is allowed.",
  },
  {
    agentId: "build",
    toolName: "glob",
    outcome: "allow",
    riskLevel: "low",
    reason: "Build agent: read-only path enumeration is allowed.",
  },
  {
    agentId: "build",
    toolName: "diff_preview",
    outcome: "allow",
    riskLevel: "low",
    reason: "Build agent: diff preview is safe read-only and allowed.",
  },
  {
    agentId: "build",
    toolName: "write",
    outcome: "ask",
    riskLevel: "high",
    reason: "Build agent: writing files requires user approval.",
  },
  {
    agentId: "build",
    toolName: "edit",
    outcome: "ask",
    riskLevel: "high",
    reason: "Build agent: editing files requires user approval.",
  },
  {
    agentId: "build",
    toolName: "apply_patch",
    outcome: "ask",
    riskLevel: "high",
    reason: "Build agent: applying patches requires user approval.",
  },
  {
    agentId: "build",
    toolName: "revert_last_change",
    outcome: "ask",
    riskLevel: "high",
    reason: "Build agent: reverting changes requires user approval.",
  },
  {
    agentId: "build",
    toolName: "bash",
    outcome: "ask",
    riskLevel: "high",
    reason: "Build agent: shell commands require user approval.",
  },
  // ── Plan agent (restricted posture) ─────────────────────────────────────
  {
    agentId: "plan",
    toolName: "read",
    outcome: "allow",
    riskLevel: "low",
    reason: "Plan agent: read-only file access is allowed.",
  },
  {
    agentId: "plan",
    toolName: "grep",
    outcome: "allow",
    riskLevel: "low",
    reason: "Plan agent: read-only file search is allowed.",
  },
  {
    agentId: "plan",
    toolName: "glob",
    outcome: "allow",
    riskLevel: "low",
    reason: "Plan agent: read-only path enumeration is allowed.",
  },
  {
    agentId: "plan",
    toolName: "diff_preview",
    outcome: "allow",
    riskLevel: "low",
    reason: "Plan agent: diff preview is safe read-only and allowed.",
  },
  {
    agentId: "plan",
    toolName: "bash",
    outcome: "ask",
    riskLevel: "high",
    reason: "Plan agent: shell commands require user approval.",
  },
  {
    agentId: "plan",
    toolName: "write",
    outcome: "deny",
    riskLevel: "high",
    reason: "Plan agent: file writing is denied (planning-first posture).",
  },
  {
    agentId: "plan",
    toolName: "edit",
    outcome: "deny",
    riskLevel: "high",
    reason: "Plan agent: file editing is denied (planning-first posture).",
  },
  {
    agentId: "plan",
    toolName: "apply_patch",
    outcome: "deny",
    riskLevel: "high",
    reason: "Plan agent: patch application is denied (planning-first posture).",
  },
  {
    agentId: "plan",
    toolName: "revert_last_change",
    outcome: "deny",
    riskLevel: "high",
    reason: "Plan agent: revert is denied (planning-first posture).",
  },
];

// ── Exported default policy ──────────────────────────────────────────────────

/**
 * The default permission policy for agent-workbench.
 *
 * Passed to PermissionEngine() constructor when no override is provided.
 */
export const defaultPolicy: PermissionPolicy = {
  toolRules: TOOL_RULES,
  pathRules: PATH_RULES,
  commandRules: COMMAND_RULES,
  agentRules: AGENT_RULES,
};
