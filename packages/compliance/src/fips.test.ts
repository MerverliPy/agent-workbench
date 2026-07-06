import { describe, expect, it } from "bun:test";
import {
  fipsApprovedCiphers,
  fipsApprovedHashes,
  fipsReadinessSummary,
  isFipsApproved,
  isFipsCapable,
  runSelfTests,
  secureRandomBytes,
  secureRandomHex,
  secureRandomString,
  verifyFipsReadiness,
} from "./fips";

describe("FIPS compliance helpers", () => {
  describe("Algorithm approval", () => {
    it("approves SHA-256", () => {
      expect(isFipsApproved("SHA-256")).toBe(true);
      expect(isFipsApproved("sha256")).toBe(true);
    });

    it("approves SHA-384 and SHA-512", () => {
      expect(isFipsApproved("SHA-384")).toBe(true);
      expect(isFipsApproved("SHA-512")).toBe(true);
    });

    it("approves AES-256-GCM", () => {
      expect(isFipsApproved("AES-256-GCM")).toBe(true);
    });

    it("rejects non-FIPS algorithms like MD5", () => {
      expect(isFipsApproved("MD5")).toBe(false);
      expect(isFipsApproved("sha1")).toBe(false);
    });

    it("lists approved hashes", () => {
      const hashes = fipsApprovedHashes();
      expect(hashes).toContain("sha256");
      expect(hashes).toContain("sha384");
    });

    it("lists approved ciphers", () => {
      const ciphers = fipsApprovedCiphers();
      expect(ciphers).toContain("aes-256-gcm");
    });
  });

  describe("Self-tests (KAT)", () => {
    it("passes known answer tests for SHA-256", () => {
      const result = runSelfTests();
      expect(result.compliant).toBe(true);
    });
  });

  describe("CSPRNG", () => {
    it("generates random bytes of the correct length", () => {
      const bytes = secureRandomBytes(32);
      expect(bytes).toHaveLength(32);
    });

    it("generates non-deterministic bytes", () => {
      const a = secureRandomBytes(16);
      const b = secureRandomBytes(16);
      expect(a).not.toEqual(b);
    });

    it("generates hex strings of correct length", () => {
      const hex = secureRandomHex(16);
      expect(hex).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(hex).toMatch(/^[a-f0-9]+$/);
    });

    it("generates random strings with correct charset", () => {
      const str = secureRandomString(20);
      expect(str).toHaveLength(20);
      expect(str).toMatch(/^[0-9a-zA-Z]+$/);
    });
  });

  describe("Environment checks", () => {
    it("isFipsCapable returns true in a standard environment", () => {
      expect(isFipsCapable()).toBe(true);
    });

    it("verifyFipsReadiness returns 4 results", () => {
      const results = verifyFipsReadiness();
      expect(results).toHaveLength(4);
    });

    it("all readiness checks pass in standard environment", () => {
      const results = verifyFipsReadiness();
      const allPass = results.every((r) => r.compliant);
      expect(allPass).toBe(true);
    });

    it("fipsReadinessSummary returns PASS/4", () => {
      const summary = fipsReadinessSummary();
      expect(summary).toContain("PASS");
      expect(summary).toContain("/4");
    });
  });
});
