# @agent-workbench/mobile-web

Progressive Web App companion for agent-workbench. Provides a mobile-optimized interface for monitoring and interacting with agent sessions from iOS and Android devices.

## Usage

```bash
cd apps/mobile-web && bun run dev
# PWA available at http://localhost:8788

# Or serve from the main server (production)
cd apps/server && bun run start
# PWA served at http://localhost:8787/mobile
```

## Features

- **Session viewer**: Browse and interact with agent sessions
- **Real-time SSE**: Live streaming of agent responses
- **PWA support**: Installable on iOS and Android with offline support
- **Multiple panels**: Chat, Files, Permissions, Providers, Settings, Git Tree, Activity Log
- **Theme support**: Dark, light, and system-follow modes
- **Touch-optimized**: Mobile-first responsive design

## Scope

- Mobile-optimized session viewer
- Real-time SSE streaming
- PWA with offline support and installability
- Touch-optimized panels
- Theme persistence (dark/light/system)

Part of **Phase 18** (mobile web companion UI).
