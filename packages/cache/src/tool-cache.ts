import type { CacheRepository } from "@agent-workbench/storage";
import { ulid } from "ulid";

/**
 * Session-scoped tool result cache backed by the existing CacheRepository
 * (packages/storage cache_entries table).
 *
 * Phase 7: provides get/set/invalidate for read/grep/glob tool results.
 * File-mutation-triggered invalidation will be added in Phase 9 when file
 * mutation tools are implemented.
 *
 * The cache is keyed by:
 *   (sessionId, projectPath, cacheType, cacheKey)
 *
 * `cacheKey` should be a deterministic string derived from the tool's
 * normalised input parameters (e.g. JSON.stringify of sorted input).
 */
export class ToolCache {
  constructor(private readonly repo: CacheRepository) {}

  /**
   * Retrieve a previously cached result.
   *
   * Returns `undefined` when no valid (non-invalidated) entry exists, or when
   * the entry belongs to a different projectPath.
   */
  get(
    sessionId: string,
    projectPath: string,
    cacheType: string,
    cacheKey: string,
  ): unknown | undefined {
    const entry = this.repo.findByKey(sessionId, cacheType, cacheKey);
    if (entry === undefined) return undefined;
    // Guard against cross-project cache hits if the same session somehow sees
    // multiple projects (should not happen in Phase 7, but be defensive).
    if (entry.projectPath !== projectPath) return undefined;

    try {
      return JSON.parse(entry.valueJson) as unknown;
    } catch {
      // Corrupt entry — ignore it.
      return undefined;
    }
  }

  /**
   * Store a tool result.
   *
   * If an active entry for the same key already exists it is invalidated before
   * the new entry is written, so findByKey always returns the latest value.
   *
   * @param sessionId   Active session ULID.
   * @param projectPath Absolute project root path.
   * @param cacheType   Tool name namespace e.g. "tool:read".
   * @param cacheKey    Deterministic key from normalised input parameters.
   * @param value       Serialisable result to cache.
   * @param sourceHash  Optional file mtime/hash for future invalidation support.
   * @param metadata    Optional extra metadata stored as JSON.
   */
  set(
    sessionId: string,
    projectPath: string,
    cacheType: string,
    cacheKey: string,
    value: unknown,
    sourceHash?: string,
    metadata?: Record<string, unknown>,
  ): void {
    // Invalidate any existing live entry for this key.
    const existing = this.repo.findByKey(sessionId, cacheType, cacheKey);
    if (existing !== undefined) {
      this.repo.invalidate(existing.id);
    }

    this.repo.create({
      id: ulid(),
      sessionId,
      projectPath,
      cacheType,
      cacheKey,
      valueJson: JSON.stringify(value),
      sourceHash: sourceHash ?? null,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      invalidatedAt: null,
      metadataJson: metadata !== undefined ? JSON.stringify(metadata) : null,
    });
  }

  /**
   * Explicitly invalidate a cache entry by its storage row ID.
   * Used by Phase 9 file-mutation hooks once they are implemented.
   */
  invalidateById(id: string): void {
    this.repo.invalidate(id);
  }

  /**
   * Invalidate all active session cache entries that reference the mutated
   * file path.
   *
   * Phase 9 conservative approach: invalidates ALL non-expired entries for the
   * session when a mutation occurs, because grep/glob cache keys embed patterns
   * rather than explicit paths and cannot be reliably matched. This ensures
   * cache correctness at the cost of slightly more re-fetching.
   *
   * Fine-grained path-based invalidation is deferred (see CACHE-005).
   *
   * @param sessionId   Active session ULID.
   * @param projectPath Absolute project root path.
   * @param _mutatedPath  Absolute path of the file that was mutated (reserved
   *                    for future fine-grained invalidation).
   */
  invalidateAffectedByPath(
    sessionId: string,
    projectPath: string,
    _mutatedPath: string,
  ): void {
    const active = this.repo.listActiveBySession(sessionId);
    for (const entry of active) {
      // Guard against cross-project hits (defensive; should never occur).
      if (entry.projectPath !== projectPath) continue;
      this.repo.invalidate(entry.id);
    }
  }
}
