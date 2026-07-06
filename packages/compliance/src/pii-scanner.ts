/**
 * PII (Personally Identifiable Information) detection and redaction.
 *
 * Scans text for common PII patterns and provides configurable
 * detection, masking, and redaction. Used by the compliance package
 * to scan tool inputs/outputs before they enter or leave the system.
 */

import { createHash } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export type PiiCategory =
  | "email"
  | "phone"
  | "ssn"
  | "credit-card"
  | "ip-address"
  | "api-key"
  | "url-credential"
  | "date-of-birth"
  | "custom";

export type RedactMode = "redact" | "mask" | "hash";

export interface PiiPattern {
  /** Unique identifier for this pattern. */
  readonly id: string;
  /** Human-readable label. */
  readonly label: string;
  /** PII category. */
  readonly category: PiiCategory;
  /** The regex pattern to scan for. */
  readonly regex: RegExp;
  /** Which redaction mode to use by default. */
  readonly defaultMode: RedactMode;
  /** Confidence level (0-1). Higher = fewer false positives. */
  readonly confidence: number;
}

export interface PiiMatch {
  /** Pattern that matched. */
  readonly patternId: string;
  /** Category of the matched PII. */
  readonly category: PiiCategory;
  /** The matched text. */
  readonly value: string;
  /** Zero-based index of the match in the input string. */
  readonly index: number;
  /** Confidence of this match. */
  readonly confidence: number;
}

export interface PiiScannerConfig {
  /** Patterns to enable (default: all built-in). */
  readonly enabledPatterns?: string[];
  /** Patterns to disable. */
  readonly disabledPatterns?: string[];
  /** Minimum confidence threshold (0-1). */
  readonly minConfidence?: number;
  /** Override redaction modes per pattern ID. */
  readonly modeOverrides?: Record<string, RedactMode>;
  /** Custom patterns to add. */
  readonly customPatterns?: PiiPattern[];
}

export interface PiiScanResult {
  /** All matches found. */
  readonly matches: PiiMatch[];
  /** Whether any match exceeded the confidence threshold. */
  readonly hasPii: boolean;
  /** Categories found (deduplicated). */
  readonly categories: PiiCategory[];
}

export interface PiiRedactResult {
  /** The input with PII replaced. */
  readonly text: string;
  /** Number of replacements made. */
  readonly replacements: number;
  /** Which categories were redacted. */
  readonly categories: PiiCategory[];
}

// ── Built-in patterns ──────────────────────────────────────────────────────

const BUILT_IN_PATTERNS: PiiPattern[] = [
  {
    id: "email",
    label: "Email address",
    category: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    defaultMode: "mask",
    confidence: 0.9,
  },
  {
    id: "phone-us",
    label: "US phone number",
    category: "phone",
    regex: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    defaultMode: "mask",
    confidence: 0.8,
  },
  {
    id: "ssn",
    label: "Social Security Number",
    category: "ssn",
    regex: /\b\d{3}[-]\d{2}[-]\d{4}\b/g,
    defaultMode: "redact",
    confidence: 0.95,
  },
  {
    id: "credit-card",
    label: "Credit card number",
    category: "credit-card",
    // Luhn-checkable patterns for major card types
    regex: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
    defaultMode: "mask",
    confidence: 0.85,
  },
  {
    id: "ip-v4",
    label: "IPv4 address",
    category: "ip-address",
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    defaultMode: "redact",
    confidence: 0.7,
  },
  {
    id: "ip-v6",
    label: "IPv6 address",
    category: "ip-address",
    regex: /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g,
    defaultMode: "redact",
    confidence: 0.8,
  },
  {
    id: "api-key-generic",
    label: "API key / secret token",
    category: "api-key",
    regex:
      /(?:api[_-]?key|secret|token|password|auth)[_-]?\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,64}['"]?/gi,
    defaultMode: "redact",
    confidence: 0.85,
  },
  {
    id: "bearer-token",
    label: "Bearer authorization token",
    category: "api-key",
    regex: /Bearer\s+[a-zA-Z0-9_-]{20,}/g,
    defaultMode: "redact",
    confidence: 0.95,
  },
  {
    id: "url-credentials",
    label: "URL with embedded credentials",
    category: "url-credential",
    regex: /https?:\/\/[^:/\s]+:[^@\s]+@/g,
    defaultMode: "redact",
    confidence: 0.9,
  },
  {
    id: "date-of-birth",
    label: "Date of birth",
    category: "date-of-birth",
    // Matches common date formats that could be DOB
    regex: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g,
    defaultMode: "mask",
    confidence: 0.5, // Lower confidence — could be any date
  },
];

// ── Redaction helpers ──────────────────────────────────────────────────────

function maskText(value: string): string {
  if (value.length <= 4) return "****";
  // Show first 2 and last 2 characters, mask the rest
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 20))}${value.slice(-2)}`;
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function redact(value: string, mode: RedactMode): string {
  switch (mode) {
    case "mask":
      return maskText(value);
    case "hash":
      return hashText(value);
    case "redact":
      return "[REDACTED]";
  }
}

// ── Scanner ─────────────────────────────────────────────────────────────────

export class PiiScanner {
  private readonly patterns: PiiPattern[];
  private readonly minConfidence: number;
  private readonly modeOverrides: Record<string, RedactMode>;

  constructor(config: PiiScannerConfig = {}) {
    const enabled = new Set(config.enabledPatterns);
    const disabled = new Set(config.disabledPatterns ?? []);

    // Collect all patterns
    const allPatterns = [
      ...BUILT_IN_PATTERNS,
      ...(config.customPatterns ?? []),
    ];

    // Filter enabled/disabled
    if (enabled.size > 0) {
      this.patterns = allPatterns.filter((p) => enabled.has(p.id));
    } else {
      this.patterns = allPatterns.filter((p) => !disabled.has(p.id));
    }

    this.minConfidence = config.minConfidence ?? 0.5;
    this.modeOverrides = config.modeOverrides ?? {};
  }

  /**
   * Scan text for PII. Returns all matches found.
   */
  scan(input: string): PiiScanResult {
    const matches: PiiMatch[] = [];

    for (const pattern of this.patterns) {
      // Reset lastIndex for global regex
      pattern.regex.lastIndex = 0;

      let m = pattern.regex.exec(input);
      while (m !== null) {
        matches.push({
          patternId: pattern.id,
          category: pattern.category,
          value: m[0],
          index: m.index,
          confidence: pattern.confidence,
        });
        m = pattern.regex.exec(input);
      }
    }

    // Sort by position in text
    matches.sort((a, b) => a.index - b.index);

    const aboveThreshold = matches.filter(
      (m) => m.confidence >= this.minConfidence,
    );
    const categories = [...new Set(aboveThreshold.map((m) => m.category))];

    return {
      matches,
      hasPii: aboveThreshold.length > 0,
      categories,
    };
  }

  /**
   * Scan and redact PII from text.
   * Applies redactions from right-to-left to preserve positions.
   */
  redact(input: string, modeOverride?: RedactMode): PiiRedactResult {
    const scanResult = this.scan(input);

    if (!scanResult.hasPii) {
      return { text: input, replacements: 0, categories: [] };
    }

    // Only redact matches above confidence threshold
    const applicable = scanResult.matches.filter(
      (m) => m.confidence >= this.minConfidence,
    );

    // Build replacement list with right-to-left ordering
    const replacements: Array<{
      index: number;
      length: number;
      replacement: string;
    }> = [];

    for (const match of applicable) {
      const pattern = this.patterns.find((p) => p.id === match.patternId);
      if (!pattern) continue;

      const mode =
        modeOverride ??
        this.modeOverrides[match.patternId] ??
        pattern.defaultMode;
      const replacement = redact(match.value, mode);

      replacements.push({
        index: match.index,
        length: match.value.length,
        replacement,
      });
    }

    // Sort descending by index (right-to-left) to preserve positions
    replacements.sort((a, b) => b.index - a.index);

    let result = input;
    for (const r of replacements) {
      result =
        result.slice(0, r.index) +
        r.replacement +
        result.slice(r.index + r.length);
    }

    const categories = [...new Set(applicable.map((m) => m.category))];

    return {
      text: result,
      replacements: replacements.length,
      categories,
    };
  }

  /** Get the list of active patterns. */
  getPatterns(): readonly PiiPattern[] {
    return this.patterns;
  }
}

/** Pre-built scanner with all default patterns and standard confidence threshold. */
export const defaultPiiScanner = new PiiScanner();
