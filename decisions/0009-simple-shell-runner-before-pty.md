# 0009 — Simple Shell Runner Before PTY

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

Shell execution is powerful and risky. Full PTY support adds complexity and should not be the first shell milestone.

## Decision

Implement a simple command runner first. Defer full PTY support to a later design.

## Rationale

A simple runner allows command execution with timeout, abort, stdout/stderr capture, risk classification, and permission gating before adding PTY complexity.

## Consequences

### Positive

```text
[+] Safer first shell implementation.
[+] Easier timeout/abort support.
[+] Easier ledger recording.
[+] Avoids early terminal emulation complexity.
```

### Negative / Tradeoffs

```text
[-] Interactive commands may not work.
[-] Some terminal behavior will be limited.
[-] PTY design still required later.
```

## Implementation Rules

```text
[ ] Shell execution starts only after permission engine.
[ ] bash defaults to ask.
[ ] Destructive commands default to deny.
[ ] Commands require risk classification.
[ ] Commands require timeout and abort support.
[ ] PTY remains design-only until explicitly approved.
```

## Boundaries

`packages/shell` owns command runner mechanics. Permission decisions remain in `packages/permissions`. TUI must not spawn commands.

## Risks

```text
[ ] Command parsing is hard.
[ ] Destructive pattern list may be incomplete.
[ ] Long-running processes may leak resources if abort is weak.
```

## Validation Checklist

```text
[ ] Command parser exists.
[ ] Risk classifier exists.
[ ] Permission gate exists.
[ ] Timeout works.
[ ] Abort works.
[ ] stdout/stderr stream.
[ ] Ledger records command.
```

## Notes for Future Agents

Do not implement PTY first for convenience.
