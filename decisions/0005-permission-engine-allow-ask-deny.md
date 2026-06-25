# 0005 — Permission Engine: allow / ask / deny

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The system will eventually execute tools that can read files, edit files, apply patches, and run shell commands. These actions require deterministic policy gates.

## Decision

Implement a centralized permission engine using exactly three decision classes:

```text
allow
ask
deny
```

## Rationale

A simple decision model is easier to audit, test, and explain. It gives the user control over risky actions while allowing safe read-only operations to proceed efficiently.

## Consequences

### Positive

```text
[+] Simple policy model.
[+] Clear approval flow.
[+] Testable denied/ask/allowed behavior.
[+] Supports tool/path/command/agent granularity.
```

### Negative / Tradeoffs

```text
[-] Requires careful policy precedence design.
[-] Ask-gated flows add runtime complexity.
[-] Overly conservative defaults may slow workflows.
```

## Implementation Rules

```text
[ ] read/grep/glob default to allow for normal project files.
[ ] edit/write/apply_patch default to ask.
[ ] bash defaults to ask.
[ ] destructive commands default to deny.
[ ] TUI may approve/deny ask requests but must not compute policy.
[ ] Denied actions must never execute.
```

## Boundaries

`packages/permissions` owns policy decisions. The TUI owns modal rendering only. Core must route risky tool requests through permissions before execution.

## Risks

```text
[ ] Permission prompts may be implemented as cosmetic UI.
[ ] Model-generated risk judgments may be trusted incorrectly.
[ ] Policy precedence remains provisional.
```

## Validation Checklist

```text
[ ] allow works.
[ ] ask pauses runtime.
[ ] deny blocks execution.
[ ] Decisions persist.
[ ] Permission events emit.
[ ] Ledger records permission flow.
```

## Notes for Future Agents

Implement permissions before file mutation and shell execution.
