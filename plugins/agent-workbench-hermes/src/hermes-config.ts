/**
 * Hermes config reader — parses ~/.hermes/config.yaml and auth.json.
 *
 * Phase 30 / Hermes Bridge: Discovers the provider chain and credentials
 * that Hermes Agent uses, making them available as agent-workbench
 * PluginModelProvider instances.
 */

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HermesProviderEntry {
  /** Provider name (e.g. "deepseek", "copilot"). */
  readonly provider: string;
  /** Model name (e.g. "deepseek-v4-flash", "kimi-k2.7-code"). */
  readonly model: string;
  /** Base URL from credentials (if available). */
  readonly baseUrl?: string;
  /** API key from credentials. */
  readonly apiKey?: string;
  /** Whether this is the primary (default) provider. */
  readonly isPrimary: boolean;
}

export interface HermesConfig {
  /** Default provider info. */
  readonly default: HermesProviderEntry;
  /** Fallback provider chain. */
  readonly fallbacks: HermesProviderEntry[];
  /** All providers in priority order. */
  readonly all: HermesProviderEntry[];
}

interface AuthCredential {
  readonly label: string;
  readonly auth_type: string;
  readonly source: string;
  readonly base_url?: string;
}

interface AuthFile {
  readonly version: number;
  readonly credential_pool: Record<string, AuthCredential[]>;
}

// ── Paths ──────────────────────────────────────────────────────────────────

const HERMES_DIR = resolve(homedir(), ".hermes");
const CONFIG_PATH = join(HERMES_DIR, "config.yaml");
const AUTH_PATH = join(HERMES_DIR, "auth.json");

// ── Config reader ──────────────────────────────────────────────────────────

/**
 * Read and parse Hermes Agent configuration.
 * Returns null if Hermes config is not found or unparseable.
 */
export function readHermesConfig(): HermesConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const auth = readAuthFile();
    return parseConfig(raw, auth);
  } catch (err) {
    console.warn("[hermes-bridge] Failed to read Hermes config:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Report whether Hermes config exists and is readable. */
export function hermesAvailable(): boolean {
  return existsSync(CONFIG_PATH);
}

// ── Internal ───────────────────────────────────────────────────────────────

function parseConfig(raw: string, auth: AuthFile | null): HermesConfig {
  const lines = raw.split("\n");
  const entries: HermesProviderEntry[] = [];
  let currentSection: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Detect top-level sections
    if (!line.startsWith(" ") && !line.startsWith("-") && trimmed.endsWith(":")) {
      currentSection = trimmed.slice(0, -1);
      continue;
    }

    // Parse list items under fallback_providers
    if (currentSection === "fallback_providers" && trimmed.startsWith("- ")) {
      const provider = extractValue(trimmed, "provider");
      if (!provider) continue;

      // Next line should be "  model: ..." (2-space indent)
      const nextLine = lines[i + 1];
      const model = nextLine ? extractValue(nextLine.trim(), "model") : undefined;

      if (provider && model) {
        addEntry(entries, provider, model, false, auth);
      }
      continue;
    }

    // Parse model.default and model.provider under "model" section
    if (currentSection === "model") {
      if (trimmed.startsWith("default:")) {
        const model = trimmed.slice("default:".length).trim();
        // We need to find the associated provider — it's on a different line
        // Store it for now and pair when we find provider:
        continue;
      }
      if (trimmed.startsWith("provider:")) {
        const provider = trimmed.slice("provider:".length).trim();
        // Look backwards for the default model
        for (let j = i - 1; j >= 0 && j > i - 10; j--) {
          const prev = lines[j]!.trim();
          if (prev.startsWith("default:")) {
            const model = prev.slice("default:".length).trim();
            if (model) {
              addEntry(entries, provider, model, true, auth);
            }
            break;
          }
        }
        continue;
      }
    }
  }

  return {
    default: entries[0] ?? { provider: "unknown", model: "unknown", isPrimary: false },
    fallbacks: entries.slice(1),
    all: entries,
  };
}

function addEntry(
  entries: HermesProviderEntry[],
  provider: string,
  model: string,
  isPrimary: boolean,
  auth: AuthFile | null,
): void {
  const cred = getCredential(auth, provider);
  entries.push({
    provider,
    model,
    baseUrl: cred?.base_url,
    apiKey: resolveApiKey(cred),
    isPrimary,
  });
}

function extractValue(line: string, key: string): string | undefined {
  // Match "key: value" possibly with leading dash
  const re = new RegExp(`-?\\s*${key}:\\s*(\\S+)`);
  const m = line.match(re);
  return m ? m[1]! : undefined;
}

function readAuthFile(): AuthFile | null {
  if (!existsSync(AUTH_PATH)) return null;
  try {
    return JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as AuthFile;
  } catch {
    return null;
  }
}

function getCredential(auth: AuthFile | null, providerName: string): AuthCredential | undefined {
  if (!auth) return undefined;
  const pool = auth.credential_pool;
  if (pool[providerName] && pool[providerName]!.length > 0) {
    return pool[providerName]![0];
  }
  return undefined;
}

function resolveApiKey(cred: AuthCredential | undefined): string | undefined {
  if (!cred) return undefined;
  const source = cred.source;
  if (source.startsWith("env:")) {
    return process.env[source.slice(4)] ?? undefined;
  }
  return undefined;
}
