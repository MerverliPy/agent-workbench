# agent-workbench-github

GitHub integration plugin for agent-workbench. Adds tools for browsing issues, PRs, searching code, and managing repositories — all from within the agent-workbench TUI.

## Tools

| Tool | Description | Risk | Requires Token? |
|------|-------------|------|----------------|
| `github.list_issues` | List issues for a repo, filterable by state and labels | Low | No (unauthed rate limit) |
| `github.search_code` | Search code across GitHub repositories | Low | No (unauthed rate limit) |
| `github.get_pr` | Get PR details with diff stats and description | Low | No (unauthed rate limit) |
| `github.list_repos` | List repositories for a user or organization | Low | No (unauthed rate limit) |
| `github.create_issue` | Create a new issue on a repository | **High** | Yes |

## Setup

### 1. Install the plugin

```bash
cd agent-workbench
agent-workbench plugin install local:./plugins/agent-workbench-github
agent-workbench plugin enable agent-workbench-github
```

### 2. Set your GitHub token (optional — for unauthenticated requests)

```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

Without a token, GitHub API calls are rate-limited to 60 requests/hour. With a token, you get 5,000 requests/hour.

### 3. Restart the server

```bash
cd apps/server && bun run start
```

The plugin's tools are now available in the agent runtime. The permission engine will gate `github.create_issue` as a high-risk mutation — you'll need to approve it.

## Development

```bash
# Edit the plugin source
vim plugins/agent-workbench-github/src/tools.ts

# The plugin is loaded from its install location, so after changes:
agent-workbench plugin disable agent-workbench-github
agent-workbench plugin enable agent-workbench-github
# Then restart the server
```

## Architecture

This plugin demonstrates the full plugin SDK contract:

- **`plugin.json`** declares name, version, tools, and required permissions
- **`src/tools.ts`** exports a default `ToolPlugin` object with an array of `PluginTool` definitions
- Each tool defines `name`, `description`, `parameters` (JSON Schema for model consumption), `isMutation`, `riskLevel`, and an `execute` function
- Network access is declared in `permissions.network: true`
