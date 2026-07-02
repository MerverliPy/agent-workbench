/**
 * agent-workbench-hermes — Hermes Agent Bridge Plugin
 *
 * Reads Hermes Agent configuration (~/.hermes/config.yaml + auth.json)
 * and exposes each provider as an agent-workbench PluginModelProvider.
 *
 * ## How it works
 *
 * 1. On plugin load, reads Hermes config to discover the provider chain:
 *      default: deepseek/deepseek-v4-flash
 *      fallback: copilot/kimi-k2.7-code, opencode-go/qwen3.7-plus
 * 2. Reads credentials from ~/.hermes/auth.json credential_pool
 * 3. Creates an OpenAI-compatible adapter for each provider
 * 4. Provider IDs are prefixed "hermes:" so users can identify them
 *    (e.g. "hermes:deepseek", "hermes:copilot")
 *
 * ## Provider Mapping
 *
 * | Hermes Tier    | agent-workbench Smart Router Tier |
 * |----------------|-----------------------------------|
 * | default        | Cheapest (read/grep/glob/summarize) |
 * | fallback[0]    | Mid-tier (code gen)                |
 * | fallback[1+]   | Strongest (architecture/review)    |
 *
 * ## Requirements
 *
 * - Hermes Agent must be installed and configured at ~/.hermes/
 * - API keys are read from environment variables (same as Hermes uses)
 * - Plugin requires "filesystemRead: true" to read config files
 */

import { readHermesConfig, hermesAvailable } from "./hermes-config";
import { OpenAIAdapter } from "./openai-adapter";
import { CopilotAdapter } from "./copilot-adapter";

// ── Provider factory ───────────────────────────────────────────────────────

/**
 * Build agent-workbench PluginModelProvider instances from Hermes config.
 *
 * Called once on plugin load. Returns an array of providers (one per
 * Hermes provider entry), or an empty array if Hermes is not configured.
 */
function buildProviders(): Array<OpenAIAdapter | CopilotAdapter> {
  if (!hermesAvailable()) {
    console.warn("[hermes-bridge] ~/.hermes/config.yaml not found — no providers loaded");
    return [];
  }

  const config = readHermesConfig();
  if (!config || config.all.length === 0) {
    console.warn("[hermes-bridge] Hermes config is empty or unparseable — no providers loaded");
    return [];
  }

  const providers: Array<OpenAIAdapter | CopilotAdapter> = [];

  for (const entry of config.all) {
    if (!entry.apiKey) {
      console.warn(`[hermes-bridge] No API key found for ${entry.provider} — skipping`);
      continue;
    }

    const baseUrl = entry.baseUrl ?? guessBaseUrl(entry.provider);
    const providerId = `hermes:${entry.provider}`;
    const displayName = `${entry.provider} (Hermes — ${entry.model})`;

    try {
      switch (entry.provider) {
        case "copilot":
          providers.push(new CopilotAdapter({
            model: entry.model,
            apiKey: entry.apiKey,
            baseUrl,
          }));
          break;

        default:
          // DeepSeek, opencode-go, and any other OpenAI-compatible provider
          providers.push(new OpenAIAdapter({
            providerId,
            displayName,
            model: entry.model,
            baseUrl,
            apiKey: entry.apiKey,
          }));
          break;
      }

      console.log(`[hermes-bridge] Loaded provider: ${providerId} (${displayName})`);
    } catch (err) {
      console.warn(`[hermes-bridge] Failed to initialize ${providerId}:`, err instanceof Error ? err.message : String(err));
    }
  }

  return providers;
}

/**
 * Guess the base URL for a well-known provider if not specified in config.
 */
function guessBaseUrl(provider: string): string {
  const known: Record<string, string> = {
    deepseek: "https://api.deepseek.com/v1",
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    openrouter: "https://openrouter.ai/api/v1",
    groq: "https://api.groq.com/openai/v1",
    together: "https://api.together.xyz/v1",
    "opencode-go": "https://opencode.ai/zen/go/v1",
    copilot: "https://api.githubcopilot.com",
    ollama: "http://localhost:11434/v1",
  };
  return known[provider] ?? `https://api.${provider}.com/v1`;
}

// ── Plugin entry point (ProviderPlugin interface) ──────────────────────────

const providers = buildProviders();

export default {
  name: "agent-workbench-hermes",
  version: "1.0.0",
  providers,
};
