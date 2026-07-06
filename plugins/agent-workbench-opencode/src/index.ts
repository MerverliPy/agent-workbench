/**
 * agent-workbench-opencode — OpenCode Bridge Plugin
 *
 * Reads OpenCode configuration (~/.config/opencode/opencode.jsonc +
 * ~/.local/share/opencode/auth.json) and exposes each provider as
 * an agent-workbench PluginModelProvider.
 *
 * ## How it works
 *
 * 1. On plugin load, reads OpenCode config to discover the default model
 * 2. Reads credentials from ~/.local/share/opencode/auth.json
 * 3. Creates an OpenAI-compatible adapter for each provider
 * 4. Provider IDs are prefixed "opencode:" so users can identify them
 *    (e.g. "opencode:deepseek", "opencode:github-copilot")
 *
 * ## Requirements
 *
 * - OpenCode must be installed and configured at ~/.config/opencode/
 * - API keys are read from the OpenCode auth file
 * - Plugin requires "filesystemRead: true" to read config files
 */

import type {
  PluginModelMessage,
  PluginModelProvider,
  PluginModelResponse,
} from "@agent-workbench/plugin-sdk";
import { opencodeAvailable, readOpenCodeConfig } from "./opencode-config";

// ── Minimum OpenAI-compatible provider adapter ─────────────────────────────

/**
 * A minimal provider that forwards requests to an OpenAI-compatible
 * chat completions API. Lightweight — no async generators, no streaming
 * (the TUI falls back to non-streaming if streaming isn't available).
 */
class OpenCodeProviderAdapter implements PluginModelProvider {
  readonly id: string;
  readonly name: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: {
    providerId: string;
    displayName: string;
    model: string;
    baseUrl: string;
    apiKey: string;
  }) {
    this.id = config.providerId;
    this.name = config.displayName;
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  async call(
    messages: PluginModelMessage[],
    _tools?: unknown[],
    signal?: AbortSignal | null,
  ): Promise<PluginModelResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: signal ?? undefined,
    } as RequestInit);

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(
        `[${this.id}] API ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as Record<string, unknown>;
    const choice = (
      json.choices as Array<Record<string, unknown>> | undefined
    )?.[0];
    const message = choice?.message as Record<string, unknown> | undefined;
    const content = (message?.content as string | null) ?? "";
    const usage = json.usage as Record<string, unknown> | undefined;

    return {
      content,
      ...(usage
        ? {
            usage: {
              inputTokens: (usage.prompt_tokens as number) ?? 0,
              outputTokens: (usage.completion_tokens as number) ?? 0,
            },
          }
        : {}),
    };
  }
}

// ── Provider factory ───────────────────────────────────────────────────────

function buildProviders(): OpenCodeProviderAdapter[] {
  if (!opencodeAvailable()) {
    console.warn(
      "[opencode-bridge] ~/.config/opencode/opencode.jsonc not found — no providers loaded",
    );
    return [];
  }

  const config = readOpenCodeConfig();
  if (!config || config.all.length === 0) {
    console.warn(
      "[opencode-bridge] OpenCode config is empty or unparseable — no providers loaded",
    );
    return [];
  }

  const providers: OpenCodeProviderAdapter[] = [];

  for (const entry of config.all) {
    if (!entry.apiKey) {
      console.warn(
        `[opencode-bridge] No API key found for ${entry.provider} — skipping`,
      );
      continue;
    }

    const providerId = `opencode:${entry.provider}`;
    const displayName = `${entry.provider} (OpenCode — ${entry.model})`;

    try {
      providers.push(
        new OpenCodeProviderAdapter({
          providerId,
          displayName,
          model: entry.model,
          baseUrl: entry.baseUrl,
          apiKey: entry.apiKey,
        }),
      );

      console.log(
        `[opencode-bridge] Loaded provider: ${providerId} (${displayName})`,
      );
    } catch (err) {
      console.warn(
        `[opencode-bridge] Failed to initialize ${providerId}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return providers;
}

// ── Plugin entry point ─────────────────────────────────────────────────────

const providers = buildProviders();

export default {
  name: "agent-workbench-opencode",
  version: "1.0.0",
  providers,
};
