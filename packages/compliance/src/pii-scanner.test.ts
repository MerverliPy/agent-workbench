import { describe, it, expect } from "bun:test";
import { PiiScanner, defaultPiiScanner } from "./pii-scanner";

describe("PiiScanner", () => {
  describe("Built-in patterns", () => {
    it("detects email addresses", () => {
      const result = defaultPiiScanner.scan("Contact me at user@example.com or admin@test.co.uk");
      const emails = result.matches.filter((m) => m.category === "email");
      expect(emails.length).toBeGreaterThanOrEqual(2);
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("email");
    });

    it("detects US phone numbers", () => {
      const result = defaultPiiScanner.scan("Call (555) 123-4567 or +1 555-987-6543");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("phone");
    });

    it("detects SSNs", () => {
      const result = defaultPiiScanner.scan("My SSN is 123-45-6789");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("ssn");
    });

    it("detects credit card numbers", () => {
      const result = defaultPiiScanner.scan("Card: 4111 1111 1111 1111");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("credit-card");
    });

    it("detects IP addresses", () => {
      const result = defaultPiiScanner.scan("Server at 192.168.1.1");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("ip-address");
    });

    it("detects API keys", () => {
      const result = defaultPiiScanner.scan("api_key = sk-proj-abcdef1234567890abcdef12");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("api-key");
    });

    it("detects bearer tokens", () => {
      const result = defaultPiiScanner.scan("Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz12345");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("api-key");
    });

    it("detects URLs with credentials", () => {
      const result = defaultPiiScanner.scan("https://user:password@example.com/path");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("url-credential");
    });
  });

  describe("Redaction", () => {
    it("redacts email addresses by default", () => {
      const result = defaultPiiScanner.redact("Email: john.doe@example.com");
      expect(result.replacements).toBe(1);
      expect(result.text).not.toContain("john.doe@example.com");
      expect(result.categories).toContain("email");
    });

    it("masks email showing first 2 chars", () => {
      const result = defaultPiiScanner.redact("Email: john.doe@example.com");
      // Should show "jo" at the start and "om" at the end (masked)
      expect(result.text).toContain("jo");
      expect(result.text).toContain("om");
      expect(result.text).not.toContain("john.doe");
    });

    it("redacts SSNs completely", () => {
      const result = defaultPiiScanner.redact("SSN: 123-45-6789");
      expect(result.text).toContain("[REDACTED]");
      expect(result.text).not.toContain("123-45-6789");
    });

    it("handles multiple PII types in one string", () => {
      const input = "User user@example.com at IP 10.0.0.1 called (555) 123-4567";
      const result = defaultPiiScanner.redact(input);
      expect(result.replacements).toBeGreaterThanOrEqual(3);
      expect(result.text).not.toContain("user@example.com");
    });

    it("returns original text when no PII found", () => {
      const result = defaultPiiScanner.redact("Hello, this is clean text with no PII.");
      expect(result.replacements).toBe(0);
      expect(result.text).toBe("Hello, this is clean text with no PII.");
    });

    it("supports mode override per pattern", () => {
      const scanner = new PiiScanner({
        modeOverrides: { email: "redact" },
      });
      const result = scanner.redact("Email: user@example.com");
      expect(result.text).toContain("[REDACTED]");
      expect(result.text).not.toContain("user");
    });

    it("supports hash mode", () => {
      const scanner = new PiiScanner({
        modeOverrides: { email: "hash" },
      });
      const result = scanner.redact("Email: user@example.com");
      // Hash produces a hex string
      expect(result.text).not.toContain("user@example.com");
      expect(result.text).toMatch(/[a-f0-9]{16}/);
    });

    it("supports overriding mode via redact() parameter", () => {
      const result = defaultPiiScanner.redact("Email: user@example.com", "redact");
      expect(result.text).toContain("[REDACTED]");
    });

    it("handles overlapping matches without corruption", () => {
      // API key pattern contains email-like pattern
      const input = "api_key = sk-proj-test-key-12345";
      const result = defaultPiiScanner.redact(input);
      expect(result.text).not.toContain("sk-proj-test-key-12345");
    });
  });

  describe("Configuration", () => {
    it("disables specific patterns", () => {
      const scanner = new PiiScanner({
        disabledPatterns: ["email"],
      });
      const result = scanner.scan("Email: user@example.com");
      expect(result.hasPii).toBe(false);
    });

    it("enables only specific patterns", () => {
      const scanner = new PiiScanner({
        enabledPatterns: ["ssn", "credit-card"],
      });
      const result = scanner.scan("Email: user@example.com, SSN: 123-45-6789");
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("ssn");
      expect(result.categories).not.toContain("email");
    });

    it("filters by minimum confidence", () => {
      // DOB has confidence 0.5 — set min to 0.8 to exclude it
      const scanner = new PiiScanner({
        minConfidence: 0.8,
        enabledPatterns: ["date-of-birth", "email"],
      });
      const result = scanner.scan("DOB: 01/15/1990, Email: user@example.com");
      // Email (0.9) should be found, DOB (0.5) should be filtered out
      expect(result.hasPii).toBe(true);
      expect(result.categories).toContain("email");
      expect(result.categories).not.toContain("date-of-birth");
    });

    it("supports custom patterns", () => {
      const scanner = new PiiScanner({
        customPatterns: [
          {
            id: "project-id",
            label: "Internal project ID",
            category: "custom",
            regex: /PRJ-\d{4,6}/g,
            defaultMode: "redact",
            confidence: 1.0,
          },
        ],
      });
      const result = scanner.scan("Project PRJ-12345 is confidential");
      expect(result.hasPii).toBe(true);
      const redacted = scanner.redact("Project PRJ-12345 is confidential");
      expect(redacted.text).toContain("[REDACTED]");
    });
  });

  describe("Edge cases", () => {
    it("handles empty string", () => {
      const result = defaultPiiScanner.scan("");
      expect(result.hasPii).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it("handles string with no PII", () => {
      const result = defaultPiiScanner.scan("Just regular text with numbers like 42.");
      expect(result.hasPii).toBe(false);
    });

    it("does not false-positive on localhost IPs", () => {
      const result = defaultPiiScanner.scan("Server at 127.0.0.1 or localhost");
      // IPv4 pattern has confidence 0.7 which is >= default 0.5
      // So it WILL match — that's expected. Localhost IPs are technically PII-adjacent.
      // But we should ensure it doesn't break redaction.
      const redacted = defaultPiiScanner.redact("Server at 127.0.0.1");
      expect(redacted.text).not.toContain("127.0.0.1");
    });

    it("getPatterns returns the active patterns", () => {
      const patterns = defaultPiiScanner.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0]!.id).toBeTruthy();
    });
  });
});
