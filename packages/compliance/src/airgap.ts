/**
 * Air-gapped mode enforcement — prevents outbound network calls.
 *
 * Phase 30: When enabled, all outbound HTTP/HTTPS requests are blocked,
 * and only bundled/local models are available for inference.
 *
 * ## Usage
 *
 * ```ts
 * import { AirgapEnforcer } from "@agent-workbench/compliance";
 *
 * const enforcer = new AirgapEnforcer({
 *   allowedInternalPorts: [4096, 8080],
 * });
 *
 * // Check if a URL is allowed
 * if (!enforcer.isAllowed("https://api.openai.com/v1")) {
 *   throw new Error("Network access is blocked in air-gapped mode");
 * }
 * ```
 *
 * ## Environment Variables
 *
 * | Variable | Default | Description |
 * |----------|---------|-------------|
 * | `AGENT_WORKBENCH_AIRGAP_ENABLED` | `false` | Enable air-gapped mode |
 * | `AGENT_WORKBENCH_AIRGAP_ALLOWED_PORTS` | `4096,8080,3449` | Comma-separated allowed local ports |
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface AirgapOptions {
  /** Whether air-gapped mode is enabled (default: false). */
  readonly enabled?: boolean;
  /** Local port numbers allowed for inter-process communication. */
  readonly allowedInternalPorts?: readonly number[];
}

export interface AirgapCheckResult {
  readonly blocked: boolean;
  readonly reason: string | undefined;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_ALLOWED_PORTS = [4096, 8080, 3449];

const ENV_ENABLED = "AGENT_WORKBENCH_AIRGAP_ENABLED";
const ENV_ALLOWED_PORTS = "AGENT_WORKBENCH_AIRGAP_ALLOWED_PORTS";

// ── Local-only patterns ───────────────────────────────────────────────────

function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host.startsWith("127.") ||
      host.endsWith(".local") ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

// ── Enforcer ──────────────────────────────────────────────────────────────

export class AirgapEnforcer {
  readonly enabled: boolean;
  private readonly allowedPorts: readonly number[];

  constructor(options: AirgapOptions = {}) {
    this.enabled = options.enabled ?? readEnvEnabled();
    this.allowedPorts = readAllowedPorts(options.allowedInternalPorts);
  }

  /**
   * Check if a URL is allowed in the current mode.
   * In non-airgapped mode, all URLs pass.
   * In airgapped mode, only localhost URLs on allowed ports pass.
   */
  isAllowed(url: string): AirgapCheckResult {
    if (!this.enabled) {
      return { blocked: false, reason: undefined };
    }

    if (!isLocalUrl(url)) {
      return {
        blocked: true,
        reason: `Blocked by air-gapped mode: external URLs are not allowed. Use a local model or disable air-gapped mode (${ENV_ENABLED}=false).`,
      };
    }

    // Check port if present
    try {
      const parsed = new URL(url);
      if (parsed.port) {
        const port = parseInt(parsed.port, 10);
        if (!this.allowedPorts.includes(port)) {
          return {
            blocked: true,
            reason: `Blocked by air-gapped mode: port ${port} is not in the allowed list (${this.allowedPorts.join(", ")}).`,
          };
        }
      }
    } catch {
      // If URL is unparseable, let it through (will fail naturally)
    }

    return { blocked: false, reason: undefined };
  }

  /**
   * Get a list of bundled/local models available in air-gapped mode.
   */
  getAvailableModels(): string[] {
    if (!this.enabled) return [];
    return [
      "local:ollama",
      "local:llama.cpp",
    ];
  }
}

// ── Env helpers ────────────────────────────────────────────────────────────

function readEnvEnabled(): boolean {
  const val = process.env[ENV_ENABLED];
  return val === "true" || val === "1";
}

function readAllowedPorts(
  overrides: readonly number[] | undefined,
): readonly number[] {
  if (overrides && overrides.length > 0) return overrides;

  const envVal = process.env[ENV_ALLOWED_PORTS];
  if (envVal) {
    return envVal
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0 && n < 65536);
  }

  return DEFAULT_ALLOWED_PORTS;
}
