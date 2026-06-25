# 0010 — Build + Plan Agents First

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The agent system should support different operating modes but must avoid early subagent complexity.

## Decision

Implement only two initial primary agents:

```text
Build
Plan
```

Do not implement subagents initially.

## Rationale

Build + Plan provides a practical initial split between implementation and planning while keeping runtime complexity manageable.

## Consequences

### Positive

```text
[+] Clear user workflow.
[+] Reduced initial complexity.
[+] Permissions can differ by agent.
[+] Avoids early delegation/token complexity.
```

### Negative / Tradeoffs

```text
[-] No specialized Review/Test/Explore subagents initially.
[-] Plan permissions require final confirmation.
[-] Agent prompts must be carefully versioned.
```

## Implementation Rules

```text
[ ] Build is main implementation agent.
[ ] Plan is planning/analysis agent.
[ ] No subagent delegation initially.
[ ] Agent permissions must be explicit.
[ ] Agent prompt identity/version must be recorded.
```

## Boundaries

Agent definitions live in core/config/protocol layers, not only in TUI. TUI only selects and displays active agent.

## Risks

```text
[ ] Plan may accidentally mutate files if permissions are too broad.
[ ] Build may become too permissive.
[ ] Prompt versioning may be skipped.
```

## Validation Checklist

```text
[ ] Build agent exists.
[ ] Plan agent exists.
[ ] Agent selector exists.
[ ] Agent profiles apply to permissions.
[ ] No subagents exist.
```

## Notes for Future Agents

Exact Build and Plan system prompts are unresolved.
