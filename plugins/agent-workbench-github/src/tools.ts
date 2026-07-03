/**
 * GitHub Integration Plugin — Tools
 *
 * Provides tools for interacting with the GitHub REST API.
 * Requires GITHUB_TOKEN environment variable for authenticated requests.
 *
 * Each tool follows the PluginTool interface from @agent-workbench/plugin-sdk.
 */

// ── Types (matching @agent-workbench/plugin-sdk's PluginTool interface) ─────

interface PluginToolResult {
  readonly content: string;
  readonly data?: Record<string, unknown>;
  readonly success: boolean;
  readonly error?: string;
}

// ── Shared helpers ─────────────────────────────────────────────────────────

const GITHUB_API = "https://api.github.com";

/**
 * Get the GitHub token from environment.
 * Falls back to empty string for unauthenticated requests (rate-limited).
 */
function getToken(): string {
  return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
}

/** Create headers for GitHub API requests. */
function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "agent-workbench-github-plugin/1.0.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Parse a GitHub API response, handling errors and rate limiting. */
async function handleResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  if (response.status === 204) return { success: true, message: "No content" };

  // Rate limit info
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const reset = response.headers.get("X-RateLimit-Reset");
  const rateInfo =
    remaining !== null
      ? ` (${remaining} requests remaining${reset ? `, resets at ${new Date(Number(reset) * 1000).toISOString()}` : ""})`
      : "";

  if (!response.ok) {
    const body = await response.text().catch(() => "unknown error");
    return {
      success: false,
      error: `GitHub API ${response.status}: ${body}${rateInfo}`,
    };
  }

  const json = await response.json();
  return {
    success: true,
    data: json as Record<string, unknown>,
    rateLimit: rateInfo.trim() || undefined,
  };
}

/** Build a GitHub owner/repo from context or prompt. */
function parseRepo(
  repo?: string,
): { owner: string; repo: string } | { error: string } {
  if (!repo) {
    return {
      error:
        "Repository is required. Format: owner/repo (e.g. 'MerverliPy/agent-workbench')",
    };
  }
  const parts = repo.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { error: `Invalid repo format: "${repo}". Expected "owner/repo".` };
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

// ── Tool definitions ────────────────────────────────────────────────────────

export const tools = [
  // ── github.list_issues ─────────────────────────────────────────────────
  {
    name: "github.list_issues",
    description:
      "List issues for a GitHub repository. Can filter by state (open/closed) and labels.",
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Repository in owner/repo format (e.g. 'MerverliPy/agent-workbench')",
        },
        state: {
          type: "string",
          description:
            "Issue state filter: 'open' (default), 'closed', or 'all'",
          enum: ["open", "closed", "all"],
        },
        labels: {
          type: "string",
          description: "Comma-separated list of label names to filter by",
        },
        limit: {
          type: "number",
          description: "Maximum issues to return (default: 10, max: 100)",
        },
      },
      required: ["repo"],
    },
    isMutation: false,
    riskLevel: "low",
    async execute(input: Record<string, unknown>): Promise<PluginToolResult> {
      const repo = parseRepo(input.repo as string | undefined);
      if ("error" in repo) {
        return { content: repo.error, success: false, error: repo.error };
      }
      const state = (input.state as string) ?? "open";
      const labels = input.labels as string | undefined;
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 100);

      let url = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/issues?state=${state}&per_page=${limit}&sort=updated&direction=desc`;
      if (labels) url += `&labels=${encodeURIComponent(labels)}`;

      try {
        const response = await fetch(url, { headers: headers() });
        const result = await handleResponse(response);
        if (!result.success) {
          return {
            content: result.error ?? "GitHub API error",
            success: false,
            error: result.error,
          };
        }

        const issues = (result.data as Array<Record<string, unknown>>) ?? [];
        // Filter out PRs (GitHub returns PRs in the issues endpoint)
        const actualIssues = issues.filter(
          (i: Record<string, unknown>) => !i.pull_request,
        );

        if (actualIssues.length === 0) {
          return {
            content: `No ${state} issues found for ${repo.owner}/${repo.repo}.`,
            success: true,
          };
        }

        const lines = actualIssues.map((i: Record<string, unknown>) => {
          const num = i.number as number;
          const title = i.title as string;
          const user = (i.user as Record<string, unknown>)?.login ?? "unknown";
          const created = (i.created_at as string)?.slice(0, 10) ?? "unknown";
          const labelsArr = (i.labels as Array<Record<string, unknown>>) ?? [];
          const labelStr = labelsArr.map((l) => `[${l.name}]`).join(" ");
          return `  #${num}  ${title}  (@${user}, ${created})${labelStr ? ` ${labelStr}` : ""}`;
        });

        const content = `Issues for ${repo.owner}/${repo.repo} (state: ${state}):\n\n${lines.join("\n")}`;
        return {
          content,
          success: true,
          data: { count: actualIssues.length, issues: actualIssues },
        };
      } catch (err) {
        const msg = `Network error calling GitHub API: ${err instanceof Error ? err.message : String(err)}`;
        return { content: msg, success: false, error: msg };
      }
    },
  },

  // ── github.search_code ─────────────────────────────────────────────────
  {
    name: "github.search_code",
    description:
      "Search code across GitHub repositories. Uses GitHub's code search syntax (e.g. 'repo:owner/name query').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query. Can include repo:owner/name, language:js, path:/src, etc.",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 5, max: 30)",
        },
      },
      required: ["query"],
    },
    isMutation: false,
    riskLevel: "low",
    async execute(input: Record<string, unknown>): Promise<PluginToolResult> {
      const query = input.query as string | undefined;
      if (!query || query.trim().length === 0) {
        return {
          content: "Search query is required.",
          success: false,
          error: "Search query is required",
        };
      }
      const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 30);

      try {
        const url = `${GITHUB_API}/search/code?q=${encodeURIComponent(query)}&per_page=${limit}`;
        const response = await fetch(url, { headers: headers() });
        const result = await handleResponse(response);
        if (!result.success) {
          return {
            content: result.error ?? "GitHub API error",
            success: false,
            error: result.error,
          };
        }

        const items =
          ((result.data as Record<string, unknown>)?.items as Array<
            Record<string, unknown>
          >) ?? [];
        const total =
          (result.data as Record<string, unknown>)?.total_count ?? 0;

        if (items.length === 0) {
          return {
            content: `No code results found for "${query}".`,
            success: true,
          };
        }

        const lines = items.map((item: Record<string, unknown>) => {
          const _name = item.name as string;
          const path = item.path as string;
          const repoName =
            (item.repository as Record<string, unknown>)?.full_name ??
            "unknown";
          return `  📄 ${path}  (${repoName})`;
        });

        const content = `Code search results for "${query}" (${total} total):\n\n${lines.join("\n")}`;
        return { content, success: true, data: { total, items } };
      } catch (err) {
        const msg = `Network error calling GitHub API: ${err instanceof Error ? err.message : String(err)}`;
        return { content: msg, success: false, error: msg };
      }
    },
  },

  // ── github.get_pr ──────────────────────────────────────────────────────
  {
    name: "github.get_pr",
    description:
      "Get details of a specific pull request, including the diff summary.",
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Repository in owner/repo format (e.g. 'MerverliPy/agent-workbench')",
        },
        number: {
          type: "number",
          description: "Pull request number",
        },
      },
      required: ["repo", "number"],
    },
    isMutation: false,
    riskLevel: "low",
    async execute(input: Record<string, unknown>): Promise<PluginToolResult> {
      const repo = parseRepo(input.repo as string | undefined);
      if ("error" in repo) {
        return { content: repo.error, success: false, error: repo.error };
      }
      const prNumber = Number(input.number);
      if (!prNumber || prNumber < 1) {
        return {
          content: "A valid PR number is required.",
          success: false,
          error: "Invalid PR number",
        };
      }

      try {
        // Get PR details
        const prUrl = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/pulls/${prNumber}`;
        const prResponse = await fetch(prUrl, { headers: headers() });
        const prResult = await handleResponse(prResponse);
        if (!prResult.success) {
          return {
            content: prResult.error ?? "GitHub API error",
            success: false,
            error: prResult.error,
          };
        }

        const pr = prResult.data as Record<string, unknown>;
        const title = pr.title as string;
        const state = pr.state as string;
        const user = (pr.user as Record<string, unknown>)?.login ?? "unknown";
        const body = (pr.body as string) ?? "(no description)";
        const created = (pr.created_at as string)?.slice(0, 10) ?? "unknown";
        const merged = pr.merged_at as string | null;
        const commits = pr.commits as number;
        const additions = pr.additions as number;
        const deletions = pr.deletions as number;
        const changedFiles = pr.changed_files as number;
        const headRef = (pr.head as Record<string, unknown>)?.ref as string;
        const baseRef = (pr.base as Record<string, unknown>)?.ref as string;

        const content = [
          `PR #${prNumber}: ${title}`,
          `  State: ${state === "open" ? "🟢 Open" : merged ? "✅ Merged" : "🔴 Closed"}`,
          `  Author: @${user}  |  Created: ${created}`,
          `  Branch: ${headRef} → ${baseRef}`,
          `  Stats: +${additions}/-${deletions} across ${changedFiles} files (${commits} commits)`,
          ``,
          `Description:`,
          body.length > 500 ? `${body.slice(0, 500)}...` : body,
        ].join("\n");

        return { content, success: true, data: { pr } };
      } catch (err) {
        const msg = `Network error calling GitHub API: ${err instanceof Error ? err.message : String(err)}`;
        return { content: msg, success: false, error: msg };
      }
    },
  },

  // ── github.create_issue ────────────────────────────────────────────────
  {
    name: "github.create_issue",
    description:
      "Create a new issue on a GitHub repository. Requires GITHUB_TOKEN to be set.",
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Repository in owner/repo format (e.g. 'MerverliPy/agent-workbench')",
        },
        title: {
          type: "string",
          description: "Issue title",
        },
        body: {
          type: "string",
          description:
            "Issue body / description (optional, markdown supported)",
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Labels to apply to the issue",
        },
      },
      required: ["repo", "title"],
    },
    isMutation: true,
    riskLevel: "high",
    async execute(input: Record<string, unknown>): Promise<PluginToolResult> {
      const token = getToken();
      if (!token) {
        return {
          content:
            "GITHUB_TOKEN or GH_TOKEN environment variable is required to create issues.",
          success: false,
          error: "No GitHub token configured",
        };
      }

      const repo = parseRepo(input.repo as string | undefined);
      if ("error" in repo) {
        return { content: repo.error, success: false, error: repo.error };
      }
      const title = input.title as string | undefined;
      if (!title || title.trim().length === 0) {
        return {
          content: "Issue title is required.",
          success: false,
          error: "Issue title is required",
        };
      }
      const body = input.body as string | undefined;
      const labels = input.labels as string[] | undefined;

      try {
        const body_data: Record<string, unknown> = { title: title.trim() };
        if (body) body_data.body = body;
        if (labels && labels.length > 0) body_data.labels = labels;

        const url = `${GITHUB_API}/repos/${repo.owner}/${repo.repo}/issues`;
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify(body_data),
        });

        const result = await handleResponse(response);
        if (!result.success) {
          return {
            content: result.error ?? "GitHub API error",
            success: false,
            error: result.error,
          };
        }

        const issue = result.data as Record<string, unknown>;
        const issueUrl = issue.html_url as string;
        const issueNum = issue.number as number;

        return {
          content: `✅ Issue created: #${issueNum} — ${title.trim()}\n   ${issueUrl}`,
          success: true,
          data: { issueUrl, issueNumber: issueNum },
        };
      } catch (err) {
        const msg = `Network error calling GitHub API: ${err instanceof Error ? err.message : String(err)}`;
        return { content: msg, success: false, error: msg };
      }
    },
  },

  // ── github.list_repos ──────────────────────────────────────────────────
  {
    name: "github.list_repos",
    description:
      "List repositories for a user or organization. When authenticated, lists your repos; otherwise public repos for the given user.",
    parameters: {
      type: "object",
      properties: {
        owner: {
          type: "string",
          description:
            "User or organization name (e.g. 'MerverliPy'). Defaults to authenticated user if GITHUB_TOKEN is set.",
        },
        type: {
          type: "string",
          description:
            "Type of repos to list: 'all', 'owner', 'public', 'private', 'forks', 'sources', 'member' (default: 'owner')",
          enum: [
            "all",
            "owner",
            "public",
            "private",
            "forks",
            "sources",
            "member",
          ],
        },
        limit: {
          type: "number",
          description: "Maximum repos to return (default: 10, max: 50)",
        },
      },
      required: [],
    },
    isMutation: false,
    riskLevel: "low",
    async execute(input: Record<string, unknown>): Promise<PluginToolResult> {
      const owner = input.owner as string | undefined;
      const type = (input.type as string) ?? "owner";
      const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);

      const _token = getToken();
      const url = owner
        ? `${GITHUB_API}/users/${encodeURIComponent(owner)}/repos?type=${type}&per_page=${limit}&sort=updated&direction=desc`
        : `${GITHUB_API}/user/repos?type=${type}&per_page=${limit}&sort=updated&direction=desc`;

      try {
        const response = await fetch(url, { headers: headers() });
        const result = await handleResponse(response);
        if (!result.success) {
          return {
            content: result.error ?? "GitHub API error",
            success: false,
            error: result.error,
          };
        }

        const repos = (result.data as Array<Record<string, unknown>>) ?? [];
        if (repos.length === 0) {
          const who = owner ?? "your account";
          return {
            content: `No repositories found for ${who}.`,
            success: true,
          };
        }

        const lines = repos.map((r: Record<string, unknown>) => {
          const name = r.full_name as string;
          const desc = (r.description as string) ?? "";
          const stars = (r.stargazers_count as number) ?? 0;
          const lang = (r.language as string) ?? "";
          const priv = r.private ? "🔒" : "🌐";
          return `  ${priv} ${name}${desc ? ` — ${desc}` : ""}  ⭐${stars}${lang ? `  ${lang}` : ""}`;
        });

        return {
          content: `Repositories:\n\n${lines.join("\n")}`,
          success: true,
          data: { count: repos.length, repos },
        };
      } catch (err) {
        const msg = `Network error calling GitHub API: ${err instanceof Error ? err.message : String(err)}`;
        return { content: msg, success: false, error: msg };
      }
    },
  },
];

// ── Plugin entry point (ToolPlugin interface) ──────────────────────────────

export default {
  name: "agent-workbench-github",
  version: "1.0.0",
  tools,
};
