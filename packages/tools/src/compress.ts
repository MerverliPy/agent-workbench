/**
 * Result compression and truncation utilities for read-only tools.
 *
 * Phase 7 provisional limits — these are named constants so they can be
 * adjusted without touching tool logic. See TOOL-003 in docs/10_TOOL_RUNTIME_MODEL.md.
 */

// ---------------------------------------------------------------------------
// Limits (provisional — confirm before Phase 8 if user feedback requires tuning)
// ---------------------------------------------------------------------------

/** Maximum lines returned by the read tool in a single call. */
export const READ_MAX_LINES = 2000;

/** Maximum matches returned by the grep tool in a single call. */
export const GREP_MAX_MATCHES = 200;

/** Maximum paths returned by the glob tool in a single call. */
export const GLOB_MAX_PATHS = 1000;

/** Maximum length of a single grep excerpt (characters). */
export const GREP_EXCERPT_MAX_CHARS = 300;

// ---------------------------------------------------------------------------
// Line truncation (used by read)
// ---------------------------------------------------------------------------

export interface LineTruncationMeta {
  truncated: boolean;
  totalLines: number;
  returnedLines: number;
}

/**
 * Slice `lines` starting at `offset` (0-based) up to `maxLines`.
 *
 * @param lines      Array of text lines from a file.
 * @param maxLines   Maximum number of lines to return.
 * @param offset     Zero-based start index (default 0).
 */
export function truncateLines(
  lines: string[],
  maxLines: number,
  offset: number = 0
): { content: string; meta: LineTruncationMeta } {
  const total = lines.length;
  const available = Math.max(0, total - offset);
  const willTruncate = available > maxLines;
  const slice = lines.slice(offset, offset + maxLines);

  return {
    content: slice.join("\n"),
    meta: {
      truncated: willTruncate,
      totalLines: total,
      returnedLines: slice.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Item truncation (used by grep matches and glob paths)
// ---------------------------------------------------------------------------

export interface ItemTruncationMeta {
  truncated: boolean;
  totalItems: number;
  returnedItems: number;
}

/**
 * Truncate an array of items to at most `max` entries.
 *
 * @param items  Full array.
 * @param max    Maximum number of items to return.
 */
export function truncateItems<T>(
  items: T[],
  max: number
): { items: T[]; meta: ItemTruncationMeta } {
  const total = items.length;
  const slice = items.slice(0, max);

  return {
    items: slice,
    meta: {
      truncated: total > max,
      totalItems: total,
      returnedItems: slice.length,
    },
  };
}
