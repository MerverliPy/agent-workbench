# 0006 — SQLite + Full Run Ledger

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

The project is local-first and requires auditable state for sessions, messages, tool calls, permissions, file changes, shell commands, and compaction events.

## Decision

Use SQLite + Drizzle for local persistence and maintain a full run ledger.

## Rationale

SQLite fits local-first persistence. Drizzle supports typed schema work. A full run ledger is required to audit agent behavior and risky actions.

## Consequences

### Positive

```text
[+] Local durable state.
[+] Sessions survive restart.
[+] Risky actions are auditable.
[+] Supports debugging and review.
[+] Fits offline/local-first workflows.
```

### Negative / Tradeoffs

```text
[-] Ledger may preserve sensitive content if redaction is weak.
[-] Retention/deletion policy remains unresolved.
[-] Database migrations add implementation complexity.
```

## Implementation Rules

```text
[ ] Persist sessions.
[ ] Persist messages.
[ ] Persist tool calls.
[ ] Persist permission requests and decisions.
[ ] Persist run ledger events.
[ ] Persist file change metadata.
[ ] Persist summaries.
[ ] Do not store plaintext provider secrets by default.
```

## Boundaries

`packages/storage` owns database schema and repositories. Storage does not decide permissions, execute tools, or render UI.

## Risks

```text
[ ] Secrets may be accidentally stored in ledger.
[ ] Raw command output may be too large or sensitive.
[ ] Cache/session retention policy is unresolved.
```

## Validation Checklist

```text
[ ] SQLite path policy defined.
[ ] Drizzle schema exists.
[ ] Run ledger table exists.
[ ] Repositories exist.
[ ] Secret storage policy enforced.
```

## Notes for Future Agents

Ledger should be separate from chat messages. Chat transcript is not sufficient audit history.
