/**
 * Path safety utilities for read-only tools.
 *
 * All tools must call assertSafePath() before accessing the filesystem.
 * Sensitive-path matching uses simple pattern tests rather than a full
 * permission engine (which arrives in Phase 8).
 */

import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

// ---------------------------------------------------------------------------
// Sensitive path patterns (provisional — Phase 8 will make these configurable)
// ---------------------------------------------------------------------------

/**
 * Simple filename / path segment checks for common sensitive file patterns.
 *
 * The list is checked against both the relative path and the bare filename
 * because patterns like "id_rsa" can appear at any depth.
 */
const SENSITIVE_FILENAME_EXACT = new Set([
  ".env",
  "id_rsa",
  "id_ecdsa",
  "id_ed25519",
  "credentials.json",
  "credentials",
]);

const SENSITIVE_FILENAME_PREFIXES = [".env."];

const SENSITIVE_FILENAME_SUFFIXES = [
  ".pem",
  ".key",
  ".p12",
  ".pfx",
];

const SENSITIVE_PATH_SEGMENTS = new Set([
  ".ssh",
  "secrets",
]);

/**
 * Directory patterns that must be treated as sensitive regardless of depth.
 * Checked against each segment of the path.
 */
const SENSITIVE_PATH_CONTAINS = [".aws/credentials"];

/**
 * Service-account JSON files.
 * Matched as: filename starts with "service-account" and ends with ".json".
 */
function isServiceAccountJson(filename: string): boolean {
  return (
    filename.startsWith("service-account") && filename.endsWith(".json")
  );
}

/**
 * Returns true if the given relative path (relative to project root) or bare
 * filename matches any sensitive path rule.
 *
 * @param relPath  Path relative to project root, using forward slashes.
 */
export function isSensitivePath(relPath: string): boolean {
  // Normalise to forward slashes for consistent matching.
  const normalised = relPath.replace(/\\/g, "/");
  const filename = path.basename(normalised);

  // Exact filename match.
  if (SENSITIVE_FILENAME_EXACT.has(filename)) return true;

  // Prefix match.
  for (const prefix of SENSITIVE_FILENAME_PREFIXES) {
    if (filename.startsWith(prefix)) return true;
  }

  // Suffix match.
  for (const suffix of SENSITIVE_FILENAME_SUFFIXES) {
    if (filename.endsWith(suffix)) return true;
  }

  // Service-account JSON.
  if (isServiceAccountJson(filename)) return true;

  // Sensitive directory segments in any component of the path.
  const parts = normalised.split("/");
  for (const part of parts) {
    if (SENSITIVE_PATH_SEGMENTS.has(part)) return true;
  }

  // Composite path patterns (e.g. ".aws/credentials").
  for (const composite of SENSITIVE_PATH_CONTAINS) {
    if (normalised.includes(composite)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Path resolution and containment check
// ---------------------------------------------------------------------------

/**
 * Resolve and validate a user-supplied path against the project root.
 *
 * Returns the resolved **absolute** path.
 *
 * Throws PathGuardError if:
 *  - The resolved path escapes the project root (including via symlinks).
 *  - The path matches a sensitive file pattern.
 */
export function assertSafePath(
  filePath: string,
  projectRoot: string
): string {
  const normalizedRoot = path.resolve(projectRoot);

  // Resolve the target path relative to the project root.
  const resolved = path.resolve(normalizedRoot, filePath);

  // --- Containment check (pre-realpath) ---
  if (!isUnderRoot(resolved, normalizedRoot)) {
    throw new PathGuardError(
      `Path escapes project root. Provided: "${filePath}"`
    );
  }

  // --- Realpath check for existing paths (symlink resolution) ---
  let finalPath = resolved;
  try {
    finalPath = fs.realpathSync(resolved);

    // Re-check containment after symlink resolution.
    const realRoot = fs.realpathSync(normalizedRoot);
    if (!isUnderRoot(finalPath, realRoot)) {
      throw new PathGuardError(
        `Path resolves outside project root via symlink. Provided: "${filePath}"`
      );
    }
  } catch (err: unknown) {
    if (err instanceof PathGuardError) throw err;
    // File does not exist yet or realpath is unavailable — use the pre-resolved
    // path and rely on the containment check above.
    finalPath = resolved;
  }

  // --- Sensitive path check ---
  const relPath = path.relative(normalizedRoot, finalPath);
  if (isSensitivePath(relPath) || isSensitivePath(path.basename(finalPath))) {
    throw new PathGuardError(
      `Access to sensitive path denied. Provided: "${filePath}"`
    );
  }

  return finalPath;
}

/**
 * Convert an absolute path back to a project-relative path.
 * Uses forward slashes for consistent cross-platform representation.
 */
export function toRelativePath(absPath: string, projectRoot: string): string {
  return path.relative(path.resolve(projectRoot), absPath).replace(/\\/g, "/");
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if `target` is equal to `root` or is a descendant of `root`.
 */
function isUnderRoot(target: string, root: string): boolean {
  const sep = path.sep;
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  return target === root || target.startsWith(rootWithSep);
}
