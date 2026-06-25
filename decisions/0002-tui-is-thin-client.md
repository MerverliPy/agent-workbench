# 0002 — TUI Is a Thin Client

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The system includes a terminal UI, local server, core runtime, tools, permissions, and storage. Safety depends on keeping execution authority outside the frontend.

## Decision

The TUI must be a thin client. It may render state, collect input, and call the local server through the SDK. It must not execute privileged operations.

## Rationale

A thin TUI keeps safety controls centralized in backend runtime layers. It also makes the system extensible to future web, desktop, or automation clients without duplicating core agent logic.

## Consequences

### Positive

```text
[+] TUI can be replaced by another client.
[+] Permissions remain backend-authoritative.
[+] File and shell operations are controlled.
[+] Session truth remains durable and auditable.
```

### Negative / Tradeoffs

```text
[-] Requires more upfront server/SDK design.
[-] Some UI interactions require backend round trips.
[-] Offline UI behavior is limited without server state.
```

## Implementation Rules

```text
[ ] TUI may call SDK methods.
[ ] TUI may subscribe to SSE events.
[ ] TUI may render permission prompts and diffs.
[ ] TUI must not run shell commands.
[ ] TUI must not write files.
[ ] TUI must not call model providers directly.
[ ] TUI must not evaluate permission policy.
[ ] TUI must not access SQLite directly.
```

## Boundaries

Allowed future TUI imports:

```text
packages/sdk
packages/protocol
packages/events
packages/ui
```

Forbidden future TUI imports:

```text
packages/tools
packages/shell
packages/storage
packages/permissions/internal
packages/models/internal
packages/core/internal
```

## Risks

```text
[ ] UI convenience may tempt direct tool execution.
[ ] Command palette may accidentally become an execution path.
[ ] Permission prompts could become cosmetic if backend gating is weak.
```

## Validation Checklist

```text
[ ] TUI has no direct tool imports.
[ ] TUI has no shell execution.
[ ] TUI has no direct file mutation.
[ ] TUI has no direct storage access.
```

## Notes for Future Agents

Preserve this boundary even if implementation pressure suggests faster direct calls.
