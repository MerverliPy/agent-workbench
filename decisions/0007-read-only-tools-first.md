# 0007 — Read-Only Tools First

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The first useful agent runtime should understand the codebase without mutating files or running shell commands.

## Decision

Implement read-only tools first:

```text
read
grep
glob
```

## Rationale

Read-only tools give the agent useful codebase context while avoiding early mutation or shell-execution risk.

## Consequences

### Positive

```text
[+] Useful first runtime capability.
[+] Lower safety risk.
[+] Enables context-building.
[+] Allows cache/token systems to begin around safe outputs.
```

### Negative / Tradeoffs

```text
[-] Agent cannot implement changes until later phases.
[-] Sensitive path policy still matters for reads.
[-] Large outputs can still harm token health.
```

## Implementation Rules

```text
[ ] Implement read/grep/glob before write/edit/bash.
[ ] Respect sensitive path policy.
[ ] Compress large results.
[ ] Ledger tool calls.
[ ] Cache read/search results with invalidation later.
```

## Boundaries

Read-only tools are still backend tools. The TUI must not call filesystem directly.

## Risks

```text
[ ] Read tools may expose sensitive files.
[ ] Grep output may be too large.
[ ] Cache may preserve sensitive/stale content.
```

## Validation Checklist

```text
[ ] read exists.
[ ] grep exists.
[ ] glob exists.
[ ] Outputs are structured.
[ ] Outputs are compressed/truncated.
[ ] Tool calls are ledgered.
[ ] No mutation tools exist yet.
```

## Notes for Future Agents

Read-only does not mean no security policy. Sensitive files still require restrictions.
