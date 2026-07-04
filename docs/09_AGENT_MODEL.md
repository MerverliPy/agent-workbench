# 09 — Agent Model

Status: ⚠️ Historical reference — content superseded by docs/27_PROJECT_ROADMAP.md and live code.  
Document type: agent-ready agent model  
Scope: primary agents, permissions, prompts, lifecycle, selection, future subagents

## 1. Purpose

This document defines the planned agent model for `agent-workbench`.

The system must support controlled agent modes. Initial implementation must include only primary agents, starting with Build and Plan.

## 2. Confirmed Direction

Initial agents:

```text
Build
Plan
```

Initial subagents:

```text
none
```

Subagents must not be implemented in the first agent phase.

## 3. Ownership

Future folder:

```text
packages/core/src/agent
```

Agent model may also involve:

```text
packages/config
packages/permissions
apps/tui agent selector
packages/protocol agent schema
```

Agent definitions must not live only in the TUI.

## 4. Agent Definition

An agent definition should include, at minimum:

```text
id
name
description
mode
system prompt or prompt reference
default model preference
tool availability
permission profile
token budget hints
created/version metadata
```

Exact schema is deferred to `docs/07_API_CONTRACT_PLAN.md`.

## 5. Primary Agents

Primary agents are user-selectable modes that directly handle user prompts.

Initial primary agents:

```text
Build
Plan
```

Future primary agents may include:

```text
Explore
Review
Test
Summarize
```

These are not part of the initial confirmed implementation.

## 6. Build Agent

Purpose:

```text
Main implementation agent for coding tasks.
```

Expected capabilities:

```text
read project files
search project files
propose patches
request edits
request shell commands
run tests when approved/configured
maintain task progress
```

Default permissions:

```text
read: allow
grep: allow
glob: allow
edit/write/apply_patch: ask
bash: ask
destructive commands: deny
```

Build agent must not:

```text
bypass permission engine
apply patches without preview
run bash without permission check
hide risky operations from ledger
```

## 7. Plan Agent

Purpose:

```text
Planning, analysis, and implementation strategy before mutation.
```

Expected capabilities:

```text
read project files
search project files
create plans
evaluate architecture
identify risks
prepare implementation steps
```

Default permissions are provisional:

```text
read: allow
grep: allow
glob: allow
edit/write/apply_patch: deny or ask
bash: ask
destructive commands: deny
```

Recommended initial posture:

```text
Plan should not mutate files by default.
```

Needs confirmation during Phase 11.

## 8. Agent Selection

The TUI must eventually expose an agent selector.

Requirements:

```text
[ ] User can see current agent.
[ ] User can switch between Build and Plan.
[ ] Agent change is reflected in session state.
[ ] Agent changes are ledgered or recorded.
[ ] Agent permissions update when selected.
```

Agent selection must be sent to backend through SDK/server. TUI must not directly alter core runtime state.

## 9. Agent Permissions

Agent permissions are additive constraints over global/project/session policies.

Permission evaluation should consider:

```text
hard denies
session override
agent profile
project policy
global policy
default policy
```

Precedence is provisional and must be confirmed in permission/config design.

## 10. Agent Prompt Versioning

Agent prompts must be versioned.

Requirements:

```text
[ ] Prompt changes are explicit.
[ ] Prompt version is recorded in config snapshot or run metadata.
[ ] Sessions can identify which agent prompt version was used.
[ ] Prompt edits do not silently alter historical runs.
```

Exact prompt storage format is unresolved.

## 11. Agent Lifecycle

Planned lifecycle:

```text
registered
available
selected
running
idle
disabled
```

Runtime flow:

```text
1. User selects agent.
2. Session records active agent.
3. Prompt is submitted.
4. Core loads agent definition.
5. Context builder applies agent instructions.
6. Permission engine applies agent profile.
7. Model/tool loop runs.
8. Ledger records key agent/run events.
```

## 12. Subagents

Subagents are explicitly deferred.

Do not implement in initial agent phase:

```text
delegation
parallel subagent runs
subagent tool access
subagent summaries
@mention subagent dispatch
```

Future subagent design must include:

```text
parent/child permission inheritance
token budget controls
ledger events
tool constraints
abort behavior
```

## 13. Agent Context

Agent context should include:

```text
agent instructions
selected model
available tools
permission profile
session summary
project context
token budget
current user prompt
```

Context builder owns composition, not the TUI.

## 14. Agent Events

Planned event types are provisional:

```text
agent.selected
agent.run_started
agent.run_completed
agent.run_aborted
agent.permission_profile_applied
```

Exact event names are deferred to API/event contract design.

## 15. TUI Requirements

The TUI should eventually show:

```text
current agent badge
agent switcher
agent capabilities summary
agent permission hints
agent status during run
```

The TUI must not:

```text
define agent permissions authoritatively
modify prompt files directly
bypass server to switch runtime state
```

## 16. Acceptance Criteria

Phase 11 is complete when:

```text
[ ] Build agent exists.
[ ] Plan agent exists.
[ ] Agent definitions are versioned or version-ready.
[ ] TUI can select Build or Plan.
[ ] Core applies selected agent instructions.
[ ] Permission engine applies agent profile.
[ ] No subagents exist.
[ ] Agents cannot bypass permission policy.
```

## 17. Anti-Patterns

Do not:

- Implement subagents before primary agents are stable.
- Put agent definitions only in UI code.
- Let agent prompts change without versioning.
- Let Plan agent mutate files by default.
- Let Build agent execute shell without permission.
- Encode agent behavior only in informal docs without schema.
- Let model choose its own unrestricted tools.

## 18. Open Questions

| ID | Question | Status |
|---|---|---|
| AGENT-001 | Exact Build system prompt | Unresolved |
| AGENT-002 | Exact Plan system prompt | Unresolved |
| AGENT-003 | Prompt storage format | Unresolved |
| AGENT-004 | Agent permission precedence | Provisional |
| AGENT-005 | Whether Plan edit is deny or ask | Needs confirmation |
| AGENT-006 | Future subagent design | Deferred |

## 19. Agent Instructions

Future agents must:

1. Implement Build and Plan only in first agent phase.
2. Keep agent definitions outside TUI-only code.
3. Apply permissions per agent.
4. Version prompts or record prompt identity.
5. Do not add subagents until explicitly requested.
6. Mark prompt text as unresolved until written.

## 20. Validation Checklist

```text
[ ] Initial agents are documented.
[ ] Subagents are explicitly deferred.
[ ] Build capabilities are documented.
[ ] Plan capabilities are documented.
[ ] Agent permissions are documented.
[ ] Open questions are marked.
```
