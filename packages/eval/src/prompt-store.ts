// Version-controlled prompt library — shared prompt templates with git-backed history
//
// Templates are stored as `.prompt.md` files with YAML frontmatter.
// Bundled templates ship with the package under `prompts/library/`.
// User templates live in `~/.agent-workbench/prompts/library/` and override
// bundled templates of the same id. All user modifications are git-versioned.

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface PromptVersion {
  /** Semantic version string */
  version: string;
  /** The prompt content */
  content: string;
  /** When this version was created */
  createdAt: string;
  /** Git commit hash for this version */
  gitCommit?: string;
  /** Changelog entry */
  changelog: string;
}

export interface PromptTemplate {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this prompt is for */
  description: string;
  /** Current content with {{variable}} placeholders */
  content: string;
  /** Version history */
  versions: PromptVersion[];
  /** Current version string */
  currentVersion: string;
  /** Category tag */
  category: "code-review" | "refactor" | "explain" | "test-gen" | "custom";
}

/** Frontmatter parsed from a .prompt.md file */
interface PromptFrontmatter {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
}

/**
 * Version-controlled prompt library stored in ~/.agent-workbench/prompts/library/
 * as `.prompt.md` files, with git-backed version history.
 *
 * Bundled templates ship with the package under `prompts/library/` and
 * are seeded into the user directory on first access. User modifications
 * override bundled templates of the same id.
 */
export class PromptStore {
  private userDir: string;
  private bundledDir: string;

  constructor(userDir?: string) {
    this.userDir = resolve(
      userDir || join(homedir(), ".agent-workbench", "prompts", "library"),
    );
    // Bundled templates: one level above the compiled output (or source dir)
    this.bundledDir = join(import.meta.dirname!, "..", "prompts", "library");
  }

  /** List all available prompt templates (bundled + user) */
  async list(): Promise<PromptTemplate[]> {
    // Ensure user directory exists
    if (!existsSync(this.userDir)) {
      mkdirSync(this.userDir, { recursive: true });
    }

    // Seed bundled templates into user dir on first use
    this.seedBundledTemplates();

    const templates: PromptTemplate[] = [];
    const files = readdirSync(this.userDir).filter((f) =>
      f.endsWith(".prompt.md"),
    );

    for (const file of files) {
      const tmpl = this.parseFile(join(this.userDir, file));
      if (tmpl) templates.push(tmpl);
    }

    return templates;
  }

  /** Get a prompt template by id */
  async get(id: string): Promise<PromptTemplate | undefined> {
    // Ensure user dir exists and is seeded
    if (!existsSync(this.userDir)) {
      mkdirSync(this.userDir, { recursive: true });
    }
    this.seedBundledTemplates();

    const filePath = join(this.userDir, `${id}.prompt.md`);
    if (!existsSync(filePath)) return undefined;
    return this.parseFile(filePath);
  }

  /** Create or update a prompt template */
  async save(template: PromptTemplate): Promise<void> {
    if (!existsSync(this.userDir)) {
      mkdirSync(this.userDir, { recursive: true });
    }

    const filePath = join(this.userDir, `${template.id}.prompt.md`);
    const content = this.serialize(template);
    writeFileSync(filePath, content, "utf-8");

    // Git commit the change
    try {
      execSync("git init", { cwd: this.userDir, stdio: "ignore" });
      execSync(`git add "${template.id}.prompt.md"`, {
        cwd: this.userDir,
        stdio: "ignore",
      });
      execSync(
        `git commit -m "prompt: update ${template.id} to v${template.currentVersion}"`,
        { cwd: this.userDir, stdio: "ignore" },
      );
    } catch {
      // Git not available — best-effort versioning
    }
  }

  /** Render a template by substituting {{variable}} placeholders */
  render(template: PromptTemplate, variables: Record<string, string>): string {
    let result = template.content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"),
        value,
      );
    }
    return result;
  }

  /** Get git history for a prompt template */
  async history(id: string): Promise<PromptVersion[]> {
    const filePath = join(this.userDir, `${id}.prompt.md`);
    if (!existsSync(filePath)) return [];

    try {
      const log = execSync(
        `git log --format="%H|%ai|%s" -- "${id}.prompt.md"`,
        { cwd: this.userDir, encoding: "utf-8" },
      );

      return log
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, date, ...msgParts] = line.split("|");
          return {
            version: hash!.slice(0, 7),
            content: "",
            createdAt: date || "",
            gitCommit: hash,
            changelog: msgParts.join("|") || "",
          } as PromptVersion;
        });
    } catch {
      return [];
    }
  }

  /** Seed bundled templates into the user directory on first access */
  private seedBundledTemplates(): void {
    if (!existsSync(this.bundledDir)) return;

    const bundledFiles = readdirSync(this.bundledDir).filter((f) =>
      f.endsWith(".prompt.md"),
    );
    for (const file of bundledFiles) {
      const destPath = join(this.userDir, file);
      if (!existsSync(destPath)) {
        try {
          cpSync(join(this.bundledDir, file), destPath);
        } catch {
          // Best-effort
        }
      }
    }
  }

  /** Parse a .prompt.md file into a PromptTemplate */
  private parseFile(filePath: string): PromptTemplate | undefined {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const frontmatter = this.parseFrontmatter(raw);

      if (!frontmatter) return undefined;

      const body = this.extractBody(raw);

      return {
        id: frontmatter.id,
        name: frontmatter.name,
        description: frontmatter.description,
        content: body,
        versions: [
          {
            version: frontmatter.version,
            content: body,
            createdAt: new Date().toISOString(),
            changelog: "Initial version",
          },
        ],
        currentVersion: frontmatter.version,
        category: frontmatter.category as PromptTemplate["category"],
      };
    } catch {
      return undefined;
    }
  }

  /** Parse YAML frontmatter from a .prompt.md file */
  private parseFrontmatter(raw: string): PromptFrontmatter | undefined {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return undefined;

    const yaml = match[1]!;
    const lines = yaml.split("\n");
    const result: Record<string, string> = {};

    for (const line of lines) {
      const kv = line.match(/^(\w+):\s*(.+)$/);
      if (kv) {
        result[kv[1]!] = kv[2]!.trim();
      }
    }

    if (!result.id || !result.name) return undefined;

    return {
      id: result.id,
      name: result.name,
      description: result.description || "",
      version: result.version || "1.0.0",
      category: result.category || "custom",
    };
  }

  /** Extract the body content after frontmatter */
  private extractBody(raw: string): string {
    const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    return match ? match[1]!.trim() : raw.trim();
  }

  /** Serialize a template back to .prompt.md format */
  private serialize(template: PromptTemplate): string {
    const frontmatter = [
      "---",
      `id: ${template.id}`,
      `name: ${template.name}`,
      `description: ${template.description}`,
      `version: ${template.currentVersion}`,
      `category: ${template.category}`,
      "---",
      "",
    ].join("\n");

    return frontmatter + template.content;
  }
}
