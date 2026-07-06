# 15 — Cache Model

Status: Phase 0 — Planning Docs  
Document type: agent-ready cache model  
Scope: read/search cache, invalidation, safety, token efficiency, session behavior

## 1. Purpose

This document defines the cache model for `agent-workbench`.

Caching is a confirmed optimization intended to reduce repeated read/search work and improve agent efficiency. It must not compromise correctness, security, or token health.

## 2. Confirmed Direction

Confirmed optimization:

```text
cache read/grep/glob with invalidation
```

Initial cache scope:

```text
session-scoped read/search cache
```

Cached tools:

```text
read
grep
glob
```

Future cached tools may include:

```text
project_tree
vcs_status
```

## 3. Ownership

Future folder:

```text
packages/cache
```

Cache interacts with:

```text
packages/tools
packages/storage
packages/core
packages/tokens
packages/permissions
packages/events
```

The TUI must not own or directly mutate cache.

## 4. Cache Goals

Cache must:

```text
reduce repeated file reads
reduce repeated grep/glob work
improve latency
reduce token waste
make repeated agent reasoning more efficient
respect sensitive path policy
invalidate when files change
remain observable/debuggable
```

## 5. Cache Non-Goals

Cache is not:

```text
a source of truth
a replacement for filesystem state
a permission bypass
a long-term memory system
a place to store secrets indefinitely
```

## 6. Cache Types

## 6.1 Read Cache

Stores:

```text
file path
file hash or mtime metadata
content or compressed content
read parameters
created timestamp
invalidated timestamp
```

Rules:

```text
[ ] Must respect path policy.
[ ] Must invalidate on file mutation.
[ ] Must not preserve sensitive content beyond policy.
```

## 6.2 Grep Cache

Stores:

```text
query
scope
matched files
match excerpts
file metadata snapshot
created timestamp
invalidated timestamp
```

Rules:

```text
[ ] Must invalidate when matching files change.
[ ] Must respect ignore rules.
[ ] Must preserve structured result metadata.
```

## 6.3 Glob Cache

Stores:

```text
pattern
scope
matched paths
directory metadata snapshot
created timestamp
invalidated timestamp
```

Rules:

```text
[ ] Must invalidate on file create/delete/rename.
[ ] Must respect ignore and sensitive path policy.
```

## 7. Cache Key Requirements

Cache keys should include:

```text
project identity
session id
tool name
input parameters
relevant file/path scope
config hash if relevant
permission policy hash if relevant
```

Exact key design is unresolved.

## 8. Invalidation Rules

Cache must invalidate on:

```text
file edit
file write
patch apply
file delete
file rename
permission policy change affecting paths
config change affecting ignore/path rules
```

Potential invalidation events:

```text
cache.invalidated
cache.bypassed
cache.refreshed
```

Exact event names are provisional.

## 9. Cache and File Mutation

File mutation must invalidate relevant cache entries.

Correct flow:

```text
patch applied
  ↓
file change recorded
  ↓
cache invalidated
  ↓
ledger/event emitted
```

Do not keep stale read/grep/glob results after mutation.

## 10. Cache and Permissions

Cache must not bypass permission checks.

Rules:

```text
[ ] If a file is denied now, cached content must not be returned.
[ ] If path policy changes, affected cache entries must be invalidated or rechecked.
[ ] Sensitive file content must not be cached unless policy explicitly allows.
```

## 11. Cache and Token Health

Cached results may still be too large for context.

Rules:

```text
[ ] Cache hit results still pass through token-health compression.
[ ] Do not automatically inject full cached content into model context.
[ ] Store compressed metadata where useful.
[ ] Preserve omitted counts and truncation metadata.
```

## 12. Cache Persistence

Persistence policy is unresolved.

Recommended initial approach:

```text
session-scoped cache persisted in SQLite only if needed for restart behavior
```

Simpler option:

```text
in-memory session cache first
```

This requires confirmation during implementation.

## 13. Cache Events

Provisional events:

```text
cache.hit
cache.miss
cache.write
cache.invalidated
cache.bypassed
cache.error
```

Events should be visible in ledger only where useful. Not every cache read must be noisy in the TUI.

## 14. Cache Ledger Requirements

Ledger should record:

```text
cache invalidation caused by mutation
cache bypass due to sensitive policy
cache significant misses/hits if useful for debugging
```

Exact ledger verbosity is unresolved.

## 15. Cache Safety Rules

Cache must:

```text
[ ] Respect sensitive path policy.
[ ] Invalidate on mutation.
[ ] Avoid stale context.
[ ] Avoid storing secrets unnecessarily.
[ ] Preserve session/project boundaries.
[ ] Avoid cross-project contamination.
```

## 16. Cache Acceptance Criteria

Cache implementation is valid when:

```text
[ ] read cache exists or is explicitly deferred.
[ ] grep cache exists or is explicitly deferred.
[ ] glob cache exists or is explicitly deferred.
[ ] Cache keys include enough context to prevent collisions.
[ ] Cache invalidates after file mutation.
[ ] Cache respects permission policy.
[ ] Cache results pass through token-health controls.
```

## 17. Anti-Patterns

Do not:

- Return cached content for a now-denied path.
- Keep grep results after file mutation.
- Use cache as source of truth.
- Share cache across projects accidentally.
- Store secrets indefinitely.
- Inject full cached outputs into context without truncation.
- Hide cache staleness from debugging.
- Add cache before read/search semantics are stable.

## 18. Phase Dependencies

Cache depends on:

```text
Phase 2 Protocol Contract
Phase 5 Storage if persisted
Phase 6 Core Runtime
Phase 7 Read-Only Tools
Phase 8 Permission Engine for policy-aware cache
Phase 9 File Mutation Tools for invalidation
Phase 12 Token Health for compression
```

Cache may be partially implemented earlier, but permission and mutation invalidation rules must not be ignored.

## 19. Open Questions

| ID | Question | Status |
|---|---|---|
| CACHE-001 | In-memory vs SQLite cache first | Unresolved |
| CACHE-002 | Exact cache key structure | Unresolved |
| CACHE-003 | Cache retention duration | Unresolved |
| CACHE-004 | Ledger verbosity for cache hits/misses | Unresolved |
| CACHE-005 | File watching vs mutation-triggered invalidation | Unresolved |
| CACHE-006 | Sensitive content caching policy | Needs confirmation |

## 20. Agent Instructions

Future agents must:

1. Cache read/grep/glob only after basic tool behavior is defined.
2. Invalidate cache on mutation.
3. Re-check permission policy before returning cached content.
4. Keep cache session/project scoped.
5. Do not use cache to bypass token-health truncation.
6. Mark persistence behavior as unresolved until chosen.

## 21. Validation Checklist

```text
[ ] Cache purpose is clear.
[ ] Cached tool types are listed.
[ ] Invalidation rules are documented.
[ ] Permission interaction is documented.
[ ] Token-health interaction is documented.
[ ] Open questions are marked.
```
