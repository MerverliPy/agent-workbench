# 13 — Run Ledger Model

Status: ⚠️ Historical reference — content superseded by docs/27_PROJECT_ROADMAP.md and live code.  
Document type: agent-ready run ledger model  
Scope: audit events, categories, persistence, UI panel, redaction, query model

## 1. Purpose

This document defines the run ledger model for `agent-workbench`.

The run ledger is a required audit layer. It records meaningful runtime activity so users and developers can inspect what the agent did, what was approved, what was denied, what changed, and why.

## 2. Confirmed Direction

The run ledger must be:

```text
full
local-first
persisted
queryable
visible in TUI
redaction-aware
linked to sessions and runs
```

The TUI must include a collapsible run ledger panel.

## 3. Ownership

Future folders:

```text
packages/core/src/ledger
packages/storage/src/schema/run-ledger.table.ts
apps/tui/src/components/ledger
```

Ownership split:

```text
core: creates ledger events
storage: persists ledger events
events: streams ledger notifications
tui: renders ledger panel
```

The TUI must not be the source of truth for ledger events.

## 4. Ledger Scope

The ledger should record:

```text
model calls
tool calls
permission requests
permission decisions
diff previews
file mutations
shell commands
dry-run previews
token-health changes
compaction events
cache events
planner events
session lifecycle events
errors
```

## 5. Ledger Event Shape

Provisional event shape:

```text
id
session_id
run_id
event_type
event_category
actor
summary
payload_json
redaction_status
created_at
```

Exact schema is deferred to data model implementation.

## 6. Event Categories

Provisional categories:

```text
session
message
model
tool
permission
planner
diff
file
shell
token
cache
config
server
error
```

## 7. Required Ledger Events

### Session Events

```text
session.created
session.selected
session.title_updated
session.aborted
session.archived
session.deleted
```

Exact session deletion semantics are unresolved.

### Model Events

```text
model.call_started
model.call_completed
model.call_failed
model.usage_recorded
```

Must not store provider secrets.

### Tool Events

```text
tool.requested
tool.input_validated
tool.permission_pending
tool.started
tool.completed
tool.failed
tool.denied
tool.aborted
```

### Permission Events

```text
permission.requested
permission.decided
permission.denied
permission.expired
```

### Planner Events

```text
plan.created
plan.validated
plan.rejected
plan.approved_for_mutation
```

### Diff and File Events

```text
diff.preview_created
file.change_proposed
file.change_applied
file.change_reverted
file.change_failed
```

### Shell Events

```text
shell.command_requested
shell.command_risk_classified
shell.command_started
shell.output_chunk
shell.command_completed
shell.command_failed
shell.command_aborted
```

### Token Events

```text
token_health.updated
tool_result.truncated
compaction.suggested
compaction.started
compaction.completed
compaction.rejected
```

### Cache Events

```text
cache.hit
cache.miss
cache.invalidated
cache.bypassed
```

Event names are provisional.

## 8. Actors

Provisional actor values:

```text
user
agent
system
policy
tool
server
model
```

Actor should identify who or what caused the event.

## 9. Redaction

Ledger must be redaction-aware.

Redaction status values are provisional:

```text
none
partial
full
unknown
```

Requirements:

```text
[ ] Provider secrets must not be stored.
[ ] Sensitive file contents should be redacted or avoided.
[ ] Oversized command output should be truncated/summarized.
[ ] Redaction status must be visible when relevant.
```

## 10. Payload Policy

Ledger payloads should be useful but controlled.

Allowed examples:

```text
tool name
command summary
risk level
file path
diff metadata
token usage
cache key metadata
model provider id
error code
```

Risky payloads:

```text
full shell output
full sensitive file content
raw environment variables
provider API keys
private tokens
```

Risky payloads must be redacted, summarized, or omitted.

## 11. TUI Ledger Panel

The TUI ledger panel should support:

```text
collapse/expand
filter by category
show timestamps
show event summary
expand event details
jump to related message/tool/diff
show risk badges
show redaction status
```

Exact UI is unresolved.

## 12. Query Requirements

The system should eventually support querying ledger by:

```text
session id
run id
event category
event type
time range
tool name
risk level
actor
```

This is not required in first UI shell but should influence data model.

## 13. Relationship to Messages

Messages and ledger events are distinct.

Messages are conversational content.

Ledger events are operational audit records.

A tool call may appear in both:

```text
timeline card for user visibility
ledger record for auditability
```

Do not use chat messages as the only audit mechanism.

## 14. Relationship to Storage

Run ledger must be persisted locally in SQLite.

Storage requirements:

```text
[ ] Ledger table exists.
[ ] Ledger events link to session.
[ ] Ledger events link to run where applicable.
[ ] Ledger entries are append-oriented.
[ ] Ledger records preserve timestamps.
```

Update/delete policy is unresolved.

Recommended default:

```text
Append-only for normal operation.
Allow session deletion to remove associated ledger if user explicitly deletes session.
```

Needs confirmation.

## 15. Relationship to Events

Runtime event stream and ledger are related but not identical.

Some events are streamed but not persisted. Some ledger events are persisted and also streamed.

Rule:

```text
Risky or meaningful operations should be persisted.
Transient UI updates may be streamed only.
```

## 16. Acceptance Criteria

The ledger model is valid when:

```text
[ ] Ledger categories are defined.
[ ] Risky actions are ledgered.
[ ] Permission requests and decisions are ledgered.
[ ] File mutations are ledgered.
[ ] Shell commands are ledgered.
[ ] Token compaction is ledgered.
[ ] TUI ledger panel is planned.
[ ] Redaction requirements are documented.
```

## 17. Phase 5 / Runtime Requirements

Storage phase must create ledger persistence.

Runtime phase must write ledger entries for:

```text
session lifecycle
message/run lifecycle
model calls
tool calls
permission flow
errors
```

Later phases add file, shell, token, cache, and planner events.

## 18. Anti-Patterns

Do not:

- Use chat transcript as the only audit trail.
- Store raw secrets in ledger.
- Hide denied tool calls.
- Hide failed shell commands.
- Hide permission prompts after decision.
- Make ledger TUI-only and non-persistent.
- Allow runtime to mutate files without ledger entries.
- Treat event stream as durable storage.

## 19. Open Questions

| ID | Question | Status |
|---|---|---|
| LEDGER-001 | Exact event names | Provisional |
| LEDGER-002 | Exact payload schema per event | Unresolved |
| LEDGER-003 | Append-only policy | Provisional |
| LEDGER-004 | Session deletion effect on ledger | Unresolved |
| LEDGER-005 | Redaction implementation | Unresolved |
| LEDGER-006 | Ledger export format | Unresolved |

## 20. Agent Instructions

Future agents must:

1. Record ledger entries for every risky action.
2. Keep ledger separate from chat messages.
3. Redact secrets.
4. Persist ledger locally.
5. Stream useful ledger updates to TUI.
6. Do not omit denied or failed actions.
7. Mark event names provisional until protocol finalization.

## 21. Validation Checklist

```text
[ ] Ledger purpose is clear.
[ ] Event categories are documented.
[ ] Risky action coverage is documented.
[ ] Redaction is documented.
[ ] TUI panel requirements are documented.
[ ] Open questions are marked.
```
