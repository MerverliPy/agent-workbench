/**
 * e2e-skill-metrics.ts — Benchmark: POM generation efficiency
 *
 * Analyzes the playwright-e2e-testing SKILL.md to measure:
 *   1. Total inline code blocks representing real files
 *   2. Total lines of production code (excluding comments, blank lines)
 *   3. Distinct page objects: fully implemented vs stubbed (architecture-only)
 *   4. Ready-to-run ratio: % of described files with executable code
 *
 * Run via:   bun run benchmarks/e2e-skill-metrics.ts
 * Output:    benchmarks/e2e-skill-metrics.json + stdout summary
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── Cross-runtime __dirname ─────────────────────────────────────────────────
const scriptDir = (() => {
  try {
    return import.meta.dirname;
  } catch {
    /* not Bun */
  }
  return dirname(fileURLToPath(import.meta.url));
})();

const ROOT = resolve(scriptDir, "..");
const SKILL_PATH = resolve(
  process.env.HOME ?? "/home/calvin",
  ".hermes/skills/software-development/playwright-e2e-testing/SKILL.md",
);
const OUTPUT_PATH = resolve(scriptDir, "e2e-skill-metrics.json");

// ── Types ───────────────────────────────────────────────────────────────────

interface CodeBlock {
  filePath: string;
  language: string;
  content: string;
  startLine: number;
}

interface FileMetrics {
  filePath: string;
  language: string;
  totalLines: number;
  codeLines: number;
  commentLines: number;
  blankLines: number;
  hasCode: boolean;
  isPom: boolean;
  isSpec: boolean;
  isUtil: boolean;
  isFixture: boolean;
  isConfig: boolean;
}

interface PomInfo {
  name: string;
  filePath: string;
  implemented: boolean;
  methods: string[];
  extendsClass: string | null;
}

interface DescribedFile {
  filePath: string;
  hasCode: boolean;
  category: "page" | "spec" | "util" | "fixture" | "config" | "ci" | "other";
}

interface SkillMetrics {
  meta: {
    skillName: string;
    skillVersion: string;
    analyzedAt: string;
    skillPath: string;
  };
  files: {
    totalDescribed: number;
    totalWithCode: number;
    readyToRunRatio: number;
    architectureOnly: number;
    breakdown: Record<string, { described: number; withCode: number }>;
  };
  linesOfCode: {
    totalProductionCode: number;
    totalLines: number;
    commentLines: number;
    blankLines: number;
    byCategory: Record<string, { codeLines: number; totalLines: number }>;
  };
  pageObjects: {
    fullyImplemented: string[];
    fullyImplementedCount: number;
    stubbed: string[];
    stubbedCount: number;
  };
  fileDetails: FileMetrics[];
}

// ── Fenced code block parser ────────────────────────────────────────────────

/** Parse SKILL.md into all fenced code blocks with language and content. */
function parseAllCodeBlocks(
  markdown: string,
): { language: string; content: string; startLine: number }[] {
  const blocks: { language: string; content: string; startLine: number }[] = [];
  const lines = markdown.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^```(\w*)\s*$/);
    if (m) {
      const language = m[1] || "text";
      const startLine = i + 1;
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        contentLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ language, content: contentLines.join("\n"), startLine });
    } else {
      i++;
    }
  }
  return blocks;
}

// ── Architecture tree parsing ───────────────────────────────────────────────

/**
 * Parse architecture tree code blocks to extract all described file paths.
 * The trees are inside untagged fenced code blocks in the "## Architecture" section.
 * We reconstruct full paths by tracking directory context.
 */
function parseArchitectureFiles(markdown: string): DescribedFile[] {
  const result: DescribedFile[] = [];
  const lines = markdown.split("\n");

  // Find the "## Architecture" section boundaries
  let archStart = -1;
  let archEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "## Architecture") {
      archStart = i;
      // Find next ## heading
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith("## ") && !lines[j].startsWith("### ")) {
          archEnd = j;
          break;
        }
      }
      break;
    }
  }

  if (archStart === -1) return result;

  // Within the architecture section, find untagged fenced code blocks (tree diagrams)
  let inTreeBlock = false;
  let treeBasePath = "";
  const pathStack: string[] = [];

  for (let i = archStart; i < archEnd; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // Detect start of untagged code block (tree diagram)
    if (trimmed === "```" && !inTreeBlock) {
      inTreeBlock = true;
      pathStack.length = 0;
      treeBasePath = "";
      continue;
    }

    // Detect end of tree block
    if (trimmed === "```" && inTreeBlock) {
      inTreeBlock = false;
      continue;
    }

    if (!inTreeBlock) continue;

    // Detect base path (first non-blank line in tree block)
    if (treeBasePath === "" && trimmed !== "") {
      // e.g., "apps/<app>/e2e/" or "e2e/"
      treeBasePath = trimmed.replace(/\/+$/, "");
      // Strip trailing comment after #
      const hashIdx = treeBasePath.indexOf(" #");
      if (hashIdx > 0) treeBasePath = treeBasePath.substring(0, hashIdx).trim();
      continue;
    }

    // Parse tree node lines — they use box-drawing characters
    // ├── filename.ext  # comment
    // └── filename.ext  # comment
    // │   ├── filename.ext  # comment
    const nodeMatch = trimmed.match(/[├└]\s*──\s+(.+)/);
    if (nodeMatch) {
      const rawName = nodeMatch[1].trim().split(/\s+#/)[0].trim();

      // Calculate indent (count leading tree chars: │, spaces, etc)
      const leading = trimmed.match(/^[│\s]*/)?.[0] ?? "";
      // Each level is approx 4 chars (│   ├── or     ├──)
      const indentLevel = Math.floor(leading.length / 4);

      // Trim pathStack to current indent
      while (pathStack.length > indentLevel) pathStack.pop();

      if (rawName.endsWith("/")) {
        // It's a directory — push to stack
        pathStack.push(rawName.replace(/\/$/, ""));
      } else if (rawName.match(/\.\w+$/)) {
        // It's a file — build full path
        const dirParts = [treeBasePath, ...pathStack];
        const dirPath = dirParts.join("/");
        const fullPath = `${dirPath}/${rawName}`;
        const resolved = fullPath.replace("apps/<app>/", "apps/mobile-web/");

        result.push({
          filePath: resolved,
          hasCode: false,
          category: categorizeFile(resolved),
        });
      }
    }
  }

  return result;
}

function categorizeFile(fullPath: string): DescribedFile["category"] {
  if (fullPath.includes("/pages/")) return "page";
  if (fullPath.includes("/specs/")) return "spec";
  if (fullPath.includes("/utils/")) return "util";
  if (fullPath.includes("/fixtures/")) return "fixture";
  if (
    fullPath.includes("playwright.config") ||
    fullPath.includes("playwright.base")
  )
    return "config";
  if (fullPath.endsWith(".yml") || fullPath.endsWith(".yaml")) return "ci";
  return "other";
}

// ── File-path extraction from code blocks ───────────────────────────────────

function extractFilePath(block: {
  language: string;
  content: string;
}): string | null {
  const firstLine = block.content.split("\n")[0]?.trim() ?? "";

  // TS/JS: // path/to/file.ts
  const tsMatch = firstLine.match(/^\/\/\s+(.+)$/);
  if (tsMatch) {
    const p = tsMatch[1].trim();
    if (p.match(/^[\w.\-/]+\.[\w.]+$/)) return p;
  }

  // YAML/Shell/Python: # path/to/file
  const hashMatch = firstLine.match(/^#\s+(.+)$/);
  if (hashMatch) {
    const p = hashMatch[1].trim();
    if (p.match(/^[\w.\-/]+\.[\w.]+$/)) return p;
  }

  return null;
}

// ── Code / comment line counting ────────────────────────────────────────────

function countLoc(code: string, language: string) {
  const lines = code.split("\n");
  let codeLines = 0,
    commentLines = 0,
    blankLines = 0,
    inBlockComment = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      blankLines++;
      continue;
    }

    if (["typescript", "ts", "javascript", "js"].includes(language)) {
      if (inBlockComment) {
        commentLines++;
        if (line.includes("*/")) inBlockComment = false;
        continue;
      }
      // Skip JSDoc-style /** ... */ blocks on one line
      if (/^\/\*\*.*\*\/$/.test(line)) {
        commentLines++;
        continue;
      }
      if (line.startsWith("/*")) {
        commentLines++;
        if (!line.includes("*/")) inBlockComment = true;
        continue;
      }
      if (line.startsWith("//")) {
        commentLines++;
        continue;
      }
      codeLines++;
    } else if (["yaml", "yml", "bash", "sh"].includes(language)) {
      if (line.startsWith("#")) {
        commentLines++;
        continue;
      }
      codeLines++;
    } else {
      codeLines++;
    }
  }

  return { totalLines: lines.length, codeLines, commentLines, blankLines };
}

// ── Page Object detection ───────────────────────────────────────────────────

function detectPageObject(block: CodeBlock): PomInfo | null {
  if (!["typescript", "ts"].includes(block.language)) return null;
  const content = block.content;

  const classMatch = content.match(
    /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)\s*(?:extends\s+(\w+))?/,
  );
  if (!classMatch) return null;

  const className = classMatch[1];
  const extendsClass = classMatch[2] ?? null;

  const methodRe = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/g;
  const methods: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = methodRe.exec(content)) !== null) {
    const name = m[1];
    if (name !== "constructor" && !methods.includes(name)) methods.push(name);
  }

  return {
    name: className,
    filePath: block.filePath,
    implemented: methods.length > 0 || className === "BasePage", // BasePage is implemented even if abstract
    methods,
    extendsClass,
  };
}

// ── Main analysis ───────────────────────────────────────────────────────────

function analyze(): SkillMetrics {
  const markdown = readFileSync(SKILL_PATH, "utf-8");

  // Extract version
  const versionMatch = markdown.match(/^version:\s*(.+)$/m);
  const skillVersion = versionMatch?.[1]?.trim() ?? "unknown";

  // Parse architecture tree for all described files
  const describedFiles = parseArchitectureFiles(markdown);

  // Parse all fenced code blocks
  const allBlocks = parseAllCodeBlocks(markdown);

  // Identify code blocks that represent real files (have a filename comment)
  const fileBlocks: CodeBlock[] = [];
  for (const block of allBlocks) {
    const fp = extractFilePath(block);
    if (fp) fileBlocks.push({ ...block, filePath: fp });
  }

  // Match code blocks against described files
  for (const df of describedFiles) {
    const dfBasename = df.filePath.split("/").pop()!;
    df.hasCode = fileBlocks.some((fb) => {
      const fbBasename = fb.filePath.split("/").pop()!;
      return fbBasename === dfBasename || fb.filePath === df.filePath;
    });
  }

  // Calculate file metrics for each code block
  const fileMetrics: FileMetrics[] = fileBlocks.map((block) => {
    const counts = countLoc(block.content, block.language);
    return {
      filePath: block.filePath,
      language: block.language,
      totalLines: counts.totalLines,
      codeLines: counts.codeLines,
      commentLines: counts.commentLines,
      blankLines: counts.blankLines,
      hasCode: counts.codeLines > 0,
      isPom: block.filePath.includes("/pages/"),
      isSpec: block.filePath.includes("/specs/"),
      isUtil: block.filePath.includes("/utils/"),
      isFixture: block.filePath.includes("/fixtures/"),
      isConfig:
        block.filePath.includes("config") ||
        block.filePath.includes("playwright.config"),
    };
  });

  // Detect page objects from code blocks
  const pomInfos: PomInfo[] = fileBlocks
    .filter((b) => b.filePath.includes("/pages/"))
    .map((b) => detectPageObject(b))
    .filter((p): p is PomInfo => p !== null);

  // Find stubbed page objects (in architecture but no code)
  const stubbedPoms: string[] = [];
  for (const df of describedFiles) {
    if (df.category === "page" && !df.hasCode) {
      const pageName =
        df.filePath
          .split("/")
          .pop()
          ?.replace(/\.ts$/, "")
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join("") ?? df.filePath;
      if (
        !stubbedPoms.includes(pageName) &&
        !pomInfos.some((p) => p.name === pageName)
      ) {
        stubbedPoms.push(pageName);
      }
    }
  }

  // ── Aggregation ──────────────────────────────────────────────────────────
  const totalDescribed = describedFiles.length;
  const totalWithCode = describedFiles.filter((f) => f.hasCode).length;
  const readyToRunRatio =
    totalDescribed > 0 ? totalWithCode / totalDescribed : 0;

  const totalProductionCode = fileMetrics.reduce(
    (s, fm) => s + fm.codeLines,
    0,
  );
  const totalAllLines = fileMetrics.reduce((s, fm) => s + fm.totalLines, 0);
  const totalCommentLines = fileMetrics.reduce(
    (s, fm) => s + fm.commentLines,
    0,
  );
  const totalBlankLines = fileMetrics.reduce((s, fm) => s + fm.blankLines, 0);

  // Breakdown by category
  const categories = [
    "page",
    "spec",
    "util",
    "fixture",
    "config",
    "ci",
  ] as const;
  const breakdown: Record<string, { described: number; withCode: number }> = {};
  for (const cat of categories) {
    const described = describedFiles.filter((f) => f.category === cat);
    breakdown[cat] = {
      described: described.length,
      withCode: described.filter((f) => f.hasCode).length,
    };
  }

  // LOC by category
  const locByCategory: Record<
    string,
    { codeLines: number; totalLines: number }
  > = {};
  for (const fm of fileMetrics) {
    let cat = "other";
    if (fm.isPom) cat = "pages";
    else if (fm.isSpec) cat = "specs";
    else if (fm.isUtil) cat = "utils";
    else if (fm.isFixture) cat = "fixtures";
    else if (fm.isConfig) cat = "configs";
    else if (fm.filePath.endsWith(".yml") || fm.filePath.endsWith(".yaml"))
      cat = "ci";

    if (!locByCategory[cat])
      locByCategory[cat] = { codeLines: 0, totalLines: 0 };
    locByCategory[cat].codeLines += fm.codeLines;
    locByCategory[cat].totalLines += fm.totalLines;
  }

  return {
    meta: {
      skillName: "playwright-e2e-testing",
      skillVersion,
      analyzedAt: new Date().toISOString(),
      skillPath: SKILL_PATH,
    },
    files: {
      totalDescribed,
      totalWithCode,
      readyToRunRatio: Math.round(readyToRunRatio * 10000) / 100,
      architectureOnly: totalDescribed - totalWithCode,
      breakdown,
    },
    linesOfCode: {
      totalProductionCode,
      totalLines: totalAllLines,
      commentLines: totalCommentLines,
      blankLines: totalBlankLines,
      byCategory: locByCategory,
    },
    pageObjects: {
      fullyImplemented: pomInfos
        .filter((p) => p.implemented)
        .map((p) => p.name),
      fullyImplementedCount: pomInfos.filter((p) => p.implemented).length,
      stubbed: stubbedPoms,
      stubbedCount: stubbedPoms.length,
    },
    fileDetails: fileMetrics,
  };
}

// ── Run ─────────────────────────────────────────────────────────────────────
const metrics = analyze();
mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(metrics, null, 2));

// ── Summary ─────────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════");
console.log("  E2E Skill Benchmark — POM Generation Efficiency");
console.log("═══════════════════════════════════════════════════════");
console.log(
  `\n  Skill:          ${metrics.meta.skillName} v${metrics.meta.skillVersion}`,
);
console.log(`  Analyzed at:    ${metrics.meta.analyzedAt}`);
console.log("\n───────────────────────────────────────────────────────");
console.log("  FILE COVERAGE");
console.log("───────────────────────────────────────────────────────");
console.log(`  Total files described:       ${metrics.files.totalDescribed}`);
console.log(`  Total with executable code:  ${metrics.files.totalWithCode}`);
console.log(`  Ready-to-run ratio:          ${metrics.files.readyToRunRatio}%`);
console.log(`  Architecture-only (stubs):   ${metrics.files.architectureOnly}`);
for (const [cat, bd] of Object.entries(metrics.files.breakdown)) {
  console.log(
    `  ${cat.padEnd(10)} ${String(bd.withCode).padStart(2)}/${String(bd.described).padStart(2)} with code`,
  );
}
console.log("\n───────────────────────────────────────────────────────");
console.log("  LINES OF CODE");
console.log("───────────────────────────────────────────────────────");
console.log(`  Total lines (raw):           ${metrics.linesOfCode.totalLines}`);
console.log(
  `  Production code lines:       ${metrics.linesOfCode.totalProductionCode}`,
);
console.log(
  `  Comment lines:               ${metrics.linesOfCode.commentLines}`,
);
console.log(`  Blank lines:                 ${metrics.linesOfCode.blankLines}`);
for (const [cat, loc] of Object.entries(metrics.linesOfCode.byCategory)) {
  console.log(
    `  ${cat.padEnd(10)} ${String(loc.codeLines).padStart(5)} code lines`,
  );
}
console.log("\n───────────────────────────────────────────────────────");
console.log("  PAGE OBJECTS");
console.log("───────────────────────────────────────────────────────");
console.log(
  `  Fully implemented:  ${metrics.pageObjects.fullyImplementedCount} (${metrics.pageObjects.fullyImplemented.join(", ")})`,
);
console.log(
  `  Stubbed only:       ${metrics.pageObjects.stubbedCount} (${metrics.pageObjects.stubbed.join(", ") || "none"})`,
);
console.log(`\n───────────────────────────────────────────────────────`);
console.log(`  Output saved to: ${OUTPUT_PATH}`);
console.log("═══════════════════════════════════════════════════════");

// JSON export
console.log(
  "\n" +
    JSON.stringify({
      total_files_described: metrics.files.totalDescribed,
      total_with_code: metrics.files.totalWithCode,
      ready_to_run_pct: metrics.files.readyToRunRatio,
      total_lines_of_production_code: metrics.linesOfCode.totalProductionCode,
      page_objects_implemented: metrics.pageObjects.fullyImplementedCount,
      page_objects_stubbed: metrics.pageObjects.stubbedCount,
      file_breakdown: metrics.files.breakdown,
      loc_breakdown: metrics.linesOfCode.byCategory,
    }),
);
