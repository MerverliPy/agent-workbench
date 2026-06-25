/**
 * Shared options accepted by all file-mutation tool factories.
 *
 * These dependencies are captured in the factory closure so tool executors
 * can persist FileChange records and invalidate the read/search cache without
 * requiring changes to ToolExecutionContext.
 */

import type { FileChangeRepository } from "@agent-workbench/storage";
import type { ToolCache } from "@agent-workbench/cache";

export interface MutationToolOptions {
  /** Repository for persisting file change records (Phase 9 storage). */
  fileChangeRepository: FileChangeRepository;
  /** Optional session-scoped cache — invalidated after every successful mutation. */
  toolCache?: ToolCache;
}
