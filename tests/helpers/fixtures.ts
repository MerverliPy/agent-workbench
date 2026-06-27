import { mkdirSync, readdirSync, statSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

export interface FixtureProject {
  /** Absolute path to the copied fixture project directory. */
  projectPath: string;
  /** Remove the temporary project directory (best-effort). */
  cleanup: () => void;
}

/**
 * Copy the sample fixture project into a fresh temp directory for isolated
 * test use.
 *
 * The source fixture lives at `tests/fixtures/sample-project/`. The copy
 * preserves nested files and leaves the source fixture untouched.
 */
export function copyFixtureProject(prefix = "agent-wb-fixture-"): FixtureProject {
  const fixturesDir = resolve(import.meta.dirname, "../fixtures/sample-project");
  const destDir = mkdtempSync(join(tmpdir(), prefix));

  copyDirRecursive(fixturesDir, destDir);

  return {
    projectPath: destDir,
    cleanup: () => {
      try {
        rmSync(destDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    },
  };
}

function copyDirRecursive(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
