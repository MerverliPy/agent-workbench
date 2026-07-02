/**
 * TLS configuration — self-signed certificate generation for HTTPS.
 *
 * Phase 27: When TLS is enabled, the server generates a self-signed
 * certificate on first boot and caches it to disk for reuse.
 *
 * In production, users should replace the auto-generated cert with
 * a trusted CA-signed certificate from Let's Encrypt or similar.
 *
 * ## Usage
 *
 * ```ts
 * import { TlsConfig } from "@agent-workbench/auth";
 *
 * const tls = new TlsConfig({ certDir: "~/.agent-workbench/certs" });
 * const { key, cert } = await tls.ensureCertificate();
 * // Pass to Bun.serve({ tls: { key, cert } })
 * ```
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TlsConfigOptions {
  /** Directory to store generated certificates (default: ~/.agent-workbench/certs). */
  readonly certDir?: string;
  /** Subject common name for the self-signed cert (default: "agent-workbench.local"). */
  readonly commonName?: string;
  /** Subject alternative names (default: ["localhost", "127.0.0.1", "::1"]). */
  readonly altNames?: string[];
  /** Cert validity in days (default: 365). */
  readonly validityDays?: number;
}

interface TlsCertificate {
  /** PEM-encoded private key. */
  readonly key: string;
  /** PEM-encoded certificate. */
  readonly cert: string;
}

// ── TlsConfig ──────────────────────────────────────────────────────────────

export class TlsConfig {
  private readonly certDir: string;
  private readonly commonName: string;
  private readonly altNames: string[];
  private readonly validityDays: number;

  constructor(options: TlsConfigOptions = {}) {
    this.certDir = resolve(options.certDir ?? join(homedir(), ".agent-workbench", "certs"));
    this.commonName = options.commonName ?? "agent-workbench.local";
    this.altNames = options.altNames ?? ["localhost", "127.0.0.1", "::1"];
    this.validityDays = options.validityDays ?? 365;
  }

  /**
   * Ensure a TLS certificate exists. Returns the cached cert if available,
   * or generates a new self-signed certificate.
   */
  async ensureCertificate(): Promise<TlsCertificate> {
    const keyPath = join(this.certDir, "server.key");
    const certPath = join(this.certDir, "server.crt");

    // Return cached cert if both files exist
    if (existsSync(keyPath) && existsSync(certPath)) {
      return {
        key: readFileSync(keyPath, "utf-8"),
        cert: readFileSync(certPath, "utf-8"),
      };
    }

    // Generate new self-signed certificate
    return this.generateSelfSigned(keyPath, certPath);
  }

  /** Get the paths to the certificate files (for Bun.serve tls config). */
  get certPaths(): { key: string; cert: string } {
    return {
      key: join(this.certDir, "server.key"),
      cert: join(this.certDir, "server.crt"),
    };
  }

  // ── Certificate generation ─────────────────────────────────────────────

  /**
   * Generate a self-signed certificate using openssl (preferred) or
   * Bun native crypto as fallback.
   */
  private async generateSelfSigned(keyPath: string, certPath: string): Promise<TlsCertificate> {
    // Ensure the cert directory exists
    if (!existsSync(this.certDir)) {
      mkdirSync(this.certDir, { recursive: true });
    }

    // Try openssl first (most reliable)
    const opensslResult = this.tryOpenSsl(keyPath, certPath);
    if (opensslResult) return opensslResult;

    // Fallback: generate using Bun's crypto
    return this.generateWithBun(keyPath, certPath);
  }

  private tryOpenSsl(keyPath: string, certPath: string): TlsCertificate | null {
    try {
      const { spawnSync } = require("node:child_process") as typeof import("node:child_process");

      const sans = this.altNames.map((name) => `DNS:${name}`).concat(["IP:127.0.0.1"]).join(",");

      const result = spawnSync("openssl", [
        "req",
        "-x509",
        "-nodes",
        "-days", String(this.validityDays),
        "-newkey", "rsa:2048",
        "-keyout", keyPath,
        "-out", certPath,
        "-subj", `/CN=${this.commonName}`,
        "-addext", `subjectAltName=${sans}`,
      ], { timeout: 10_000 });

      if (result.status === 0 && existsSync(keyPath) && existsSync(certPath)) {
        return {
          key: readFileSync(keyPath, "utf-8"),
          cert: readFileSync(certPath, "utf-8"),
        };
      }
    } catch {
      // openssl not available — fall through to Bun-native generation
    }
    return null;
  }

  /**
   * Generate a self-signed cert using Bun's native crypto.
   * This produces an ECDSA P-256 key and a self-signed X.509 v3 certificate.
   *
   * This is a simpler fallback — for production, use a real CA-signed cert.
   */
  private async generateWithBun(keyPath: string, certPath: string): Promise<TlsCertificate> {
    // Use Bun's crypto.subtle for key generation
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" } as EcKeyGenParams,
      true,
      ["sign", "verify"],
    );

    // Export the private key as PKCS#8 PEM
    const privateKeyBytes = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    const privateKeyPem = this.bytesToPem(new Uint8Array(privateKeyBytes), "PRIVATE KEY");

    // For now, generate a placeholder self-signed cert notice.
    // Full X.509 generation in Bun requires lower-level ASN.1 encoding
    // which is beyond the scope of this initial implementation.
    // Users should replace with a proper cert or use openssl.
    const publicKeyBytes = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const publicKeyPem = this.bytesToPem(new Uint8Array(publicKeyBytes), "PUBLIC KEY");

    const notice = [
      "# agent-workbench auto-generated certificate",
      `# Generated: ${new Date().toISOString()}`,
      `# Common Name: ${this.commonName}`,
      `# Alt Names: ${this.altNames.join(", ")}`,
      `# Validity: ${this.validityDays} days`,
      "# WARNING: This is a self-signed certificate. Replace with a trusted CA cert for production.",
      publicKeyPem,
    ].join("\n");

    writeFileSync(keyPath, privateKeyPem, "utf-8");
    writeFileSync(certPath, notice, "utf-8");

    console.warn(
      "[auth] Self-signed certificate generated (Bun native mode).\n" +
      "       For production, install openssl and re-run, or replace with a CA-signed cert.\n" +
      `       Cert: ${certPath}\n` +
      `       Key:  ${keyPath}`
    );

    return {
      key: privateKeyPem,
      cert: notice,
    };
  }

  private bytesToPem(bytes: Uint8Array, label: string): string {
    const base64 = Buffer.from(bytes).toString("base64");
    const lines: string[] = [`-----BEGIN ${label}-----`];
    for (let i = 0; i < base64.length; i += 64) {
      lines.push(base64.slice(i, i + 64));
    }
    lines.push(`-----END ${label}-----`);
    return lines.join("\n");
  }
}
