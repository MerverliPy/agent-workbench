/**
 * Internal types for the packages/permissions policy engine.
 *
 * These types are consumed by PermissionEngine, PermissionGate, and the
 * default policy definition. They are exported from the package public surface
 * so that packages/core can build evaluation inputs and interpret results
 * without re-declaring these shapes.
 *
 * Protocol-level types (PermissionRequest, PermissionDecision, RiskLevel) live
 * in packages/protocol and are not duplicated here.
 */

import type { RiskLevel } from "@agent-workbench/protocol";

// ── Evaluation input ─────────────────────────────────────────────────────────

/**
 * All information the engine needs to evaluate a single tool-call permission.
 *
 * Most fields are optional — they are populated as they become available in
 * later phases (e.g. command is populated in Phase 10 for bash tools).
 */
export interface PermissionEvalInput {
  /** Registered tool name (e.g. "read", "write", "bash"). */
  toolName: string;
  /** Target file paths, if the tool operates on specific paths. */
  targetPaths?: string[];
  /** Shell command string, if the tool is command-based (Phase 10). */
  command?: string;
  /**
   * Agent profile identifier.
   * Populated in Phase 11 when agent modes are implemented.
   * Ignored when undefined.
   */
  agentId?: string;
}

// ── Evaluation result ────────────────────────────────────────────────────────

/** The three deterministic permission outcomes (ADR 0005). */
export type PermissionOutcome = "allow" | "ask" | "deny";

/** Result returned by PermissionEngine.evaluate(). */
export interface PermissionEvalResult {
  /** The engine's verdict. */
  outcome: PermissionOutcome;
  /** Human-readable reason for the outcome (used in permission request "reason" field). */
  reason: string;
  /** Risk classification for the evaluated operation. */
  riskLevel: RiskLevel;
}

// ── Policy rule types ────────────────────────────────────────────────────────

/**
 * A tool-level rule: maps a tool name to a default outcome and risk level.
 *
 * Default posture (docs/05_PERMISSION_MODEL.md §3):
 *   read/grep/glob  → allow / low
 *   write/edit/...  → ask   / high
 *   bash            → ask   / high
 *   destructive     → deny  / critical  (handled by CommandRule)
 */
export interface ToolRule {
  /** Exact tool name to match. */
  toolName: string;
  outcome: PermissionOutcome;
  riskLevel: RiskLevel;
  reason: string;
}

/**
 * A path-level rule: matches file paths against a glob-like pattern.
 *
 * Path-level rules are applied per targetPath for read and write access.
 * The engine checks all targetPaths and returns the most restrictive outcome.
 *
 * Exact path list is Provisional — PERM-004.
 */
export interface PathRule {
  /**
   * Simple pattern matched against file path.
   * Supports:
   *   - Exact segment match (e.g. ".env")
   *   - Prefix match with "/**" suffix (e.g. ".git/**")
   *   - Glob extension match with "*." prefix (e.g. "*.pem")
   */
  pattern: string;
  /** Outcome when a path matches this rule. */
  outcome: PermissionOutcome;
  riskLevel: RiskLevel;
  reason: string;
}

/**
 * A command-level rule: matches shell command strings against a pattern.
 *
 * Only evaluated when PermissionEvalInput.command is non-empty (Phase 10).
 * Provisional list — PERM-005.
 */
export interface CommandRule {
  /**
   * Substring or prefix pattern to match against the command string.
   * Matching is case-insensitive substring containment.
   */
  pattern: string;
  outcome: PermissionOutcome;
  riskLevel: RiskLevel;
  reason: string;
}

/**
 * An agent-level rule: overrides the default outcome for a specific
 * agent + tool combination.
 *
 * Agent rules are structural in Phase 8 — no agents are defined until Phase 11.
 * An empty array is valid and means "no agent overrides".
 */
export interface AgentRule {
  /** Agent profile identifier (e.g. "build", "plan"). */
  agentId: string;
  /** Tool name the rule applies to. Use "*" for all tools. */
  toolName: string;
  outcome: PermissionOutcome;
  riskLevel: RiskLevel;
  reason: string;
}

/**
 * The full policy passed to PermissionEngine.
 *
 * Evaluation precedence (docs/05_PERMISSION_MODEL.md §15 — Provisional PERM-002):
 *   1. CommandRule hard denies (if command present)
 *   2. AgentRule overrides (if agentId present and matching rule found)
 *   3. PathRule (most restrictive match across all targetPaths)
 *   4. ToolRule (exact tool name match)
 *   5. Default fallback: ask / high
 */
export interface PermissionPolicy {
  toolRules: ToolRule[];
  pathRules: PathRule[];
  commandRules: CommandRule[];
  /**
   * Agent-level overrides.
   * Empty in Phase 8 — populated in Phase 11 when agent modes are introduced.
   */
  agentRules: AgentRule[];
}
