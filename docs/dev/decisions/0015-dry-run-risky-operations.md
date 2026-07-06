# 0015 — Dry-Run Risky Operations

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

Risky file and shell operations should be previewed before execution. The user selected dry-run support for file edits and shell command previews.

## Decision

Support dry-run previews for risky operations, specifically:

```text
file edits
shell command previews
```

## Rationale

Dry-run improves trust and safety by making impact visible before execution. It supports permission prompts and run ledger visibility.

## Consequences

### Positive

```text
[+] Safer file edits.
[+] Better shell command transparency.
[+] Better permission prompts.
[+] Better audit records.
[+] More efficient review before execution.
```

### Negative / Tradeoffs

```text
[-] Shell dry-run is usually static preview, not true execution simulation.
[-] True sandboxing is deferred.
[-] Dry-run schemas remain unresolved.
```

## Implementation Rules

```text
[ ] Dry-run must not mutate project state.
[ ] Dry-run must not execute shell commands.
[ ] Dry-run feeds permission evaluation.
[ ] Approval is still required for ask-gated execution.
[ ] Dry-run results are ledgered.
```

## Boundaries

Diff owns file dry-runs. Shell owns command previews. Planner requires dry-run before mutation. TUI renders results only.

## Risks

```text
[ ] User may mistake preview for safety guarantee.
[ ] Shell preview may miss dynamic side effects.
[ ] Large diffs may need summarization.
```

## Validation Checklist

```text
[ ] File dry-run exists.
[ ] Shell preview exists.
[ ] Dry-run is separate from execution.
[ ] Permission flow uses dry-run metadata.
[ ] Ledger records dry-run events.
```

## Notes for Future Agents

Do not implement true sandbox dry-run unless separately confirmed.
