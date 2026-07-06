# 0012 — Run Ledger Panel

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

Chat transcripts alone are insufficient for inspecting agent operations such as tool calls, approvals, diffs, shell commands, and token compaction.

## Decision

The TUI must include a collapsible run ledger panel.

## Rationale

A ledger panel improves transparency and makes the system more efficient than chat-only agent TUIs by separating operational audit data from conversation text.

## Consequences

### Positive

```text
[+] Better visibility into agent work.
[+] Easier debugging.
[+] Clear permission/tool history.
[+] Less clutter in chat timeline.
```

### Negative / Tradeoffs

```text
[-] Adds UI complexity.
[-] Ledger verbosity must be managed.
[-] Requires stable event/ledger taxonomy.
```

## Implementation Rules

```text
[ ] Ledger panel renders backend-provided ledger data.
[ ] TUI is not source of truth.
[ ] Risky operations appear in ledger.
[ ] Failed and denied operations appear in ledger.
[ ] Redaction status should be visible where relevant.
```

## Boundaries

Core creates ledger records, storage persists them, events stream updates, and TUI renders the panel.

## Risks

```text
[ ] Ledger panel may become noisy.
[ ] Sensitive data may appear without redaction.
[ ] Event names are provisional.
```

## Validation Checklist

```text
[ ] Ledger events persist.
[ ] Ledger events stream.
[ ] Panel renders events.
[ ] Filters/categories planned.
[ ] Redaction status supported.
```

## Notes for Future Agents

Do not treat chat messages as a replacement for ledger records.
