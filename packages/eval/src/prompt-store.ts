// Version-controlled prompt library — shared prompt templates with git-backed history

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

/**
 * Version-controlled prompt library stored in ~/.agent-workbench/prompts/library/
 * as `.prompt.md` files, with git-backed version history.
 */
export class PromptStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || "~/.agent-workbench/prompts/library";
  }

  /** List all available prompt templates */
  async list(): Promise<PromptTemplate[]> {
    // TODO Phase 29: scan ~/.agent-workbench/prompts/library/*.prompt.md
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  /** Get a prompt template by id */
  async get(id: string): Promise<PromptTemplate | undefined> {
    // TODO Phase 29: read and parse .prompt.md file
    void id;
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  /** Create or update a prompt template */
  async save(template: PromptTemplate): Promise<void> {
    // TODO Phase 29: write .prompt.md with frontmatter, git commit
    void template;
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }

  /** Render a template by substituting variables */
  render(template: PromptTemplate, variables: Record<string, string>): string {
    let result = template.content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
    }
    return result;
  }

  /** Get git history for a prompt template */
  async history(id: string): Promise<PromptVersion[]> {
    // TODO Phase 29: git log for the specific .prompt.md file
    void id;
    throw new Error("Not yet implemented — Phase 29 scaffolding");
  }
}
