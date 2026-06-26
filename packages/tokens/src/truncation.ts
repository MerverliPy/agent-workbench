import type { TruncationMeta } from "./types";

const DEFAULT_MAX_RESULT_LENGTH = 20_000;

export interface TruncationOptions {
  maxResultLength?: number;
  preservePaths?: boolean;
}

export interface TruncatedResult {
  content: string;
  meta: TruncationMeta;
}

export function truncateToolOutput(
  raw: string,
  options: TruncationOptions = {}
): TruncatedResult {
  const maxLen = options.maxResultLength ?? DEFAULT_MAX_RESULT_LENGTH;

  if (raw.length <= maxLen) {
    return {
      content: raw,
      meta: {
        truncated: false,
        originalLength: raw.length,
        truncatedLength: raw.length,
        reason: "output_limit",
        preservedElements: [],
      },
    };
  }

  const preservedElements: string[] = [];

  if (options.preservePaths !== false) {
    const pathMatch = raw.match(/(?:\/[^\s]*|\S+\.\w+)/g);
    if (pathMatch !== null) {
      preservedElements.push("file_paths");
    }
  }

  const lineCount = raw.split("\n").length;
  const halfLength = Math.floor(maxLen / 2);
  const truncated =
    raw.slice(0, halfLength) +
    `\n\n[... omitted ${lineCount} total lines, ${raw.length - maxLen} chars ...]\n\n` +
    raw.slice(-halfLength);

  return {
    content: truncated,
    meta: {
      truncated: true,
      originalLength: raw.length,
      truncatedLength: truncated.length,
      reason: "output_limit",
      preservedElements: ["start_excerpt", "end_excerpt", "line_count", "match_count", ...preservedElements],
    },
  };
}
