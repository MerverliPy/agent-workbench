# 11 — Token Health Model

Status: Phase 0 — Planning Docs  
Document type: agent-ready token-health model  
Scope: context budgets, truncation, summarization, compaction, relevance ranking, UI visibility

## 1. Purpose

This document defines the token-health model for `agent-workbench`.

Token health is required. Long-running coding-agent sessions must not silently degrade due to oversized message history, large tool outputs, repeated file reads, or uncontrolled context growth.

## 2. Confirmed Direction

Token-health implementation must include:

```text
tool-output truncation
session summarization
context budget calculator
```

Compaction behavior:

```text
suggested compaction with user approval
```

UI:

```text
token-health panel
```

## 3. Ownership

Future folder:

```text
packages/tokens
```

`packages/tokens` owns:

```text
context budget calculation
token-health status
tool-result truncation
message history truncation
session summarization
compaction suggestions
relevance ranking
summary quality checks
```

It must not own:

```text
TUI rendering
model provider secrets
permission policy decisions
storage schema definitions
tool execution
```

## 4. Token-Health Goals

The system must:

```text
prevent unbounded context growth
preserve important project facts
avoid repeatedly sending irrelevant tool output
make token health visible to user
suggest compaction before context failure
avoid hiding summarization decisions
support long-running sessions
```

## 5. Context Budget Calculator

The context budget calculator should estimate:

```text
model context limit
current message history size
planned prompt size
selected tool definitions size
selected file context size
tool result size
summary size
remaining budget
risk level
```

Exact token counting method is unresolved.

Recommended provisional strategy:

```text
approximate before model call
use provider-reported usage after model call when available
```

## 6. Token-Health Status

Provisional statuses:

```text
healthy
watch
strained
critical
```

### healthy

Plenty of remaining context.

### watch

Context is growing; no action required yet.

### strained

Compaction or truncation should be considered.

### critical

A run may fail or produce poor results without compaction.

Exact thresholds are unresolved.

## 7. Tool-Output Truncation

Tool outputs must be controlled before entering model context.

Truncation should preserve:

```text
file paths
line numbers
match counts
important excerpts
omitted item counts
truncation reason
follow-up suggestions if needed
```

Do not blindly cut strings without metadata.

## 8. Structured Compression

Preferred approach for large read/search outputs:

```text
structured compression
```

Example preserved data:

```text
query
matched file count
top matching files
per-file match counts
relevant excerpts
omitted matches count
reason for omission
```

## 9. Session Summarization

Session summarization should preserve:

```text
user goals
confirmed decisions
files changed
tools used
permission decisions
open tasks
important codebase facts
risks
unresolved questions
```

Summaries must not preserve secrets.

## 10. Compaction

Compaction behavior is confirmed as:

```text
suggested, user-approved
```

The system should not silently compact by default.

Compaction flow:

```text
1. Token-health status reaches threshold.
2. System generates compaction suggestion.
3. TUI displays suggestion.
4. User approves or defers.
5. Summary/compaction runs.
6. Result is stored.
7. Ledger records compaction event.
```

## 11. Summary Quality

Summary quality checks are required eventually.

Potential checks:

```text
contains current goal
contains changed files
contains open tasks
contains unresolved questions
contains safety-relevant decisions
does not contain obvious secrets
```

Exact quality system is unresolved.

## 12. Relevance Ranking

The system should select relevant context instead of including everything.

Rankable items:

```text
recent messages
session summaries
files read
files changed
grep results
user-stated goals
agent plan
permission decisions
```

Ranking signals are unresolved.

## 13. Token-Health Events

Provisional event types:

```text
token_health.updated
token_health.warning
compaction.suggested
compaction.started
compaction.completed
compaction.rejected
tool_result.truncated
context.selected
```

Exact event names are unresolved.

## 14. Token-Health Panel

The TUI should eventually show:

```text
current status
estimated context usage
remaining budget
largest context contributors
truncated tool results
compaction suggestion
summary state
```

The TUI must not compute authoritative token health. It renders backend/core-provided state.

## 15. Storage Requirements

Storage should persist:

```text
summaries
compaction events
token usage metadata
model-reported token usage if available
tool truncation metadata
```

Do not store secrets in summaries.

## 16. Model Provider Variability

Different providers may report token usage differently.

Requirements:

```text
[ ] Support approximate token counts.
[ ] Prefer provider-reported usage when available.
[ ] Store model/provider metadata with usage.
[ ] Mark estimates clearly.
```

## 17. Cache Interaction

Token health and cache should work together.

Cache can reduce repeated tool calls, but cached output must still be token-managed.

Requirements:

```text
[ ] Cached outputs still pass through truncation.
[ ] Cache hits must not bypass sensitive path policy.
[ ] Cache invalidation must update context assumptions.
```

## 18. Acceptance Criteria

Phase 12 is complete when:

```text
[ ] Context budget calculator exists.
[ ] Tool-output truncation exists.
[ ] Session summarization exists.
[ ] Compaction suggestion flow exists.
[ ] User approval is required for compaction by default.
[ ] Token-health status is visible in TUI.
[ ] Token-health events are emitted.
[ ] Summaries are persisted.
```

## 19. Anti-Patterns

Do not:

- Ignore token budget until model calls fail.
- Send full grep output blindly.
- Store summaries with secrets.
- Automatically compact without visibility.
- Remove important decisions from context.
- Treat approximate token counts as exact.
- Let TUI compute authoritative token state.
- Cache huge outputs and resend them uncompressed.

## 20. Open Questions

| ID | Question | Status |
|---|---|---|
| TOKEN-001 | Exact token counting library/method | Unresolved |
| TOKEN-002 | Status thresholds | Unresolved |
| TOKEN-003 | Summary prompt format | Unresolved |
| TOKEN-004 | Summary quality checks | Provisional |
| TOKEN-005 | Relevance ranking algorithm | Unresolved |
| TOKEN-006 | Provider-specific usage normalization | Unresolved |

## 21. Agent Instructions

Future agents must:

1. Treat token health as required, not optional.
2. Add truncation hooks before large tool outputs reach models.
3. Make compaction visible and user-approved.
4. Preserve important project facts.
5. Mark token estimates clearly.
6. Do not implement silent compaction by default.

## 22. Validation Checklist

```text
[ ] Token-health purpose is clear.
[ ] Required components are documented.
[ ] Compaction behavior is documented.
[ ] TUI visibility is documented.
[ ] Provider variability is documented.
[ ] Open questions are marked.
```
