/**
 * OpenCode sync — bidirectional provider config sync between agent-workbench
 * and OpenCode.
 *
 * Phase 30: Synchronizes the active model provider between agent-workbench's
 * ProviderRegistry and OpenCode's config file (~/.config/opencode/opencode.jsonc).
 *
 * ## How it works
 *
 * - **OpenCode → agent-workbench**: File watcher on opencode.jsonc detects
 *   changes and registers/updates the corresponding provider.
 * - **agent-workbench → OpenCode**: API endpoint writes the selected provider
 *   back to opencode.jsonc.
 * - Config file is backed up before modification.
 */

import { existsSync, readFileSync, writeFileSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { openCodeAvailable, readOpenCodeConfig } from "./opencode-config";
import type { OpenCodeConfig } from "./opencode-config";

// ── Types ──────────────────────────────────────────────────────────────────

/** Minimal provider registry interface for sync. */
export interface ProviderSyncTarget {
  registerPluginProvider(
    id: string,
    provider: {
      call: (request: {
        messages: Array<{ role: string; content: string }>;
      }) => Promise<{ content: string }>;
      stream?: (
        request: { messages: Array<{ role: string; content: string }> },
      ) => AsyncIterable<{ delta: string; done: boolean }>;
    },
    meta: {
      name: string;
      description: string;
      modelId: string;
      modelName: string;
    },
  ): void;
  getProvider(id: string): unknown;
}

export interface SyncResult {
  readonly synced: boolean;
  readonly providerId: string | undefined;
  readonly message: string;
}

// ── Paths ──────────────────────────────────────────────────────────────────

const OPENCODE_DIR = resolve(homedir(), ".config", "opencode");
const CONFIG_PATH = join(OPENCODE_DIR, "opencode.jsonc");
const BACKUP_DIR = join(OPENCODE_DIR, "backup");

// ── Logger ─────────────────────────────────────────────────────────────────

function log(...args: unknown[]): void {
  console.log("[opencode-sync]", ...args);
}

function warn(...args: unknown[]): void {
  console.warn("[opencode-sync]", ...args);
}

// ── Sync helpers ───────────────────────────────────────────────────────────

/**
 * Create a minimal call adapter that wraps an OpenAI-compatible chat
 * completion endpoint, using the model and base URL from OpenCode config.
 */
function createModelCallAdapter(
  config: OpenCodeConfig,
  apiKey: string | undefined,
): {
  call: (request: {
    messages: Array<{ role: string; content: string }>;
  }) => Promise<{ content: string }>;
} {
  return {
    call: async (request) => {
      // If no API key, return a helpful error message as content
      if (!apiKey) {
        return {
          content: `[OpenCode Sync] Provider "${config.active.provider}" is not configured with an API key. Set ${config.active.provider.toUpperCase()}_API_KEY to enable this provider.`,
        };
      }

      try {
        const response = await fetch(
          `${config.active.baseUrl ?? `https://api.${config.active.provider}.com/v1`}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: config.active.model,
              messages: request.messages,
            }),
          },
        );

        const data = (await response.json()) as {
          choices?: Array<{
            message?: { content?: string };
          }>;
        };

        return {
          content:
            data.choices?.[0]?.message?.content ??
            `[OpenCode Sync] No response from ${config.active.provider}`,
        };
      } catch (err) {
        return {
          content: `[OpenCode Sync] Error calling ${config.active.provider}: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}

// ── Sync: OpenCode → agent-workbench ──────────────────────────────────────

/**
 * Read OpenCode config and register the provider in agent-workbench's
 * ProviderRegistry.
 *
 * Returns a SyncResult indicating what was synced.
 */
export function syncFromOpenCode(
  providerRegistry: ProviderSyncTarget,
): SyncResult {
  if (!openCodeAvailable()) {
    return {
      synced: false,
      providerId: undefined,
      message: "OpenCode config not found at ~/.config/opencode/opencode.jsonc",
    };
  }

  const config = readOpenCodeConfig();
  if (!config) {
    return {
      synced: false,
      providerId: undefined,
      message: "OpenCode config is empty or unparseable",
    };
  }

  const entry = config.active;
  const providerId = `opencode:${entry.provider}`;
  const envVarName = `${entry.provider.toUpperCase()}_API_KEY`.replace(/-/g, "_");
  const apiKey = process.env[envVarName];

  const adapter = createModelCallAdapter(config, apiKey);

  try {
    // Check if already registered
    const existing = providerRegistry.getProvider(providerId);
    if (existing) {
      log(`Provider ${providerId} already registered — skipping`);
      return {
        synced: true,
        providerId,
        message: `Provider ${providerId} already synced`,
      };
    }

    providerRegistry.registerPluginProvider(providerId, adapter, {
      name: entry.label,
      description: `OpenCode-synced provider: ${entry.label}`,
      modelId: entry.model,
      modelName: entry.model,
    });

    log(`Synced provider from OpenCode: ${providerId} (${entry.label})`);
    return {
      synced: true,
      providerId,
      message: `Synced ${providerId} from OpenCode`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`Failed to sync OpenCode provider ${providerId}: ${msg}`);
    return {
      synced: false,
      providerId,
      message: `Failed to sync: ${msg}`,
    };
  }
}

// ── Sync: agent-workbench → OpenCode ─────────────────────────────────────

/**
 * Write a model string to OpenCode's config file.
 * Creates a backup of the current config before writing.
 *
 * @param modelString The model string to write (e.g. "deepseek/deepseek-v4-pro")
 * @returns SyncResult
 */
export function syncToOpenCode(modelString: string): SyncResult {
  if (!modelString || modelString.trim().length === 0) {
    return {
      synced: false,
      providerId: undefined,
      message: "Model string is empty",
    };
  }

  const trimmed = modelString.trim();

  try {
    // Ensure config directory exists
    if (!existsSync(OPENCODE_DIR)) {
      return {
        synced: false,
        providerId: undefined,
        message: `OpenCode config directory not found: ${OPENCODE_DIR}`,
      };
    }

    // Read current config for backup
    let currentContent = "";
    if (existsSync(CONFIG_PATH)) {
      currentContent = readFileSync(CONFIG_PATH, "utf-8");
    }

    // Create backup
    if (currentContent) {
      const backupFilename = `opencode.jsonc.backup.${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const backupPath = join(BACKUP_DIR, backupFilename);

      if (!existsSync(BACKUP_DIR)) {
        const { mkdirSync } = require("node:fs");
        mkdirSync(BACKUP_DIR, { recursive: true });
      }

      writeFileSync(backupPath, currentContent);
    }

    // Parse current config to preserve other fields
    let parsed: Record<string, unknown> = {};
    try {
      // Strip comments for JSON parsing
      const noComments = currentContent.replace(/\/\/.*$/gm, "").trim();
      if (noComments) {
        parsed = JSON.parse(noComments) as Record<string, unknown>;
      }
    } catch {
      // If config is malformed, start fresh
      parsed = {};
    }

    // Update the model field
    parsed.model = trimmed;

    // Also ensure the $schema is present
    if (!parsed["$schema"]) {
      parsed["$schema"] = "https://opencode.ai/config.json";
    }

    // Write back as JSONC (single-line comments style)
    const jsonContent = JSON.stringify(parsed, null, 2) + "\n";
    writeFileSync(CONFIG_PATH, jsonContent);

    log(`Wrote model "${trimmed}" to OpenCode config`);
    return {
      synced: true,
      providerId: `opencode:${trimmed.split("/")[0] ?? "unknown"}`,
      message: `Wrote model "${trimmed}" to ~/.config/opencode/opencode.jsonc`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`Failed to write to OpenCode config: ${msg}`);
    return {
      synced: false,
      providerId: undefined,
      message: `Failed to write: ${msg}`,
    };
  }
}

// ── File watcher ──────────────────────────────────────────────────────────

/** Cleanup function returned by startOpenCodeWatcher. */
export type WatcherCleanup = () => void;

/**
 * Start watching OpenCode config for changes.
 * When the config changes, re-reads it and syncs the provider.
 *
 * @param providerRegistry The provider registry to sync into
 * @returns A cleanup function to stop the watcher
 */
export function startOpenCodeWatcher(
  providerRegistry: ProviderSyncTarget,
): WatcherCleanup {
  if (!openCodeAvailable()) {
    log("OpenCode config not found — watcher not started");
    return () => {};
  }

  log(`Watching ${CONFIG_PATH} for changes...`);

  // Debounce: avoid rapid re-syncs (e.g., editor save)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 500;

  try {
    const watcher = watch(CONFIG_PATH, (eventType) => {
      if (eventType !== "change") return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        log("OpenCode config changed — re-syncing provider");
        const result = syncFromOpenCode(providerRegistry);
        log(result.message);
        debounceTimer = null;
      }, DEBOUNCE_MS);
    });

    // Initial sync on start
    const initialResult = syncFromOpenCode(providerRegistry);
    log(`Initial sync: ${initialResult.message}`);

    return () => {
      watcher.close();
      if (debounceTimer) clearTimeout(debounceTimer);
      log("OpenCode watcher stopped");
    };
  } catch (err) {
    warn(
      `Failed to start OpenCode watcher: ${err instanceof Error ? err.message : String(err)}`,
    );
    return () => {};
  }
}
