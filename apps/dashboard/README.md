# @agent-workbench/dashboard

Web-based monitoring dashboard for the agent-workbench server. Provides real-time visibility into agent sessions, system metrics, and provider status via SSE-driven live updates.

## Usage

```bash
# Dashboard runs as part of the server
cd apps/server && bun run dev

# Dashboard available at http://localhost:8787/dashboard
# Point your browser to the /dashboard route after starting the server
```

## Features

- **Session monitoring**: View active sessions, message counts, and duration
- **System metrics**: CPU, memory, and request throughput
- **Provider status**: Health checks for all configured model providers
- **Live updates**: SSE-based real-time data streaming

## Scope

- Real-time session monitoring
- System metrics visualization
- Provider status dashboard
- SSE-based live updates

Part of **Phase 25** (observability & production readiness).
