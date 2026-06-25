/**
 * PermissionEngine — deterministic allow/ask/deny evaluator.
 *
 * Evaluation precedence (Provisional — PERM-002, docs/05_PERMISSION_MODEL.md §15):
 *   1. CommandRule: hard-deny patterns checked first when command is present.
 *   2. AgentRule: agent-level overrides when agentId matches (Phase 11+).
 *   3. PathRule: most restrictive outcome across all targetPaths.
 *   4. ToolRule: exact tool name match.
 *   5. Fallback: ask / high (unknown tools require user approval).
 *
 * The engine is stateless and deterministic — the same input always produces
 * the same output for a given policy. State for pending ask-gated requests is
 * held in PermissionGate, not here.
 *
 * The engine must never:
 *   - Execute tools.
 *   - Access storage.
 *   - Render UI.
 *   - Make HTTP requests.
 *   - Trust model-generated risk assessments.
 */

import type {
  PermissionEvalInput,
  PermissionEvalResult,
  PermissionOutcome,
  PermissionPolicy,
  PathRule,
} from "./types";
import { defaultPolicy } from "./policy";
import type { RiskLevel } from "@agent-workbench/protocol";

export class PermissionEngine {
  private readonly policy: PermissionPolicy;

  constructor(policy?: PermissionPolicy) {
    this.policy = policy ?? defaultPolicy;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Evaluate a tool call against the active policy.
   *
   * @param input  Contextual information about the requested operation.
   * @returns      A deterministic PermissionEvalResult.
   */
  evaluate(input: PermissionEvalInput): PermissionEvalResult {
    // Step 1: Command-level hard denies (highest priority).
    if (input.command !== undefined && input.command.trim().length > 0) {
      const commandResult = this.checkCommand(input.command);
      if (commandResult !== undefined) {
        return commandResult;
      }
    }

    // Step 2: Agent-level overrides (structural in Phase 8, no rules yet).
    if (input.agentId !== undefined) {
      const agentResult = this.checkAgent(input.agentId, input.toolName);
      if (agentResult !== undefined) {
        return agentResult;
      }
    }

    // Step 3: Path-level rules — apply most restrictive outcome.
    if (input.targetPaths !== undefined && input.targetPaths.length > 0) {
      const pathResult = this.checkPaths(input.targetPaths);
      if (pathResult !== undefined) {
        return pathResult;
      }
    }

    // Step 4: Tool-level rule (exact match).
    const toolResult = this.checkTool(input.toolName);
    if (toolResult !== undefined) {
      return toolResult;
    }

    // Step 5: Fallback — unknown tools require approval.
    return {
      outcome: "ask",
      riskLevel: "high",
      reason: `Unknown tool "${input.toolName}" requires user approval.`,
    };
  }

  /**
   * Return a copy of the active policy (used by the effective-policy route).
   * Returns a shallow copy to prevent external mutation.
   */
  getEffectivePolicy(): PermissionPolicy {
    return {
      toolRules: [...this.policy.toolRules],
      pathRules: [...this.policy.pathRules],
      commandRules: [...this.policy.commandRules],
      agentRules: [...this.policy.agentRules],
    };
  }

  // ── Private evaluation helpers ─────────────────────────────────────────────

  private checkCommand(command: string): PermissionEvalResult | undefined {
    const lower = command.toLowerCase();
    for (const rule of this.policy.commandRules) {
      if (lower.includes(rule.pattern.toLowerCase())) {
        return {
          outcome: rule.outcome,
          riskLevel: rule.riskLevel,
          reason: rule.reason,
        };
      }
    }
    return undefined;
  }

  private checkAgent(
    agentId: string,
    toolName: string
  ): PermissionEvalResult | undefined {
    for (const rule of this.policy.agentRules) {
      if (
        rule.agentId === agentId &&
        (rule.toolName === toolName || rule.toolName === "*")
      ) {
        return {
          outcome: rule.outcome,
          riskLevel: rule.riskLevel,
          reason: rule.reason,
        };
      }
    }
    return undefined;
  }

  /**
   * Evaluate all target paths and return the most restrictive outcome.
   *
   * Restrictiveness order: deny > ask > allow.
   */
  private checkPaths(targetPaths: string[]): PermissionEvalResult | undefined {
    let mostRestrictive: PermissionEvalResult | undefined;

    for (const path of targetPaths) {
      for (const rule of this.policy.pathRules) {
        if (this.matchesPathPattern(path, rule.pattern)) {
          const candidate: PermissionEvalResult = {
            outcome: rule.outcome,
            riskLevel: rule.riskLevel,
            reason: rule.reason,
          };
          if (
            mostRestrictive === undefined ||
            this.outcomeRestrictiveness(candidate.outcome) >
              this.outcomeRestrictiveness(mostRestrictive.outcome)
          ) {
            mostRestrictive = candidate;
          }
          break; // First matching rule per path wins; move to next path.
        }
      }
    }

    return mostRestrictive;
  }

  private checkTool(toolName: string): PermissionEvalResult | undefined {
    const rule = this.policy.toolRules.find((r) => r.toolName === toolName);
    if (rule === undefined) return undefined;
    return {
      outcome: rule.outcome,
      riskLevel: rule.riskLevel,
      reason: rule.reason,
    };
  }

  // ── Pattern matching ───────────────────────────────────────────────────────

  /**
   * Match a file path against a PathRule pattern.
   *
   * Supported pattern forms (see PathRule in types.ts):
   *   - Exact filename: ".env"          → matches "config/.env" (basename)
   *   - Extension glob: "*.pem"         → matches any file ending in .pem
   *   - Env variant: ".env.*"           → matches ".env.local", ".env.production"
   *   - Directory prefix: ".git/**"     → matches any path starting with ".git/"
   *
   * Matching is against the full path string AND the basename component.
   */
  private matchesPathPattern(filePath: string, pattern: string): boolean {
    // Normalise to forward slashes.
    const normalised = filePath.replace(/\\/g, "/");
    const basename = normalised.split("/").pop() ?? normalised;

    // Directory prefix pattern: "dir/**"
    if (pattern.endsWith("/**")) {
      const prefix = pattern.slice(0, -3); // remove "/**"
      return (
        normalised === prefix ||
        normalised.startsWith(prefix + "/") ||
        normalised.includes("/" + prefix + "/") ||
        normalised.startsWith(prefix + "/")
      );
    }

    // Extension glob: "*.ext"
    if (pattern.startsWith("*.")) {
      const ext = pattern.slice(1); // e.g. ".pem"
      return basename.endsWith(ext) || normalised.endsWith(ext);
    }

    // Env variant: ".env.*" (prefix + wildcard suffix)
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2); // e.g. ".env"
      return (
        basename.startsWith(prefix + ".") ||
        normalised.endsWith("/" + prefix + ".") ||
        basename === prefix
      );
    }

    // Exact basename match.
    return basename === pattern;
  }

  /**
   * Numeric restrictiveness for comparison.
   * Higher = more restrictive.
   */
  private outcomeRestrictiveness(outcome: PermissionOutcome): number {
    const order: Record<PermissionOutcome, number> = {
      allow: 0,
      ask: 1,
      deny: 2,
    };
    return order[outcome];
  }

  /**
   * Return the more restrictive of two risk levels.
   * Used internally if needed for future composite rules.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
    const order: Record<RiskLevel, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    return order[a] >= order[b] ? a : b;
  }
}
