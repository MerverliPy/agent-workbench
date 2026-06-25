# @agent-workbench/tui

Status: Phase 4 — TUI Shell
Implementation status: OpenTUI + SolidJS chat-first shell

## Purpose

Terminal UI client. Owns rendering and user input only.

Thin client — all agent logic, storage, permissions, tools, models, and shell
execution live in the server/core layers. The TUI communicates exclusively
through `@agent-workbench/sdk`.

## How to Run

### Prerequisites

The local server must be running before starting the TUI:

```bash
# Terminal 1 — start the server
cd apps/server
bun run start
```

### Start the TUI

```bash
# Terminal 2 — start the TUI
cd apps/tui
bun run start
```

### Development (auto-reload on file change)

```bash
cd apps/tui
bun run dev
```

### Type-check

```bash
cd apps/tui
bun run typecheck
```

## Key Bindings

| Key         | Action                      |
|-------------|----------------------------|
| `Enter`     | Insert newline in prompt    |
| `Ctrl+Enter`| Submit prompt to server     |
| `Ctrl+P`    | Open/close command palette  |
| `Escape`    | Close command palette       |
| `Ctrl+C`    | Exit TUI                    |

## Server Dependency

The TUI connects to the local server at `http://localhost:3000` (hardcoded in
Phase 4). If the server is not running:

- The status bar shows `server: error` or `server: disconnected`
- A notice appears in the message timeline
- Prompt submission will fail gracefully with an error notice

## Phase 4 Boundaries

The TUI in Phase 4:

**Does:**
- Render the chat-first layout (header / session sidebar / message timeline /
  prompt editor / status bar)
- Connect to server via `sdk.health.check()` on startup
- Subscribe to SSE events via `sdk.events.connect()`
- Route SSE events to local display state (messages, permission count)
- Submit prompts via `sdk.messages.submit()`
- Show a command palette (Ctrl+P) with utility commands
- Show placeholder panels for permission modal, diff viewer, run ledger, and
  token health

**Does not:**
- Execute tools
- Read or write files directly
- Run shell commands
- Call model providers
- Evaluate permission policy
- Access SQLite/storage directly
- Implement real diff logic
- Calculate token health
- Import forbidden packages (core, tools, shell, storage, permissions, models,
  diff, tokens, cache, planner)

## Known 501 Placeholder Behavior

Phase 3 server placeholder routes return `HTTP 501 NOT_IMPLEMENTED`. The TUI
handles these gracefully:

| Server route              | TUI behavior                                       |
|---------------------------|---------------------------------------------------|
| `POST /session`           | Session sidebar shows "unavailable (Phase 5)"      |
| `GET /session`            | `/sessions` palette command shows 501 notice       |
| `POST /session/:id/message` | Timeline shows "Runtime not implemented yet" notice |
| All other session/tool/etc. routes | Graceful error notice in timeline         |

These are expected behaviors, not bugs. The core runtime connects in Phase 6.

## File Structure

```
apps/tui/src/
├── index.tsx                          — Entry: render(<App />)
├── App.tsx                            — Root component; SDK lifecycle; global keys
├── lib/
│   └── sdk.ts                         — WorkbenchClient singleton + SERVER_BASE_URL
├── state/
│   └── app.ts                         — Ephemeral SolidJS signals (display state only)
└── components/
    ├── layout/
    │   ├── AppLayout.tsx              — Root column-flex layout
    │   └── Header.tsx                 — 1-line header row
    ├── session/
    │   └── SessionSidebar.tsx         — Session list (Phase 4: placeholder session)
    ├── messages/
    │   └── MessageTimeline.tsx        — Scrollable message list
    ├── prompt/
    │   └── PromptEditor.tsx           — Textarea prompt input + submit
    ├── status/
    │   └── StatusBar.tsx              — 1-line connection/run status
    ├── palette/
    │   └── CommandPalette.tsx         — Ctrl+P command palette overlay
    └── panels/
        ├── PermissionModal.tsx        — Placeholder (Phase 8)
        ├── DiffViewer.tsx             — Placeholder (Phase 9)
        ├── LedgerPanel.tsx            — Placeholder (Phase 6)
        └── TokenHealthPanel.tsx       — Placeholder (Phase 12)
```

## Boundary

Refer to:

- `docs/03_BACKEND_FRONTEND_BOUNDARY.md`
- `docs/18_PHASE_EXIT_GATES.md`
- `docs/21_PACKAGE_OWNERSHIP.md`
