# 08 — Data Model Plan

Status: ⚠️ Historical reference — content superseded by docs/27_PROJECT_ROADMAP.md and live code.  
Document type: agent-ready data model plan  
Scope: local persistence, SQLite/Drizzle tables, ledgers, retention, privacy, and data ownership

## 1. Purpose

This document defines the planned data model for `agent-workbench`.

The system must persist local state for sessions, messages, tool calls, permissions, run ledger events, file changes, summaries, config snapshots, and cache entries.

## 2. Confirmed Direction

Storage stack:

```text
SQLite + Drizzle
```

Persistence posture:

```text
local-first
full run ledger
no plaintext secrets by default
auditable risky actions
session history survives restart
```

## 3. Ownership

Future folder:

```text
packages/storage
```

`packages/storage` owns:

```text
SQLite database connection
Drizzle schema
migrations
repositories
query helpers
storage path policy
```

It must not own:

```text
agent runtime logic
permission policy decisions
TUI rendering
model provider calls
tool execution policy
```

## 4. Database Location

The exact database path is unresolved.

Recommended provisional policy:

```text
Use a user-local app data directory for global/session DB.
Allow project-specific DB location only if explicitly configured later.
```

Open question:

```text
Should sessions be global, per-project, or hybrid?
```

Recommended default:

```text
Hybrid: global index with project-scoped session metadata.
```

Needs confirmation during implementation.

## 5. Core Tables

Planned tables:

```text
sessions
messages
tool_calls
permission_requests
permission_decisions
run_ledger
file_changes
config_snapshots
summaries
cache_entries
provider_auth
```

`provider_auth` must not store plaintext secrets. It may store metadata or secret references only unless encrypted storage is explicitly confirmed.

## 6. Table: sessions

Purpose:

```text
Persist session identity and lifecycle metadata.
```

Provisional fields:

```text
id
project_path
title
active_agent
status
created_at
updated_at
last_run_at
metadata_json
```

Status examples:

```text
active
idle
aborted
archived
deleted
```

Exact status enum is unresolved.

## 7. Table: messages

Purpose:

```text
Persist user, assistant, system, tool, and summary messages.
```

Provisional fields:

```text
id
session_id
run_id
role
content
content_format
parent_message_id
created_at
metadata_json
token_count_estimate
```

Role examples:

```text
user
assistant
system
tool
summary
```

Exact content representation is unresolved.

## 8. Table: tool_calls

Purpose:

```text
Persist tool call requests, statuses, inputs, and outputs.
```

Provisional fields:

```text
id
session_id
run_id
message_id
tool_name
status
input_json
result_json
error_json
started_at
completed_at
metadata_json
```

Status examples:

```text
requested
permission_pending
running
completed
failed
denied
aborted
```

Exact status enum is unresolved.

## 9. Table: permission_requests

Purpose:

```text
Persist ask-gated permission requests.
```

Provisional fields:

```text
id
session_id
run_id
tool_call_id
agent_id
tool_name
risk_level
reason
target_paths_json
command
diff_summary_json
dry_run_summary_json
status
created_at
expires_at
metadata_json
```

## 10. Table: permission_decisions

Purpose:

```text
Persist approval or denial decisions.
```

Provisional fields:

```text
id
request_id
decision
decided_by
scope
reason
created_at
metadata_json
```

Decision values:

```text
allow
deny
```

Policy-level `ask` creates a request; user decision resolves as allow or deny.

## 11. Table: run_ledger

Purpose:

```text
Audit important runtime events.
```

Provisional fields:

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

Ledger event categories:

```text
model
tool
permission
diff
file
shell
token
cache
planner
session
server
```

Exact event taxonomy is unresolved.

## 12. Table: file_changes

Purpose:

```text
Persist file mutation metadata.
```

Provisional fields:

```text
id
session_id
run_id
tool_call_id
path
change_type
before_hash
after_hash
patch
dry_run_id
approved_by_permission_decision_id
created_at
metadata_json
```

Change types:

```text
create
modify
delete
rename
```

Exact snapshot strategy is unresolved.

## 13. Table: config_snapshots

Purpose:

```text
Record effective config at important run boundaries.
```

Provisional fields:

```text
id
session_id
run_id
config_hash
effective_config_json
redacted_config_json
created_at
```

Rules:

```text
[ ] Store redacted config.
[ ] Do not store resolved secret values.
[ ] Store secret references only.
```

## 14. Table: summaries

Purpose:

```text
Persist session, run, tool-result, and compaction summaries.
```

Provisional fields:

```text
id
session_id
run_id
summary_type
source_range_json
content
quality_status
created_at
metadata_json
```

Summary types:

```text
session
run
tool_result
compaction
handoff
```

Exact summary quality checks are unresolved.

## 15. Table: cache_entries

Purpose:

```text
Persist or temporarily store read/search cache entries.
```

Provisional fields:

```text
id
session_id
project_path
cache_type
cache_key
value_json
source_hash
created_at
expires_at
invalidated_at
metadata_json
```

Cache types:

```text
read
grep
glob
project_tree
vcs_status
```

Cache persistence policy is unresolved.

Recommended default:

```text
Session-scoped cache first.
```

## 16. Table: provider_auth

Purpose:

```text
Store provider auth metadata and secret references, not secret values.
```

Provisional fields:

```text
id
provider_id
auth_type
secret_reference
status
created_at
updated_at
metadata_json
```

Rules:

```text
[ ] Do not store raw API keys.
[ ] Do not write secrets to ledger.
[ ] Support environment-variable references first.
```

## 17. ID Strategy

Exact ID strategy is unresolved.

Recommended requirements:

```text
[ ] IDs must be stable.
[ ] IDs must be unique across local DB.
[ ] IDs must be safe to expose to TUI.
[ ] IDs must not encode secrets or local paths.
```

Candidate options:

```text
UUID
ULID
cuid-like IDs
SQLite integer internal IDs plus public IDs
```

Recommended default:

```text
Public string IDs using a sortable unique format, if supported by implementation.
```

Needs confirmation.

## 18. Migrations

Requirements:

```text
[ ] Migrations are required after Phase 5 begins.
[ ] Migrations must be deterministic.
[ ] Migration files must not exist in Phase 0.
[ ] Migration rollback policy is unresolved.
```

## 19. Privacy and Redaction

Storage must avoid preserving secrets accidentally.

Requirements:

```text
[ ] Redact provider keys.
[ ] Redact obvious secret values from command output where possible.
[ ] Avoid storing full oversized outputs unnecessarily.
[ ] Store summaries for large tool results.
[ ] Mark redaction status in ledger.
```

## 20. Retention Policy

Retention is unresolved.

Potential options:

```text
keep all local history
allow per-session deletion
allow project cleanup
allow age-based pruning
```

Recommended default:

```text
Keep local history until user deletes sessions.
```

Needs confirmation.

## 21. Repository Pattern

Future storage should expose repositories such as:

```text
sessionRepository
messageRepository
toolCallRepository
permissionRepository
ledgerRepository
fileChangeRepository
summaryRepository
cacheRepository
configSnapshotRepository
```

Core runtime should use repositories, not raw SQL directly.

## 22. Data Model Acceptance Criteria

Phase 5 is complete when:

```text
[ ] SQLite connection exists.
[ ] Drizzle schema exists.
[ ] Core tables exist.
[ ] Repositories exist.
[ ] Sessions persist.
[ ] Messages persist.
[ ] Tool calls persist.
[ ] Permission requests and decisions persist.
[ ] Run ledger persists.
[ ] Secrets are not stored in plaintext by default.
```

## 23. Anti-Patterns

Do not:

- Store plaintext provider API keys.
- Let TUI write directly to SQLite.
- Treat database schema as API schema.
- Store unlimited raw command output.
- Store secret-bearing `.env` content in ledger.
- Add migrations during Phase 0.
- Hide deletion/retention behavior.
- Use storage repositories to make permission decisions.

## 24. Open Questions

| ID | Question | Status |
|---|---|---|
| DATA-001 | Database path policy | Unresolved |
| DATA-002 | Global vs project-scoped sessions | Unresolved |
| DATA-003 | Exact ID format | Unresolved |
| DATA-004 | Exact table fields | Provisional |
| DATA-005 | Retention/deletion policy | Unresolved |
| DATA-006 | Migration rollback policy | Unresolved |
| DATA-007 | Cache persistence duration | Unresolved |
| DATA-008 | Encrypted secret storage | Needs confirmation |

## 25. Agent Instructions

Future agents must:

1. Implement storage only in Phase 5 or later.
2. Use Drizzle schema as storage definition, not API definition.
3. Keep secrets out of plaintext storage.
4. Use repositories from core.
5. Ledger risky operations.
6. Mark unresolved schema choices before finalizing migrations.

## 26. Validation Checklist

```text
[ ] Storage stack is clear.
[ ] Planned tables are listed.
[ ] Secret policy is documented.
[ ] Ledger persistence is documented.
[ ] Open questions are marked.
[ ] Phase 5 gate is explicit.
```
