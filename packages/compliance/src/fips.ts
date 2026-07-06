/**
 * FIPS 140-2 compliance helpers.
 *
 * Provides utilities for ensuring cryptographic operations use
 * FIPS-approved algorithms and patterns. This module does NOT
 * implement its own crypto — it wraps Node.js/Bun built-in crypto
 * and verifies algorithm compliance.
 */

import { createHash, getCiphers, getHashes, randomBytes } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export type FipsAlgorithm =
  | "SHA-256"
  | "SHA-384"
  | "SHA-512"
  | "SHA-512/256"
  | "AES-128"
  | "AES-256"
  | "HMAC-SHA-256"
  | "HMAC-SHA-384"
  | "HMAC-SHA-512"
  | "RSA-2048"
  | "RSA-3072"
  | "RSA-4096"
  | "ECDSA-P256"
  | "ECDSA-P384";

export type FipsCheckResult =
  | { compliant: true }
  | { compliant: false; reason: string };

// ── FIPS-approved hash algorithms ──────────────────────────────────────────

const FIPS_HASHES = new Set(["sha256", "sha384", "sha512", "sha512-256"]);

const FIPS_CIPHERS = new Set([
  "aes-128-cbc",
  "aes-128-gcm",
  "aes-256-cbc",
  "aes-256-gcm",
]);

/** List of all FIPS-approved hash algorithm names (lowercase). */
export function fipsApprovedHashes(): string[] {
  return [...FIPS_HASHES];
}

/** List of all FIPS-approved cipher algorithm names (lowercase). */
export function fipsApprovedCiphers(): string[] {
  return [...FIPS_CIPHERS];
}

/**
 * Check if an algorithm is FIPS-approved.
 * Accepts both "SHA-256" and "sha256" formats.
 */
export function isFipsApproved(algorithm: string): boolean {
  const normalized = algorithm.toLowerCase().replace(/[-_]/g, "");
  const check = (set: Set<string>): boolean => {
    for (const item of set) {
      if (item.replace(/[-_/]/g, "") === normalized) return true;
    }
    return false;
  };
  return check(FIPS_HASHES) || check(FIPS_CIPHERS);
}

// ── Self-tests (Known Answer Tests) ────────────────────────────────────────

interface KatVector {
  algorithm: string;
  input: string;
  expected: string;
}

/**
 * Known Answer Test (KAT) vectors for FIPS-approved algorithms.
 */
const KAT_VECTORS: KatVector[] = [
  {
    algorithm: "sha256",
    input: "abc",
    expected:
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  },
  {
    algorithm: "sha384",
    input: "abc",
    expected:
      "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
  },
  {
    algorithm: "sha512",
    input: "abc",
    expected:
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  },
];

/**
 * Run Known Answer Tests (KATs) for FIPS-approved algorithms.
 * Returns `{ compliant: true }` if all tests pass, or a detailed
 * failure report.
 */
export function runSelfTests(): FipsCheckResult {
  for (const vector of KAT_VECTORS) {
    try {
      const hash = createHash(vector.algorithm)
        .update(vector.input)
        .digest("hex");
      if (hash !== vector.expected) {
        return {
          compliant: false,
          reason: `KAT failed for ${vector.algorithm}: expected ${vector.expected.slice(0, 16)}..., got ${hash.slice(0, 16)}...`,
        };
      }
    } catch (err) {
      return {
        compliant: false,
        reason: `KAT error for ${vector.algorithm}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
  return { compliant: true };
}

// ── CSPRNG ─────────────────────────────────────────────────────────────────

/**
 * Generate cryptographically secure random bytes.
 * Uses Node.js crypto.randomBytes (backed by OpenSSL CSPRNG).
 */
export function secureRandomBytes(length: number): Uint8Array {
  return randomBytes(length);
}

/**
 * Generate a cryptographically secure random hex string of the given
 * byte length (output will be 2× `byteLength` characters long).
 */
export function secureRandomHex(byteLength: number): string {
  return randomBytes(byteLength).toString("hex");
}

/**
 * Generate a cryptographically secure random alphanumeric string
 * (base62: 0-9, a-z, A-Z).
 */
export function secureRandomString(length: number): string {
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let result = "";
  let i = 0;
  // Rejection sampling to avoid modulo bias: 256 / 62 = 4 remainder 8,
  // so only bytes in [0, 247] are fair. Reject bytes >= 248.
  while (result.length < length) {
    if (bytes[i]! < 248) {
      result += chars[bytes[i]! % chars.length];
    }
    i++;
  }
  return result;
}

// ── Version / environment checks ───────────────────────────────────────────

/**
 * Check whether the OpenSSL module supports FIPS mode.
 * Returns true if FIPS-capable ciphers are available.
 */
export function isFipsCapable(): boolean {
  try {
    const hashes = getHashes();
    const ciphers = getCiphers();
    return (
      FIPS_HASHES.size > 0 &&
      [...FIPS_HASHES].every((h) => hashes.includes(h)) &&
      [...FIPS_CIPHERS].every((c) => ciphers.includes(c))
    );
  } catch {
    return false;
  }
}

/**
 * Verify that the runtime's crypto module meets baseline FIPS requirements.
 * Checks:
 * 1. KAT self-tests pass
 * 2. SHA-256 is available
 * 3. AES-256-GCM is available
 * 4. CSPRNG produces non-zero bytes
 */
export function verifyFipsReadiness(): FipsCheckResult[] {
  const results: FipsCheckResult[] = [];

  // Self-test
  results.push(runSelfTests());

  // SHA-256 availability
  try {
    createHash("sha256").update("test").digest();
    results.push({ compliant: true });
  } catch {
    results.push({
      compliant: false,
      reason: "SHA-256 is not available",
    });
  }

  // AES-256-GCM availability
  try {
    const ciphers = getCiphers();
    if (ciphers.includes("aes-256-gcm")) {
      results.push({ compliant: true });
    } else {
      results.push({
        compliant: false,
        reason: "AES-256-GCM is not available",
      });
    }
  } catch {
    results.push({
      compliant: false,
      reason: "Cannot query available ciphers",
    });
  }

  // CSPRNG produces non-zero
  try {
    const bytes = randomBytes(32);
    const allZero = bytes.every((b) => b === 0);
    if (allZero) {
      results.push({
        compliant: false,
        reason: "CSPRNG produced zero bytes",
      });
    } else {
      results.push({ compliant: true });
    }
  } catch {
    results.push({
      compliant: false,
      reason: "CSPRNG failed to produce random bytes",
    });
  }

  return results;
}

/**
 * Returns a human-readable summary of all FIPS compliance checks.
 * "PASS / 4" if all pass, otherwise "FAIL (N/4): reason1; reason2".
 */
export function fipsReadinessSummary(): string {
  const results = verifyFipsReadiness();
  const passing = results.filter((r) => r.compliant).length;
  const total = results.length;
  if (passing === total) return `PASS (${passing}/${total})`;
  const failures = results
    .filter((r): r is { compliant: false; reason: string } => !r.compliant)
    .map((r) => r.reason);
  return `FAIL (${passing}/${total}): ${failures.join("; ")}`;
}
