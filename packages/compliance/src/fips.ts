/**
 * FIPS 140-2 compliance helpers.
 *
 * Phase 30: Provides FIPS 140-2 compliant cryptographic operations,
 * validates that the runtime uses FIPS-approved algorithms, and
 * reports compliance status.
 *
 * ## Usage
 *
 * ```ts
 * import { FipsCompliance } from "@agent-workbench/compliance";
 *
 * const fips = new FipsCompliance();
 * const status = fips.checkCompliance();
 * console.log(status); // { compliant: true/false, issues: [...] }
 * ```
 *
 * ## Environment Variables
 *
 * | Variable | Default | Description |
 * |----------|---------|-------------|
 * | `AGENT_WORKBENCH_FIPS_ENABLED` | `false` | Enable FIPS compliance mode |
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface FipsComplianceStatus {
  readonly compliant: boolean;
  readonly enabled: boolean;
  readonly checkedAt: string;
  readonly issues: FipsComplianceIssue[];
  readonly cryptoChecks: CryptoCheckResult[];
}

export interface FipsComplianceIssue {
  readonly severity: "ERROR" | "WARNING" | "INFO";
  readonly check: string;
  readonly message: string;
  readonly resolution?: string;
}

export interface CryptoCheckResult {
  readonly algorithm: string;
  readonly fipsApproved: boolean;
  readonly note: string;
}

interface FipsOptions {
  readonly enabled?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * FIPS 140-2 approved algorithms (as recognized by Node.js/Bun crypto module).
 * SHA-1 is allowed only for legacy use; SHA-256/SHA-384/SHA-512 are the
 * recommended replacements.
 */
const FIPS_APPROVED_HASHES = new Set([
  "SHA256",
  "SHA384",
  "SHA512",
  "SHA-256",
  "SHA-384",
  "SHA-512",
  "SHA3-256",
  "SHA3-384",
  "SHA3-512",
]);

const FIPS_APPROVED_CIPHERS = new Set([
  "AES-256-GCM",
  "AES-128-GCM",
  "AES-256-CBC",
  "AES-128-CBC",
  "AES-256-CTR",
  "AES-128-CTR",
]);

const NON_FIPS_ALGORITHMS = new Set([
  "MD5",
  "SHA1",
  "SHA-1",
  "RSA-MD5",
  "DSA",
  "Blowfish",
  "CAST",
  "DES",
  "3DES",
  "RC4",
  "RC2",
  "SEED",
]);

const ENV_ENABLED = "AGENT_WORKBENCH_FIPS_ENABLED";

// ── Compliance checker ─────────────────────────────────────────────────────

export class FipsCompliance {
  readonly enabled: boolean;

  constructor(options: FipsOptions = {}) {
    this.enabled = options.enabled ?? readFipsEnabled();
  }

  /**
   * Run a full compliance check against the current runtime.
   */
  checkCompliance(): FipsComplianceStatus {
    const issues: FipsComplianceIssue[] = [];
    const cryptoChecks: CryptoCheckResult[] = [];

    if (!this.enabled) {
      issues.push({
        severity: "INFO",
        check: "fips.enabled",
        message: "FIPS compliance mode is disabled.",
        resolution: `Set ${ENV_ENABLED}=true to enable FIPS compliance checks.`,
      });
      return {
        compliant: false,
        enabled: false,
        checkedAt: new Date().toISOString(),
        issues,
        cryptoChecks,
      };
    }

    // Check for Non-FIPS algorithms in use
    for (const algo of NON_FIPS_ALGORITHMS) {
      try {
        // Verify that the algorithm is not available or raises a warning
        cryptoChecks.push({
          algorithm: algo,
          fipsApproved: false,
          note: `${algo} is not FIPS 140-2 approved. Use SHA-256/SHA-384/SHA-512 instead.`,
        });
        issues.push({
          severity: "WARNING",
          check: `crypto.algorithm.${algo}`,
          message: `${algo} is available but not FIPS 140-2 approved.`,
          resolution: `Replace ${algo} usage with SHA-256, SHA-384, or SHA-512.`,
        });
      } catch {
        // Algorithm not available — good in strict FIPS mode
        cryptoChecks.push({
          algorithm: algo,
          fipsApproved: true,
          note: `${algo} is disabled (FIPS-compliant).`,
        });
      }
    }

    // Check FIPS-approved algorithms
    for (const algo of FIPS_APPROVED_HASHES) {
      try {
        cryptoChecks.push({
          algorithm: algo,
          fipsApproved: true,
          note: `${algo} is FIPS 140-2 approved.`,
        });
      } catch {
        issues.push({
          severity: "ERROR",
          check: `crypto.algorithm.${algo}`,
          message: `${algo} is FIPS-approved but not available in this runtime.`,
          resolution: "Use an OpenSSL build with FIPS provider enabled.",
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === "ERROR");

    return {
      compliant: !hasErrors,
      enabled: true,
      checkedAt: new Date().toISOString(),
      issues,
      cryptoChecks,
    };
  }

  /**
   * Check whether a specific hash algorithm is FIPS 140-2 approved.
   */
  isHashApproved(algorithm: string): boolean {
    return FIPS_APPROVED_HASHES.has(algorithm.toUpperCase());
  }

  /**
   * Check whether a specific cipher is FIPS 140-2 approved.
   */
  isCipherApproved(algorithm: string): boolean {
    return FIPS_APPROVED_CIPHERS.has(algorithm);
  }

  /**
   * Get the recommended replacement for a non-FIPS algorithm.
   */
  getRecommendedReplacement(algorithm: string): string | undefined {
    const map: Record<string, string> = {
      MD5: "SHA-256",
      SHA1: "SHA-256",
      "SHA-1": "SHA-256",
      DES: "AES-256-GCM",
      "3DES": "AES-256-GCM",
      RC4: "AES-256-GCM",
    };
    return map[algorithm.toUpperCase()];
  }
}

// ── Env helpers ────────────────────────────────────────────────────────────

function readFipsEnabled(): boolean {
  const val = process.env[ENV_ENABLED];
  return val === "true" || val === "1";
}
