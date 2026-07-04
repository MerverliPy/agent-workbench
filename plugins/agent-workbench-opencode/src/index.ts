/**
 * agent-workbench-opencode — OpenCode Bridge Plugin
 *
 * Reads OpenCode configuration (~/.config/opencode/opencode.jsonc)
 * and exposes its active model as an agent-workbench PluginModelProvider.
 *
 * ## How it works
 *
 * 1. On plugin load, reads OpenCode config to discover the active model
 * 2. Parses the model string (e.g. "deepseek/deepseek-v4-pro")
 * 3. Creates an OpenAI-compatible adapter for the provider
 * 4. Provider ID is prefixed "opencode:"
 *
 * ## Requirements
 *
 * - OpenCode must be configured at ~/.config/opencode/opencode.jsonc
 * - API keys are read from environment variables
 * - Plugin requires "filesystemRead: true" to read config files
 */

import { openCodeAvailable, readOpenCodeConfig } from "./opencode-config";

// ── Provider factory ───────────────────────────────────────────────────────

interface OpenCodeBridgeProvider {
  id: string;
  name: string;
  model: string;
  baseUrl: string | undefined;
  apiKey: string | undefined;
}

/**
 * Build an agent-workbench PluginModelProvider from OpenCode config.
 *
 * Called once on plugin load. Returns an array with one provider entry,
 * or an empty array if OpenCode is not configured.
 */
function buildProviders(): OpenCodeBridgeProvider[] {
  if (!openCodeAvailable()) {
    console.warn(
      "[opencode-bridge] ~/.config/opencode/opencode.jsonc not found — no provider loaded",
    );
    return [];
  }

  const config = readOpenCodeConfig();
  if (!config) {
    console.warn(
      "[opencode-bridge] OpenCode config is empty or unparseable — no provider loaded",
    );
    return [];
  }

  const entry = config.active;

  // Resolve API key from env var matching the provider name
  const envVarName = `${entry.provider.toUpperCase()}_API_KEY`.replace(/-/g, "_");
  const apiKey = process.env[envVarName];

  const providerId = `opencode:${entry.provider}`;

  console.log(
    `[opencode-bridge] Loaded provider: ${providerId} (${entry.label})`,
  );

  return [
    {
      id: providerId,
      name: entry.label,
      model: entry.model,
      baseUrl: entry.baseUrl,
      apiKey,
    },
  ];
}

// ── Plugin entry point (ProviderPlugin interface) ──────────────────────────

const providers = buildProviders();

export default {
  name: "agent-workbench-opencode",
  version: "1.0.0",
  providers,
};
