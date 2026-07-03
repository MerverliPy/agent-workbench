import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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
export function copyFixtureProject(
  prefix = "agent-wb-fixture-",
): FixtureProject {
  const fixturesDir = resolve(
    import.meta.dirname,
    "../fixtures/sample-project",
  );
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

export interface SymlinkEscapeFixture {
  projectPath: string;
  externalTarget: string;
  symlinkPath: string | null;
  symlinked: boolean;
  cleanup: () => void;
}

/**
 * Create a temp fixture that contains a symlink pointing outside the fixture
 * root to an external temp target. Used for symlink escape security tests.
 *
 * The external target is a separate temp file outside the fixture root.
 * The symlink lives inside the fixture root.
 *
 * Returns undefined if symlink creation is unsupported on this platform.
 */
export function createSymlinkEscapeFixture(prefix = "agent-wb-sym-") {
  const projectDir = mkdtempSync(join(tmpdir(), prefix));
  const externalDir = mkdtempSync(join(tmpdir(), `${prefix}ext-`));
  const externalTarget = join(externalDir, "external.txt");
  writeFileSync(externalTarget, "DO NOT TOUCH\n");

  const symlinkName = "escape-link";
  const symlinkPath = join(projectDir, symlinkName);

  let symlinked = false;
  try {
    symlinkSync(externalTarget, symlinkPath);
    symlinked = true;
  } catch {
    // Symlinks unsupported on this platform — caller should skip tests.
    symlinked = false;
  }

  return {
    projectPath: projectDir,
    externalTarget,
    symlinkPath: symlinked ? symlinkPath : null,
    symlinked,
    cleanup: () => {
      try {
        rmSync(projectDir, { recursive: true, force: true });
      } catch {}
      try {
        rmSync(externalDir, { recursive: true, force: true });
      } catch {}
    },
  };
}
