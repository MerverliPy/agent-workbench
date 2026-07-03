import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type {
  ProviderProfile,
  ProviderTier,
  TaskCategory,
} from "@agent-workbench/protocol";

/**
 * File-system-backed provider marketplace registry.
 *
 * Profiles are stored as individual JSON files under
 * `~/.agent-workbench/providers/<id>.json` so they are easy to
 * version-control, share, and edit manually.
 */
export class ProviderMarketplace {
  private readonly profilesDir: string;
  private profiles: Map<string, ProviderProfile> = new Map();

  constructor(profilesDir?: string) {
    this.profilesDir =
      profilesDir ?? resolve(homedir(), ".agent-workbench", "providers");
    this.ensureProfilesDir();
    this.loadAll();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** List all provider profiles (optionally filtered by tier and enabled status). */
  list(options?: {
    tier?: ProviderTier;
    enabledOnly?: boolean;
  }): ProviderProfile[] {
    let result = Array.from(this.profiles.values());

    if (options?.tier !== undefined) {
      result = result.filter((p) => p.tier === options.tier);
    }
    if (options?.enabledOnly !== false) {
      result = result.filter((p) => p.enabled);
    }

    return result.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  /** Get a single profile by ID. */
  get(id: string): ProviderProfile | undefined {
    return this.profiles.get(id);
  }

  /** Create a new provider profile from user input. */
  create(input: Record<string, unknown>): ProviderProfile {
    const id = input.id as string;
    if (this.profiles.has(id)) {
      throw new Error(`Provider profile already exists: ${id}`);
    }

    const now = new Date().toISOString();
    const profile: ProviderProfile = {
      id,
      name: input.name as string,
      providerType: input.providerType as string,
      model: input.model as string,
      baseUrl: input.baseUrl as string | undefined,
      tier: (input.tier as ProviderTier) ?? "fallback",
      taskCategories: (input.taskCategories as TaskCategory[]) ?? [
        "read",
        "summarization",
      ],
      contextLimit: input.contextLimit as number | undefined,
      hasKey: Boolean(input.apiKey && (input.apiKey as string).length > 0),
      costPer1KInput: (input.costPer1KInput as number) ?? 0,
      costPer1KOutput: (input.costPer1KOutput as number) ?? 0,
      supportsStreaming: (input.supportsStreaming as boolean) ?? true,
      enabled: (input.enabled as boolean) ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);
    this.persist(profile);
    return profile;
  }

  /** Update an existing provider profile. */
  update(id: string, patch: Record<string, unknown>): ProviderProfile {
    const existing = this.profiles.get(id);
    if (existing === undefined) {
      throw new Error(`Provider profile not found: ${id}`);
    }

    const updated: ProviderProfile = JSON.parse(JSON.stringify(existing));
    updated.updatedAt = new Date().toISOString();

    if (patch.name !== undefined && patch.name !== null) {
      (updated as Record<string, unknown>).name = patch.name as string;
    }
    if (patch.providerType !== undefined && patch.providerType !== null) {
      (updated as Record<string, unknown>).providerType =
        patch.providerType as string;
    }
    if (patch.model !== undefined && patch.model !== null) {
      (updated as Record<string, unknown>).model = patch.model as string;
    }
    if (patch.baseUrl !== undefined && patch.baseUrl !== null) {
      (updated as Record<string, unknown>).baseUrl = patch.baseUrl as string;
    }
    if (patch.tier !== undefined && patch.tier !== null) {
      updated.tier = patch.tier as ProviderTier;
    }
    if (patch.taskCategories !== undefined && patch.taskCategories !== null) {
      updated.taskCategories = patch.taskCategories as TaskCategory[];
    }
    if (patch.contextLimit !== undefined && patch.contextLimit !== null) {
      (updated as Record<string, unknown>).contextLimit =
        patch.contextLimit as number;
    }
    if (patch.costPer1KInput !== undefined && patch.costPer1KInput !== null) {
      (updated as Record<string, unknown>).costPer1KInput =
        patch.costPer1KInput as number;
    }
    if (patch.costPer1KOutput !== undefined && patch.costPer1KOutput !== null) {
      (updated as Record<string, unknown>).costPer1KOutput =
        patch.costPer1KOutput as number;
    }
    if (
      patch.supportsStreaming !== undefined &&
      patch.supportsStreaming !== null
    ) {
      (updated as Record<string, unknown>).supportsStreaming =
        patch.supportsStreaming as boolean;
    }
    if (patch.enabled !== undefined && patch.enabled !== null) {
      (updated as Record<string, unknown>).enabled = patch.enabled as boolean;
    }
    if (patch.apiKey !== undefined && patch.apiKey !== null) {
      updated.hasKey = (patch.apiKey as string).length > 0;
    }

    this.profiles.set(id, updated);
    this.persist(updated);
    return updated;
  }

  /** Delete a provider profile. */
  delete(id: string): boolean {
    const existed = this.profiles.has(id);
    if (!existed) return false;

    this.profiles.delete(id);
    const filePath = join(this.profilesDir, `${id}.json`);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {
      // Best-effort cleanup
    }
    return true;
  }

  /** Store an API key for a profile (outside the profile JSON for security). */
  setApiKey(profileId: string, apiKey: string): void {
    const profile = this.profiles.get(profileId);
    if (profile === undefined) {
      throw new Error(`Provider profile not found: ${profileId}`);
    }

    const keyFile = join(this.profilesDir, `${profileId}.key`);
    writeFileSync(keyFile, apiKey, { encoding: "utf-8", mode: 0o600 });
    profile.hasKey = true;
    this.persist(profile);
  }

  /** Retrieve the API key for a profile. Returns empty string if not set. */
  getApiKey(profileId: string): string {
    const keyFile = join(this.profilesDir, `${profileId}.key`);
    try {
      return readFileSync(keyFile, "utf-8").trim();
    } catch {
      return "";
    }
  }

  /** Delete the API key for a profile. */
  deleteApiKey(profileId: string): void {
    const keyFile = join(this.profilesDir, `${profileId}.key`);
    try {
      if (existsSync(keyFile)) {
        unlinkSync(keyFile);
      }
    } catch {
      // Best-effort
    }

    const profile = this.profiles.get(profileId);
    if (profile) {
      profile.hasKey = false;
      this.persist(profile);
    }
  }

  /** Get the directory path for manual inspection. */
  getProfilesDir(): string {
    return this.profilesDir;
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private ensureProfilesDir(): void {
    if (!existsSync(this.profilesDir)) {
      mkdirSync(this.profilesDir, { recursive: true });
    }
  }

  private loadAll(): void {
    let files: string[];
    try {
      files = readdirSync(this.profilesDir).filter((f) => f.endsWith(".json"));
    } catch {
      return;
    }

    for (const file of files) {
      try {
        const filePath = join(this.profilesDir, file);
        const content = readFileSync(filePath, "utf-8");
        const profile = JSON.parse(content) as ProviderProfile;
        this.profiles.set(profile.id, profile);
      } catch {
        // Skip malformed files
      }
    }
  }

  private persist(profile: ProviderProfile): void {
    const filePath = join(this.profilesDir, `${profile.id}.json`);
    writeFileSync(filePath, JSON.stringify(profile, null, 2), {
      encoding: "utf-8",
    });
  }
}
