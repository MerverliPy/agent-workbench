# 12 — TUI UX Model

Status: ⚠️ Historical reference — content superseded by docs/27_PROJECT_ROADMAP.md and live code.  
Document type: agent-ready TUI/UX model  
Scope: terminal UI layout, interaction model, panels, command palette, permissions, diffs, ledger, token health

## 1. Purpose

This document defines the planned terminal user experience for `agent-workbench`.

The TUI must be useful, responsive, and safe while remaining a thin client. It must render state and collect input, not own execution authority.

## 2. Confirmed Direction

TUI stack:

```text
OpenTUI + SolidJS
```

Initial layout:

```text
chat-first
```

Initial interaction model:

```text
keyboard + command palette
```

Required optimization panels:

```text
collapsible run ledger panel
token-health panel
```

## 3. TUI Ownership

Future folder:

```text
apps/tui
```

TUI owns:

```text
layout rendering
message timeline
prompt editor
status bar
session sidebar
command palette
permission modal rendering
diff viewer rendering
run ledger panel rendering
token-health panel rendering
keyboard bindings
ephemeral UI state
```

TUI must not own:

```text
tool execution
file mutation
shell execution
model calls
permission policy
storage repositories
core runtime state
```

## 4. Primary Layout

Initial layout should prioritize:

```text
message timeline
prompt input
status bar
```

Recommended first layout:

```text
┌──────────────────────────────────────────────┐
│ Header: project / session / agent / model    │
├──────────────┬───────────────────────────────┤
│ Sessions     │ Message timeline              │
│              │ Tool cards / assistant output │
│              │ Permission and diff previews  │
├──────────────┴───────────────────────────────┤
│ Prompt editor                                │
├──────────────────────────────────────────────┤
│ Status: server / agent / tokens / run state  │
└──────────────────────────────────────────────┘
```

Exact layout is provisional.

## 5. Message Timeline

The timeline should render:

```text
user messages
assistant messages
system messages
tool call cards
tool result summaries
permission events
diff previews
errors
streaming indicators
summary/compaction markers
```

Tool results should be collapsible when large.

## 6. Prompt Editor

The prompt editor should support:

```text
multi-line input
submit action
history navigation
command hints
pasted text preview
```

Advanced features such as pasted images/files are not confirmed for the first implementation.

## 7. Command Palette

The command palette should be available early.

Potential commands:

```text
/help
/sessions
/models
/agents
/permissions
/compact
/abort
/clear
/settings
```

Exact command list is unresolved.

Command palette commands must call SDK/server actions, not execute local privileged actions directly.

## 8. Session Sidebar

The session sidebar should show:

```text
session title
active session marker
last updated time
agent badge
run status
```

Session management actions are deferred until server/session APIs exist.

## 9. Status Bar

The status bar should show:

```text
server connection
active agent
active model
run status
permission pending count
token-health status
cache status if useful
```

Do not show secrets.

## 10. Permission Modal

Permission prompts must be explicit and informative.

The modal should show:

```text
tool name
risk level
reason
target path
command preview
diff summary
dry-run summary
approval option
deny option
scope if supported
```

The TUI must not compute risk level or policy decision. It displays backend-provided data.

## 11. Diff Viewer

The diff viewer should support:

```text
file path
change type
unified diff or structured diff
added/removed line counts
approval state
dry-run result
revert hint
```

Diff display is required before file mutation execution.

## 12. Run Ledger Panel

The run ledger panel is a confirmed optimization.

It should show:

```text
model calls
tool calls
permission requests
permission decisions
diff previews
file mutations
shell commands
token-health events
cache hits/misses
planner events
```

Recommended behavior:

```text
collapsible side or bottom panel
filter by category
jump to related message
show timestamps
```

Exact UI is unresolved.

## 13. Token-Health Panel

The token-health panel should show:

```text
health status
estimated context usage
remaining budget
largest contributors
truncated tool outputs
summary state
compaction suggestion
```

The TUI renders token-health data from backend events/state.

## 14. Agent Selector

Initial agents:

```text
Build
Plan
```

TUI should show:

```text
current agent
agent switch command
agent description
permission hints
```

Agent switching must go through server/core state.

## 15. Error UX

Errors should be:

```text
structured
recoverable when possible
linked to request/run/tool
visible in timeline or status panel
not leaking secrets
```

Examples:

```text
server disconnected
permission denied
tool failed
model provider error
command timed out
context budget critical
```

## 16. Keyboard Interaction

Initial interaction:

```text
keyboard + command palette
```

Exact keymap is unresolved.

Potential key groups:

```text
submit prompt
open command palette
navigate timeline
switch sessions
open ledger
open token panel
approve/deny modal
abort run
```

## 17. Mouse Interaction

Mouse support is not part of the first confirmed interaction model.

It may be added later, but keyboard support should work without mouse.

## 18. TUI State

TUI may keep ephemeral state:

```text
focused panel
input draft
scroll position
open modal
expanded/collapsed cards
selected command
```

TUI must not keep authoritative state for:

```text
session history
permission decisions
tool results
run status
file changes
token health
```

Authoritative state comes from server/core/storage.

## 19. Accessibility and Clarity

The TUI should avoid hiding risky information.

Requirements:

```text
[ ] Risky actions are visible.
[ ] Approval prompts are clear.
[ ] Denial is easy.
[ ] Run state is visible.
[ ] Token strain is visible.
[ ] Errors are not swallowed.
```

## 20. Acceptance Criteria

Phase 4 is complete when:

```text
[ ] TUI starts.
[ ] TUI connects to local server.
[ ] TUI renders chat-first layout.
[ ] TUI shows prompt input.
[ ] TUI subscribes to events.
[ ] TUI has command palette.
[ ] TUI has placeholder permission modal.
[ ] TUI has placeholder diff viewer.
[ ] TUI has placeholder ledger panel.
[ ] TUI has placeholder token-health panel.
[ ] TUI does not execute privileged actions.
```

## 21. Anti-Patterns

Do not:

- Put agent runtime in TUI.
- Let command palette execute shell directly.
- Let TUI write files.
- Hide permission details.
- Hide destructive command risk.
- Treat frontend state as source of truth.
- Build mouse-only flows.
- Overbuild IDE-like panes before core flows work.

## 22. Open Questions

| ID | Question | Status |
|---|---|---|
| TUI-001 | Exact layout | Provisional |
| TUI-002 | Exact keymap | Unresolved |
| TUI-003 | Theme system | Unresolved |
| TUI-004 | Mouse support timeline | Deferred |
| TUI-005 | Exact command palette commands | Provisional |
| TUI-006 | Pasted file/image support | Unresolved |

## 23. Agent Instructions

Future agents must:

1. Build the TUI shell before adding agent logic.
2. Keep TUI thin.
3. Use SDK for backend calls.
4. Render permission/diff/token/ledger data from backend events.
5. Avoid privileged local execution in frontend.
6. Mark unresolved UX details instead of inventing them.

## 24. Validation Checklist

```text
[ ] Chat-first layout is documented.
[ ] Command palette is documented.
[ ] Ledger panel is documented.
[ ] Token-health panel is documented.
[ ] TUI trust boundary is documented.
[ ] Open questions are marked.
```
