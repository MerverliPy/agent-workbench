# 0014 — Read/Search Cache

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

Agents often repeat file reads and searches. Caching read/search results can improve efficiency but risks stale or sensitive context if invalidation is weak.

## Decision

Cache read, grep, and glob results with invalidation.

## Rationale

A session-scoped read/search cache reduces repeated tool calls and token waste while preserving correctness if invalidation and permissions are enforced.

## Consequences

### Positive

```text
[+] Less repeated filesystem work.
[+] Faster agent loops.
[+] Reduced token waste.
[+] Better than naive repeated grep/glob.
```

### Negative / Tradeoffs

```text
[-] Cache invalidation complexity.
[-] Sensitive data risk.
[-] Stale context risk.
[-] Persistence policy unresolved.
```

## Implementation Rules

```text
[ ] Cache read/grep/glob.
[ ] Invalidate on file mutation.
[ ] Re-check permissions before returning cached content.
[ ] Keep cache session/project scoped.
[ ] Pass cached outputs through token-health compression.
```

## Boundaries

`packages/cache` owns cache behavior. Tools/core use it. TUI does not own cache.

## Risks

```text
[ ] Cache may return stale file contents.
[ ] Cache may expose now-denied paths.
[ ] Cache retention may preserve sensitive content.
```

## Validation Checklist

```text
[ ] Cache key includes session/project/tool input.
[ ] Invalidation works.
[ ] Permission re-check works.
[ ] Token compression still applies.
[ ] Cache events/ledger policy defined.
```

## Notes for Future Agents

In-memory versus SQLite cache remains unresolved.
