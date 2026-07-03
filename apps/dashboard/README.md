# 📊 @agent-workbench/dashboard

Web-based monitoring dashboard for the agent-workbench server. Provides real-time visibility into agent sessions, system metrics, and provider status via SSE-driven live updates.

## Usage

```bash
# Dashboard runs as part of the server
cd apps/server && bun run dev

# Dashboard available at http://localhost:8787/dashboard
```

## Features

- **Session monitoring**: View active sessions, message counts, and duration
- **System metrics**: CPU, memory, and request throughput
- **Provider status**: Health checks for all configured model providers
- **Live updates**: SSE-based real-time data streaming

## Architecture

Built with SolidJS + Tailwind CSS. Consumes the typed SDK (`@agent-workbench/sdk`) to connect to the local server. All data flows through SSE event streams — no polling.

## Development

```bash
cd apps/dashboard && bun run dev     # Dev server with hot reload
cd apps/dashboard && bun run build   # Production build
cd apps/dashboard && bun run typecheck
```

Part of **Phase 25** (observability & production readiness).
