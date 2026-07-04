# 07 — API Contract Plan

Status: ⚠️ Historical reference — content superseded by docs/27_PROJECT_ROADMAP.md and live code.  
Document type: agent-ready API contract plan  
Scope: schema-first API design, route groups, event stream, SDK contract, validation rules

## 1. Purpose

This document defines the planned API contract approach for `agent-workbench`.

The API contract must be designed before route implementation. The contract exists to keep the TUI, server, SDK, and core runtime aligned through shared schemas and stable request/response shapes.

## 2. Confirmed Direction

The API must be:

```text
schema-first
Zod-first
OpenAPI-generatable
SDK-consumable
server-validated
TUI-safe
event-stream-aware
```

Zod schemas are the source of truth. TypeScript interfaces alone are not sufficient.

## 3. Ownership

Future folder:

```text
packages/protocol
```

`packages/protocol` owns:

```text
Zod schemas
route contracts
event schemas
error envelope schemas
OpenAPI metadata
inferred shared types
```

It must not own:

```text
server handlers
database queries
core runtime behavior
tool execution
TUI state
permission policy evaluation
```

## 4. API Layer Model

```text
packages/protocol
  ↓
apps/server validates requests/responses
  ↓
packages/sdk consumes route contracts
  ↓
apps/tui uses SDK only
```

The TUI must never hand-roll request payloads when SDK methods exist.

## 5. Required API Groups

Planned route groups:

```text
/global
/session
/message
/config
/provider
/file
/permission
/tool
/tui
/auth
```

Exact route names are provisional until implementation.

## 6. Planned Route Groups

## 6.1 Global Routes

Purpose:

```text
health checks
server metadata
SSE event stream
```

Planned routes:

```text
GET /global/health
GET /global/event
GET /global/info
```

Required behavior:

```text
[ ] Health route must not require model provider config.
[ ] Event route must stream server/runtime events.
[ ] Info route must not expose secrets.
```

## 6.2 Session Routes

Purpose:

```text
create, list, read, abort, summarize, and manage sessions
```

Planned routes:

```text
POST /session
GET /session
GET /session/:sessionId
POST /session/:sessionId/abort
POST /session/:sessionId/summarize
DELETE /session/:sessionId
```

Required behavior:

```text
[ ] Session IDs must be stable.
[ ] Session reads must return structured metadata.
[ ] Abort must work for active runs.
[ ] Delete behavior must be clearly defined before implementation.
```

Delete behavior is unresolved.

## 6.3 Message Routes

Purpose:

```text
submit prompts
read messages
stream message-related events through global event stream
```

Planned routes:

```text
POST /session/:sessionId/message
GET /session/:sessionId/message
GET /session/:sessionId/message/:messageId
```

Required behavior:

```text
[ ] Prompt submission must create a run.
[ ] Message list must support pagination eventually.
[ ] Message payloads must distinguish user, assistant, system, tool, and summary records.
```

## 6.4 Config Routes

Purpose:

```text
inspect effective config
resolve config layers
validate config
```

Planned routes:

```text
GET /config
GET /config/effective
POST /config/validate
```

Required behavior:

```text
[ ] Config responses must not expose resolved secret values.
[ ] Config should expose secret references, not secret contents.
```

## 6.5 Provider Routes

Purpose:

```text
list providers
list models
show provider status
```

Planned routes:

```text
GET /provider
GET /provider/:providerId
GET /provider/:providerId/model
```

Required behavior:

```text
[ ] Provider status must not leak API keys.
[ ] Model list can be static, cached, or provider-fetched depending on implementation.
```

Exact provider list is unresolved.

## 6.6 File Routes

Purpose:

```text
read file metadata
preview file content
list project files
show diffs
```

Planned routes:

```text
GET /file
GET /file/content
GET /file/diff
GET /file/tree
```

Required behavior:

```text
[ ] File routes must respect path policy.
[ ] Sensitive file reads must be denied or permission-gated.
[ ] File routes must not mutate files.
```

File mutation should happen through controlled tool/runtime flow, not direct file routes.

## 6.7 Permission Routes

Purpose:

```text
read permission requests
respond to ask-gated permission prompts
inspect policy
```

Planned routes:

```text
GET /permission/request
GET /permission/request/:requestId
POST /permission/request/:requestId/decision
GET /permission/policy/effective
```

Required behavior:

```text
[ ] TUI can submit approve/deny decisions.
[ ] TUI cannot compute permission policy.
[ ] Permission decisions must be persisted and ledgered.
```

## 6.8 Tool Routes

Purpose:

```text
inspect registered tools and tool metadata
```

Planned routes:

```text
GET /tool
GET /tool/:toolName
```

Required behavior:

```text
[ ] Tool list must expose safe metadata only.
[ ] Tool execution must not be available as direct arbitrary route from TUI.
```

Tool execution is owned by core runtime.

## 6.9 TUI Routes

Purpose:

```text
support TUI control plane behaviors
```

Planned routes:

```text
POST /tui/prompt/prefill
POST /tui/focus
GET /tui/state
```

These are provisional and may not be needed in first implementation.

## 6.10 Auth Routes

Purpose:

```text
local auth support if enabled
```

Planned routes:

```text
POST /auth/token
GET /auth/status
```

Auth details are unresolved. Localhost-only remains the default security boundary.

## 7. Core Schemas

The protocol package must define schemas for:

```text
CommonId
Timestamp
ErrorEnvelope
Pagination
Session
Message
Run
ToolCall
ToolResult
PermissionRequest
PermissionDecision
Agent
ModelProvider
Model
FileReference
FileContent
DiffPreview
LedgerEvent
TokenHealthStatus
Config
EventEnvelope
```

Exact field sets are unresolved and must be designed in Phase 2.

## 8. Error Envelope

All API errors must use one structured envelope.

Provisional shape:

```text
{
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
    recoverable?: boolean
  }
}
```

Rules:

```text
[ ] Do not leak secrets in errors.
[ ] Do not return raw stack traces to TUI by default.
[ ] Preserve request ID for debugging.
[ ] Make recoverable errors distinguishable where possible.
```

## 9. Event Stream Contract

The event stream must use Server-Sent Events.

Planned route:

```text
GET /global/event
```

Events should be wrapped in a stable event envelope.

Provisional event envelope:

```text
{
  id: string
  type: string
  sessionId?: string
  runId?: string
  timestamp: string
  payload: unknown
}
```

## 10. Event Categories

Required event categories:

```text
server
session
message
model
tool
permission
diff
shell
token_health
ledger
cache
planner
```

Provisional event examples:

```text
server.started
session.created
session.aborted
message.created
message.delta
model.call_started
model.call_completed
tool.requested
tool.completed
permission.requested
permission.decided
diff.preview_created
shell.output
token_health.updated
ledger.event_created
cache.hit
cache.invalidated
planner.plan_created
```

Exact event names are unresolved.

## 11. SDK Requirements

Future folder:

```text
packages/sdk
```

SDK must provide typed resources for:

```text
health
events
sessions
messages
config
providers
files
permissions
tools
tui
auth
```

SDK must support:

```text
HTTP requests
SSE subscription
typed errors
abort signals where applicable
server URL configuration
local default URL
```

SDK must not:

```text
execute tools
decide permissions
write files
run shell commands
own runtime state
```

## 12. Versioning

API versioning is unresolved.

Recommended provisional approach:

```text
No external versioned API in early phases.
Use internal protocol package versioning.
Add /v1 only when public compatibility is needed.
```

## 13. Validation Rules

Every server request must:

```text
[ ] Validate params.
[ ] Validate query.
[ ] Validate body.
[ ] Return structured errors.
[ ] Avoid partial unvalidated objects.
```

Every server response should:

```text
[ ] Match protocol schema where practical.
[ ] Avoid leaking secrets.
[ ] Include stable IDs.
[ ] Include timestamps where useful.
```

## 14. Phase 2 Acceptance Criteria

Phase 2 is complete when:

```text
[ ] Core schemas exist.
[ ] Route contracts exist.
[ ] Error envelope exists.
[ ] Event envelope exists.
[ ] OpenAPI generation path exists.
[ ] SDK generation or typed SDK strategy exists.
[ ] TUI has no hand-written duplicate API types.
```

## 15. Anti-Patterns

Do not:

- Implement routes before schemas.
- Use TypeScript interfaces as the only contract.
- Create divergent DTOs in TUI and server.
- Let database table shape become API shape automatically.
- Expose tool execution as arbitrary HTTP route.
- Leak secrets through config/provider routes.
- Stream untyped event payloads without envelope.
- Treat SSE event state as authoritative command input.

## 16. Open Questions

| ID | Question | Status |
|---|---|---|
| API-001 | Exact route names | Provisional |
| API-002 | Exact schema fields | Unresolved |
| API-003 | SDK generation tool | Unresolved |
| API-004 | API versioning strategy | Unresolved |
| API-005 | Auth route behavior | Unresolved |
| API-006 | Delete/archive session behavior | Unresolved |
| API-007 | Pagination standard | Unresolved |
| API-008 | Exact event names | Unresolved |

## 17. Agent Instructions

Future agents must:

1. Create protocol schemas before server routes.
2. Use Zod as the source of truth.
3. Generate or derive SDK types from protocol.
4. Keep API DTOs separate from database internals.
5. Mark unresolved fields as provisional.
6. Never implement tool execution as a direct unsafe route.

## 18. Validation Checklist

```text
[ ] Route groups are documented.
[ ] Schema ownership is clear.
[ ] Error envelope is specified provisionally.
[ ] Event envelope is specified provisionally.
[ ] SDK responsibilities are clear.
[ ] Open questions are marked.
