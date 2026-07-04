/**
 * OpenCode config reader — parses ~/.config/opencode/opencode.jsonc.
 *
 * Phase 30 / OpenCode Bridge: Reads OpenCode's active model configuration
 * and makes it available as an agent-workbench PluginModelProvider.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OpenCodeProviderEntry {
  /** Provider name extracted from the model string (e.g. "deepseek"). */
  readonly provider: string;
  /** Full model identifier (e.g. "deepseek/deepseek-v4-pro"). */
  readonly model: string;
  /** Known base URL for this provider. */
  readonly baseUrl: string | undefined;
  /** Provider display label. */
  readonly label: string;
}

export interface OpenCodeConfig {
  /** The active model provider entry. */
  readonly active: OpenCodeProviderEntry;
}

interface OpenCodeJsonc {
  readonly model?: string;
  readonly agent?: {
    readonly build?: {
      readonly variant?: string;
    };
  };
}

// ── Paths ──────────────────────────────────────────────────────────────────

const OPENCODE_DIR = resolve(homedir(), ".config", "opencode");
const CONFIG_PATH = join(OPENCODE_DIR, "opencode.jsonc");

// ── Known base URLs ────────────────────────────────────────────────────────

const KNOWN_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com/v1",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  "opencode-go": "https://opencode.ai/zen/go/v1",
  copilot: "https://api.githubcopilot.com",
  ollama: "http://localhost:11434/v1",
  google: "https://generativelanguage.googleapis.com/v1beta",
};

// ── Config reader ──────────────────────────────────────────────────────────

/**
 * Read and parse OpenCode configuration.
 * Returns null if config is not found or unparseable.
 */
export function readOpenCodeConfig(): OpenCodeConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return parseConfig(raw);
  } catch (err) {
    console.warn(
      "[opencode-bridge] Failed to read OpenCode config:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** Report whether OpenCode config exists and is readable. */
export function openCodeAvailable(): boolean {
  return existsSync(CONFIG_PATH);
}

// ── Internal ───────────────────────────────────────────────────────────────

function parseConfig(raw: string): OpenCodeConfig | null {
  // Strip JSONC comments (single-line // comments)
  const noComments = raw.replace(/\/\/.*$/gm, "").trim();
  if (!noComments) return null;

  let parsed: OpenCodeJsonc;
  try {
    parsed = JSON.parse(noComments) as OpenCodeJsonc;
  } catch {
    console.warn("[opencode-bridge] Failed to parse opencode.jsonc as JSON");
    return null;
  }

  const modelStr = parsed.model;
  if (!modelStr) {
    console.warn("[opencode-bridge] opencode.jsonc has no 'model' field");
    return null;
  }

  const { provider, model } = parseModelString(modelStr);
  const baseUrl = KNOWN_BASE_URLS[provider];

  return {
    active: {
      provider,
      model,
      baseUrl,
      label: `${provider} (OpenCode — ${model})`,
    },
  };
}

/**
 * Parse a model string like "deepseek/deepseek-v4-pro" or "claude-sonnet-4"
 * into provider and model components.
 */
function parseModelString(modelStr: string): {
  provider: string;
  model: string;
} {
  const parts = modelStr.split("/");
  if (parts.length >= 2) {
    return { provider: parts[0]!, model: modelStr };
  }
  // No slash — try to infer provider from known prefixes
  const knownPrefixes: Record<string, string> = {
    "gpt-": "openai",
    "o1-": "openai",
    "o3-": "openai",
    "claude-": "anthropic",
    "gemini-": "google",
    "llama-": "groq",
  };

  for (const [prefix, provider] of Object.entries(knownPrefixes)) {
    if (modelStr.startsWith(prefix)) {
      return { provider, model: modelStr };
    }
  }

  return { provider: "unknown", model: modelStr };
}
