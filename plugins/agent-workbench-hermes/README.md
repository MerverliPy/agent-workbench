# agent-workbench-hermes

Hermes Agent Bridge Plugin — auto-discovers Hermes Agent's provider configuration and exposes each provider as an agent-workbench `PluginModelProvider`.

## What it does

- Reads **`~/.hermes/config.yaml`** for the provider chain (default + fallbacks)
- Reads **`~/.hermes/auth.json`** for API keys and base URLs
- Creates working model providers for **DeepSeek**, **Copilot**, and **opencode-go**
- Maps Hermes routing tiers to agent-workbench smart router tiers:
  - Default → cheapest (read/grep/glob/summarize)
  - Fallback[0] → mid-tier (code gen)
  - Fallback[1+] → strongest (architecture/review)
- No duplicated API keys — credentials come straight from Hermes

## Installation

```bash
cd agent-workbench
agent-workbench plugin install local:./plugins/agent-workbench-hermes
agent-workbench plugin enable agent-workbench-hermes
```

Then restart the server:

```bash
cd apps/server && bun run start
```

You should see log lines like:

```
[hermes-bridge] Loaded provider: hermes:deepseek (deepseek (Hermes — deepseek-v4-flash))
[hermes-bridge] Loaded provider: hermes:copilot (copilot (Hermes — kimi-k2.7-code))
[hermes-bridge] Loaded provider: hermes:opencode-go (opencode-go (Hermes — qwen3.7-plus))
```

## Provider IDs

| Provider ID | Model | Maps To |
|-------------|-------|---------|
| `hermes:deepseek` | deepseek-v4-flash | Smart router: cheapest tier |
| `hermes:copilot` | kimi-k2.7-code | Smart router: mid-tier |
| `hermes:opencode-go` | qwen3.7-plus | Smart router: strongest tier |

These provider IDs appear in the marketplace and can be selected in the Settings panel.

## Requirements

- **Hermes Agent** must be installed at `~/.hermes/` with a valid `config.yaml`
- **Environment variables** must be set for each provider's API key:
  - `DEEPSEEK_API_KEY`
  - `COPILOT_GITHUB_TOKEN`
  - `OPENCODE_GO_API_KEY`
- Plugin needs `filesystemRead: true` and `network: true` permissions

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| "no providers loaded" | ~/.hermes/config.yaml not found | Check Hermes is installed |
| "No API key found" | Env var not set | Check DEEPSEEK_API_KEY etc. |
| "API 401" | Token expired or wrong | Refresh GitHub token for Copilot |
| "Provider not visible in marketplace" | Plugin not enabled | `agent-workbench plugin enable agent-workbench-hermes` |

## Architecture

```
┌─────────────────────┐
│  ~/.hermes/         │
│  ├─ config.yaml     │──→ hermes-config.ts (parser)
│  └─ auth.json       │──→ credential reader
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Provider Factory   │──→ Maps each Hermes tier to an adapter
└─────────────────────┘
         │
         ├──→ OpenAIAdapter (deepseek, opencode-go)
         └──→ CopilotAdapter (copilot)
                 │
                 ▼
┌─────────────────────┐
│  agent-workbench    │
│  ProviderRegistry   │──→ Smart Router → Model calls
└─────────────────────┘
```
