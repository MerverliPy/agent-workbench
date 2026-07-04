/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { PIIScanner } from "../pii-scanner";

describe("PIIScanner", () => {
  describe("scan", () => {
    it("detects SSN", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("My SSN is 123-45-6789");
      expect(result.matches.length).toBe(1);
      expect(result.matches[0]!.type).toBe("ssn");
      expect(result.matches[0]!.severity).toBe("HIGH");
      expect(result.matches[0]!.value).toBe("123-45-6789");
      expect(result.hasHigh).toBe(true);
    });

    it("detects SSN without dashes", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("SSN: 123456789");
      expect(result.matches.some((m) => m.type === "ssn")).toBe(true);
    });

    it("detects email addresses", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Contact: user@example.com");
      expect(result.matches.length).toBe(1);
      expect(result.matches[0]!.type).toBe("email");
      expect(result.matches[0]!.severity).toBe("MEDIUM");
      expect(result.matches[0]!.value).toBe("user@example.com");
      expect(result.hasMedium).toBe(true);
    });

    it("detects multiple emails", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("a@b.com and c@d.org");
      expect(result.matches.filter((m) => m.type === "email").length).toBe(2);
    });

    it("detects US phone numbers", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Call: (555) 123-4567");
      expect(result.matches.some((m) => m.type === "phone")).toBe(true);
    });

    it("detects phone with dashes", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Call: 555-123-4567");
      expect(result.matches.some((m) => m.type === "phone")).toBe(true);
    });

    it("detects phone with international prefix", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Call: +1-555-123-4567");
      expect(result.matches.some((m) => m.type === "phone")).toBe(true);
    });

    it("detects credit card numbers", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Card: 4111-1111-1111-1111");
      expect(result.matches.some((m) => m.type === "credit_card")).toBe(true);
      expect(result.hasHigh).toBe(true);
    });

    it("detects OpenAI API keys", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("key=sk-proj-abcdefghijklmnopqrstuvwxyz123456");
      expect(result.matches.some((m) => m.type === "api_key")).toBe(true);
      expect(result.hasCritical).toBe(true);
    });

    it("detects GitHub tokens", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("token=ghp_abcdefghijklmnopqrstuvwxyz1234567890");
      expect(result.matches.some((m) => m.type === "api_key")).toBe(true);
    });

    it("detects long random-looking strings as api key", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("key=abcdefghijklmnopqrstuvwxyz1234567890");
      expect(result.matches.some((m) => m.type === "api_key")).toBe(true);
    });

    it("detects Bearer tokens", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.test");
      expect(result.matches.some((m) => m.type === "auth_token")).toBe(true);
    });

    it("detects IP addresses", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("Server: 192.168.1.1");
      expect(result.matches.some((m) => m.type === "ip_address")).toBe(true);
    });

    it("detects crypto wallet addresses", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("ETH: 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
      expect(result.matches.some((m) => m.type === "crypto_wallet")).toBe(true);
      expect(result.hasHigh).toBe(true);
    });

    it("returns empty result for clean text", () => {
      const scanner = new PIIScanner();
      const result = scanner.scan("This is just normal text without any PII.");
      expect(result.matches.length).toBe(0);
      expect(result.hasCritical).toBe(false);
      expect(result.hasHigh).toBe(false);
      expect(result.hasMedium).toBe(false);
    });

    it("enables only specified patterns", () => {
      const scanner = new PIIScanner({ enabledPatterns: ["email"] });
      const result = scanner.scan("Email: user@test.com, SSN: 123-45-6789, key: sk-abc123");
      expect(result.matches.length).toBe(1);
      expect(result.matches[0]!.type).toBe("email");
    });
  });

  describe("redact", () => {
    it("replaces PII with [REDACTED: TYPE]", () => {
      const scanner = new PIIScanner();
      const result = scanner.redact("Email: alice@example.com");
      expect(result).toBe("Email: [REDACTED: EMAIL ADDRESS]");
    });

    it("handles multiple PII in one string", () => {
      const scanner = new PIIScanner();
      const result = scanner.redact(
        "User: alice@example.com, SSN: 123-45-6789",
      );
      expect(result).toContain("[REDACTED: EMAIL ADDRESS]");
      expect(result).toContain("[REDACTED: SOCIAL SECURITY NUMBER]");
    });

    it("preserves non-PII text", () => {
      const scanner = new PIIScanner();
      const result = scanner.redact("Hello world");
      expect(result).toBe("Hello world");
    });

    it("handles empty string", () => {
      const scanner = new PIIScanner();
      expect(scanner.redact("")).toBe("");
    });

    it("redacts credit cards", () => {
      const scanner = new PIIScanner();
      const result = scanner.redact("Card: 4111-1111-1111-1111");
      expect(result).toContain("[REDACTED: CREDIT CARD NUMBER]");
    });

    it("redacts API keys", () => {
      const scanner = new PIIScanner();
      const result = scanner.redact("key=sk-abcdefghijklmnopqrstuvwxyz123456");
      expect(result).toContain("[REDACTED: API KEY]");
    });
  });

  describe("hasSecrets", () => {
    it("returns true when text contains API keys", () => {
      const scanner = new PIIScanner();
      expect(scanner.hasSecrets("key=sk-abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
    });

    it("returns false for benign text", () => {
      const scanner = new PIIScanner();
      expect(scanner.hasSecrets("Hello world")).toBe(false);
    });

    it("returns false for email (MEDIUM, not CRITICAL)", () => {
      const scanner = new PIIScanner();
      expect(scanner.hasSecrets("email: user@test.com")).toBe(false);
    });
  });
});
