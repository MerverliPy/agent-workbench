/**
 * OpenCode config reader — parses ~/.config/opencode/opencode.jsonc
 * and ~/.local/share/opencode/auth.json.
 *
 * Phase 30 / OpenCode Bridge: Discovers the provider and credentials
 * that OpenCode uses, making them available as agent-workbench
 * PluginModelProvider instances.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OpenCodeProviderEntry {
  /** Provider name (e.g. "deepseek", "opencode-go"). */
  readonly provider: string;
  /** Model name (e.g. "deepseek-v4-pro"). */
  readonly model: string;
  /** API base URL inferred from provider type. */
  readonly baseUrl: string;
  /** API key or OAuth access token. */
  readonly apiKey?: string;
  /** Whether this is the primary (default) model. */
  readonly isPrimary: boolean;
}

export interface OpenCodeConfig {
  /** Primary provider info. */
  readonly default: OpenCodeProviderEntry;
  /** All discovered providers. */
  readonly all: OpenCodeProviderEntry[];
}

interface OAuthCredential {
  readonly type: "oauth";
  readonly access: string;
  readonly refresh: string;
  readonly expires: number;
}

interface ApiCredential {
  readonly type: "api";
  readonly key: string;
}

type OpenCodeAuthEntry = ApiCredential | OAuthCredential;

// ── Paths ──────────────────────────────────────────────────────────────────

const OPCODE_CONFIG_DIR = resolve(homedir(), ".config", "opencode");
const CONFIG_PATH = join(OPCODE_CONFIG_DIR, "opencode.jsonc");
const AUTH_PATH = resolve(
  homedir(),
  ".local",
  "share",
  "opencode",
  "auth.json",
);

// ── Well-known base URLs ───────────────────────────────────────────────────

const KNOWN_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com/v1",
  "opencode-go": "https://opencode.ai/zen/go/v1",
  "github-copilot": "https://api.githubcopilot.com",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

// ── Config reader ──────────────────────────────────────────────────────────

/**
 * Read and parse OpenCode configuration.
 * Returns null if OpenCode config is not found or unparseable.
 */
export function readOpenCodeConfig(): OpenCodeConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const auth = readAuthFile();
    return parseConfig(raw, auth);
  } catch (err) {
    console.warn(
      "[opencode-bridge] Failed to read OpenCode config:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Report whether OpenCode config exists and is readable. */
export function opencodeAvailable(): boolean {
  return existsSync(CONFIG_PATH);
}

// ── Internal ───────────────────────────────────────────────────────────────

interface ParsedJsonc {
  model?: string;
  [key: string]: unknown;
}

function parseConfig(
  raw: string,
  auth: OpenCodeAuthFile | null,
): OpenCodeConfig {
  // Strip JSONC comments
  const cleaned = raw
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      // Remove full-line comments and trailing // comments
      if (trimmed.startsWith("//")) return "";
      const commentIdx = line.indexOf("//");
      if (commentIdx >= 0 && !isInsideString(line, commentIdx)) {
        return line.slice(0, commentIdx);
      }
      return line;
    })
    .join("\n");

  const parsed = JSON.parse(cleaned) as ParsedJsonc;
  const modelSpec = parsed.model ?? "";
  const entries: OpenCodeProviderEntry[] = [];

  // Parse model spec like "deepseek/deepseek-v4-pro" or "provider/model"
  const slashIdx = modelSpec.indexOf("/");
  if (slashIdx >= 0) {
    const providerName = modelSpec.slice(0, slashIdx);
    const modelName = modelSpec.slice(slashIdx + 1);
    const cred = getCredential(auth, providerName);

    const apiKey = resolveApiKey(cred);
    const entry: {
      provider: string;
      model: string;
      baseUrl: string;
      isPrimary: boolean;
      apiKey?: string;
    } = {
      provider: providerName,
      model: modelName,
      baseUrl:
        KNOWN_BASE_URLS[providerName] ?? `https://api.${providerName}.com/v1`,
      isPrimary: true,
    };
    if (apiKey) entry.apiKey = apiKey;
    entries.push(entry as OpenCodeProviderEntry);
  }

  // Discover additional providers from auth file
  if (auth) {
    for (const [providerName, cred] of Object.entries(auth)) {
      const alreadyAdded = entries.some((e) => e.provider === providerName);
      if (alreadyAdded) continue;

      const model = inferDefaultModel(providerName);
      const authApiKey = resolveApiKey(cred);
      const authEntry: {
        provider: string;
        model: string;
        baseUrl: string;
        isPrimary: boolean;
        apiKey?: string;
      } = {
        provider: providerName,
        model,
        baseUrl:
          KNOWN_BASE_URLS[providerName] ?? `https://api.${providerName}.com/v1`,
        isPrimary: false,
      };
      if (authApiKey) authEntry.apiKey = authApiKey;
      entries.push(authEntry as OpenCodeProviderEntry);
    }
  }

  return {
    default: entries[0] ?? {
      provider: "unknown",
      model: "unknown",
      baseUrl: "https://api.unknown.com/v1",
      isPrimary: false,
    },
    all: entries,
  };
}

function isInsideString(line: string, idx: number): boolean {
  let inString = false;
  let escape = false;
  for (let i = 0; i < idx; i++) {
    if (escape) {
      escape = false;
      continue;
    }
    if (line[i] === "\\") {
      escape = true;
      continue;
    }
    if (line[i] === '"') {
      inString = !inString;
    }
  }
  return inString;
}

function inferDefaultModel(providerName: string): string {
  const models: Record<string, string> = {
    deepseek: "deepseek-v4-pro",
    "opencode-go": "qwen3.7-plus",
    "github-copilot": "kimi-k2.7-code",
    openai: "gpt-4o",
    anthropic: "claude-sonnet-4",
    openrouter: "auto",
  };
  return models[providerName] ?? "default";
}

// ── Auth reader ────────────────────────────────────────────────────────────

type OpenCodeAuthFile = Record<string, OpenCodeAuthEntry>;

function readAuthFile(): OpenCodeAuthFile | null {
  if (!existsSync(AUTH_PATH)) return null;
  try {
    return JSON.parse(readFileSync(AUTH_PATH, "utf-8")) as OpenCodeAuthFile;
  } catch {
    return null;
  }
}

function getCredential(
  auth: OpenCodeAuthFile | null,
  providerName: string,
): OpenCodeAuthEntry | undefined {
  if (!auth) return undefined;
  return auth[providerName];
}

function resolveApiKey(
  cred: OpenCodeAuthEntry | undefined,
): string | undefined {
  if (!cred) return undefined;
  if (cred.type === "api") return cred.key;
  if (cred.type === "oauth") return cred.access;
  return undefined;
}
