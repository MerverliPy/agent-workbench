# 10 — Tool Runtime Model

Status: Phase 0 — Planning Docs  
Document type: agent-ready tool runtime model  
Scope: tool registry, execution lifecycle, permissions, result handling, read-only first, mutation later

## 1. Purpose

This document defines the planned tool runtime for `agent-workbench`.

Tools are controlled capabilities used by the core agent runtime. They must be registered, validated, permission-gated where needed, executed through backend-controlled runtime paths, and recorded in the run ledger.

## 2. Confirmed Direction

Tool implementation order:

```text
read-only tools first
permission engine before risky tools
file mutation tools after diff preview
shell execution after permission engine
```

Initial tools:

```text
read
grep
glob
```

Later tools:

```text
write
edit
apply_patch
bash
todo
question
lsp
```

## 3. Ownership

Future folder:

```text
packages/tools
```

Tool orchestration may involve:

```text
packages/core
packages/permissions
packages/storage
packages/events
packages/cache
packages/diff
packages/shell
packages/tokens
```

Tools must not be executed by the TUI.

## 4. Tool Definition

A tool definition should include:

```text
name
description
input schema
result schema
permission requirements
risk metadata
execution function
result compression strategy
cache policy if applicable
ledger behavior
```

Exact schema is deferred to API/protocol design.

## 5. Tool Runtime Flow

```text
1. Model requests a tool.
2. Core parses tool request.
3. Tool registry resolves tool.
4. Tool input schema validates request.
5. Permission engine evaluates if required.
6. If ask, runtime pauses and emits permission request.
7. If denied, tool does not execute.
8. If allowed, tool executor runs.
9. Result is normalized.
10. Result is compressed/truncated if needed.
11. Events are emitted.
12. Tool call and result are ledgered.
13. Core continues model/tool loop.
```

## 6. Tool Registry

Future folder:

```text
packages/tools/src/registry
```

Registry responsibilities:

```text
register tools
lookup tool by name
expose tool metadata
validate tool availability by agent
provide schemas to model layer if needed
hide unavailable tools from agent context
```

The registry must not:

```text
bypass permission engine
execute tools from TUI requests directly
include unsafe tools before their phase
```

## 7. Read Tool

Purpose:

```text
Read file contents from project.
```

Default permission:

```text
allow for normal project files
deny or ask for sensitive paths
```

Requirements:

```text
[ ] Respect path policy.
[ ] Return structured content.
[ ] Limit output size.
[ ] Support token-health truncation.
[ ] Use cache where safe.
[ ] Ledger read operation metadata.
```

## 8. Grep Tool

Purpose:

```text
Search file contents.
```

Default permission:

```text
allow for normal project files
```

Requirements:

```text
[ ] Respect ignore rules.
[ ] Respect sensitive path policy.
[ ] Return matches with file path, line, excerpt, and counts.
[ ] Compress large result sets.
[ ] Cache with invalidation.
[ ] Ledger search metadata.
```

## 9. Glob Tool

Purpose:

```text
Find files by path pattern.
```

Default permission:

```text
allow
```

Requirements:

```text
[ ] Respect ignore rules.
[ ] Avoid returning sensitive paths unless policy allows.
[ ] Return structured path list.
[ ] Limit oversized output.
[ ] Cache with invalidation.
```

## 10. File Mutation Tools

Deferred until Phase 9.

Planned tools:

```text
write
edit
apply_patch
diff_preview
revert_last_change
```

Requirements:

```text
[ ] Permission check required.
[ ] Patch-first mutation preferred.
[ ] Diff preview required.
[ ] Approval required by default.
[ ] Dry-run preview supported.
[ ] Mutation ledger event required.
```

Do not implement these before Phase 9.

## 11. Bash Tool

Deferred until Phase 10.

Requirements:

```text
[ ] Permission check required.
[ ] Command risk classification required.
[ ] Timeout required.
[ ] Abort required.
[ ] stdout/stderr streaming required.
[ ] Dry-run preview required where possible.
[ ] Ledger required.
```

Do not implement bash before Phase 10.

## 12. Question Tool

Purpose:

```text
Let the agent ask the user a clarification question during a run.
```

This is a future tool and not part of read-only first phase unless required.

Requirements:

```text
[ ] Must pause run.
[ ] Must emit event to TUI.
[ ] Must record user response.
[ ] Must not be confused with permission prompts.
```

## 13. Todo Tool

Purpose:

```text
Maintain structured agent task list.
```

Potential tools:

```text
todo_read
todo_write
```

Todo tool is useful but not confirmed for the first read-only implementation.

## 14. LSP Tools

LSP tools are deferred.

Potential tools:

```text
lsp_definition
lsp_references
lsp_symbols
lsp_hover
```

Reason for deferral:

```text
LSP adds project/language complexity and should follow basic read/search stability.
```

## 15. Tool Result Compression

Tool results must be structured and token-aware.

Compression should preserve:

```text
paths
line numbers
match counts
important excerpts
omitted count
truncation reason
```

Do not return unbounded raw output to the model.

## 16. Tool Caching

Read/search caching is confirmed as an optimization.

Cached tools:

```text
read
grep
glob
project_tree later
vcs_status later
```

Requirements:

```text
[ ] Invalidate on file changes.
[ ] Respect sensitive path policy.
[ ] Be session-scoped initially.
[ ] Record cache hit/miss where useful.
```

## 17. Tool Permissions

Default tool permission posture:

```text
read: allow
grep: allow
glob: allow
edit/write/apply_patch: ask
bash: ask
destructive command: deny
```

Tools must declare whether they require permission evaluation.

## 18. Tool Ledger Requirements

Every tool call must record:

```text
tool_call_requested
tool_call_started
tool_call_completed
tool_call_failed
tool_call_denied if applicable
```

Exact ledger event names are provisional.

## 19. Tool Error Handling

Tool errors must be structured.

Tool error should include:

```text
code
message
recoverable
tool_name
details if safe
```

Do not expose secrets in tool errors.

## 20. Acceptance Criteria

Phase 7 is complete when:

```text
[ ] read exists.
[ ] grep exists.
[ ] glob exists.
[ ] Tool registry exists.
[ ] Tool inputs are schema-validated.
[ ] Tool outputs are structured.
[ ] Results are compressed/truncated.
[ ] Tool calls are visible in TUI.
[ ] Tool calls are recorded in ledger.
[ ] No mutation tools exist yet.
[ ] No shell tool exists yet.
```

## 21. Anti-Patterns

Do not:

- Let TUI call tools directly.
- Let model execute arbitrary code as a tool.
- Return unbounded tool output.
- Implement write/edit before permission engine.
- Implement bash before permission engine.
- Cache without invalidation.
- Hide failed/denied tool calls from ledger.
- Treat sensitive paths as normal files.

## 22. Open Questions

| ID | Question | Status |
|---|---|---|
| TOOL-001 | Exact tool definition schema | Unresolved |
| TOOL-002 | Exact ignore rules | Unresolved |
| TOOL-003 | Exact result size limits | Unresolved |
| TOOL-004 | Whether todo tool appears before file mutation | Unresolved |
| TOOL-005 | Exact LSP phase | Deferred |
| TOOL-006 | Exact cache retention | Unresolved |

## 23. Agent Instructions

Future agents must:

1. Implement read/grep/glob before mutation tools.
2. Keep tools behind core runtime.
3. Validate all tool inputs.
4. Ledger all tool calls.
5. Compress large results.
6. Respect permission policy.
7. Do not add bash early.

## 24. Validation Checklist

```text
[ ] Tool ownership is clear.
[ ] Read-only first is documented.
[ ] Risky tools are deferred.
[ ] Permission requirements are documented.
[ ] Compression/caching requirements are documented.
[ ] Open questions are marked.
```
