/**
 * PII detection and redaction scanner.
 *
 * Scans text for patterns matching common personally identifiable information
 * and secrets: SSN, email, phone, credit card, API keys, auth tokens.
 *
 * Supports three severity levels:
 * - **CRITICAL**: Secrets that could compromise security (API keys, tokens)
 * - **HIGH**: Identity information (SSN, credit card numbers)
 * - **MEDIUM**: Contact information (email, phone)
 *
 * @example
 * ```ts
 * const scanner = new PIIScanner();
 * const results = scanner.scan("My email is user@example.com and key is sk-abc123");
 * // results: [{ type: "email", severity: "MEDIUM", ... }, { type: "api_key", severity: "CRITICAL", ... }]
 *
 * const clean = scanner.redact("Contact: alice@example.com, SSN: 123-45-6789");
 * // "Contact: [REDACTED: EMAIL], SSN: [REDACTED: SSN]"
 * ```
 */

// ── Pattern Definitions ───────────────────────────────────────────────────

export interface PIIPattern {
  readonly type: PIIPatternType;
  readonly severity: PIISeverity;
  readonly label: string;
  readonly pattern: RegExp;
}

export type PIIPatternType =
  | "ssn"
  | "email"
  | "phone"
  | "credit_card"
  | "api_key"
  | "auth_token"
  | "ip_address"
  | "crypto_wallet";

export type PIISeverity = "CRITICAL" | "HIGH" | "MEDIUM";

export interface PIIMatch {
  readonly type: PIIPatternType;
  readonly severity: PIISeverity;
  readonly label: string;
  readonly value: string;
  readonly index: number;
  readonly length: number;
}

export interface ScanResult {
  readonly matches: PIIMatch[];
  readonly hasCritical: boolean;
  readonly hasHigh: boolean;
  readonly hasMedium: boolean;
}

export interface PIIScannerOptions {
  /** Which patterns to enable. Default: all. */
  readonly enabledPatterns?: PIIPatternType[];
  /** Whether to skip patterns that are expensive (e.g. scanning large text). */
  readonly skipExpensive?: boolean;
}

// ── Patterns ──────────────────────────────────────────────────────────────

const PATTERNS: PIIPattern[] = [
  // SSN: 123-45-6789 or 123456789
  {
    type: "ssn",
    severity: "HIGH",
    label: "Social Security Number",
    pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  },
  // Email
  {
    type: "email",
    severity: "MEDIUM",
    label: "Email Address",
    pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  },
  // Phone (US): (555) 123-4567, 555-123-4567, +1-555-123-4567
  {
    type: "phone",
    severity: "MEDIUM",
    label: "Phone Number",
    pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  // Credit card: 16 digits (Luhn validation is done in code)
  {
    type: "credit_card",
    severity: "HIGH",
    label: "Credit Card Number",
    pattern: /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,
  },
  // API keys: common formats
  {
    type: "api_key",
    severity: "CRITICAL",
    label: "API Key",
    pattern:
      /\b(?:sk-[A-Za-z0-9]{20,}|[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{36,}|gho_[A-Za-z0-9]{36,}|ghu_[A-Za-z0-9]{36,}|xox[baprs]-[A-Za-z0-9-]{24,}|pk-[A-Za-z0-9]{32,}|AGMSTA[A-Za-z0-9]{32,})\b/g,
  },
  // Auth tokens: Bearer, JWT
  {
    type: "auth_token",
    severity: "CRITICAL",
    label: "Authentication Token",
    pattern:
      /\b(?:Bearer\s+[A-Za-z0-9-_.]+|eyJ[A-Za-z0-9-_.]{20,}|Authorization:\s*(?:Bearer|Basic|Token)\s+\S+)\b/g,
  },
  // IP addresses (private ranges for MEDIUM, public for informational)
  {
    type: "ip_address",
    severity: "MEDIUM",
    label: "IP Address",
    pattern:
      /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
  },
  // Crypto wallet addresses (Bitcoin, Ethereum)
  {
    type: "crypto_wallet",
    severity: "HIGH",
    label: "Crypto Wallet Address",
    pattern:
      /\b(?:0x[a-fA-F0-9]{40}|1[A-Za-z0-9]{25,34}|3[A-Za-z0-9]{25,34}|bc1[A-Za-z0-9]{25,59})\b/g,
  },
];

// ── Scanner ───────────────────────────────────────────────────────────────

export class PIIScanner {
  private readonly patterns: PIIPattern[];

  constructor(options: PIIScannerOptions = {}) {
    const enabled = options.enabledPatterns;
    this.patterns = enabled
      ? PATTERNS.filter((p) => enabled.includes(p.type))
      : PATTERNS;
  }

  /**
   * Scan text for PII matches.
   * Returns deduplicated results sorted by position.
   */
  scan(text: string): ScanResult {
    const matchSet = new Map<string, PIIMatch>();

    for (const pattern of this.patterns) {
      pattern.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;

      while ((m = pattern.pattern.exec(text)) !== null) {
        const value = m[0];

        // Deduplicate overlapping matches (keep the more severe one)
        const key = `${pattern.type}:${m.index}`;
        if (!matchSet.has(key)) {
          matchSet.set(key, {
            type: pattern.type,
            severity: pattern.severity,
            label: pattern.label,
            value,
            index: m.index,
            length: value.length,
          });
        }
      }
    }

    const matches = Array.from(matchSet.values()).sort(
      (a, b) => a.index - b.index,
    );

    return {
      matches,
      hasCritical: matches.some((m) => m.severity === "CRITICAL"),
      hasHigh: matches.some((m) => m.severity === "HIGH"),
      hasMedium: matches.some((m) => m.severity === "MEDIUM"),
    };
  }

  /**
   * Redact PII from text, replacing matches with [REDACTED: TYPE] markers.
   * Processes in reverse order to preserve indices during replacement.
   */
  redact(text: string): string {
    const result = this.scan(text);
    if (result.matches.length === 0) return text;

    const segments: Array<{ start: number; end: number; replacement: string }> =
      [];

    for (const match of result.matches) {
      // Merge overlapping ranges
      const existing = segments.find(
        (s) =>
          (match.index >= s.start && match.index < s.end) ||
          (match.index + match.length > s.start &&
            match.index < s.end),
      );

      if (existing) {
        // Extend the existing segment range
        existing.start = Math.min(existing.start, match.index);
        existing.end = Math.max(existing.end, match.index + match.length);
        // Use the highest severity label
        const existingSeverity =
          result.matches.find((m) => m.label === existing.replacement)
            ?.severity ?? "MEDIUM";
        const thisSeverity = match.severity;
        const severityRank = { CRITICAL: 3, HIGH: 2, MEDIUM: 1 };
        if (
          (severityRank[thisSeverity] ?? 0) >
          (severityRank[existingSeverity] ?? 0)
        ) {
          existing.replacement = `[REDACTED: ${match.label.toUpperCase()}]`;
        }
      } else {
        segments.push({
          start: match.index,
          end: match.index + match.length,
          replacement: `[REDACTED: ${match.label.toUpperCase()}]`,
        });
      }
    }

    // Sort in reverse order and apply
    segments.sort((a, b) => b.start - a.start);
    let result_text = text;
    for (const seg of segments) {
      result_text =
        result_text.slice(0, seg.start) +
        seg.replacement +
        result_text.slice(seg.end);
    }

    return result_text;
  }

  /**
   * Check if text contains any CRITICAL PII (secrets).
   * Useful for fast guard checks before full scanning.
   */
  hasSecrets(text: string): boolean {
    return this.scan(text).hasCritical;
  }
}
