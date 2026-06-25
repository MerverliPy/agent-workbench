# 0008 — Patch-First File Mutations

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

File mutation is risky. The system must make changes reviewable, auditable, and reversible where possible.

## Decision

Use patch-first file mutation with diff preview and approval by default.

## Rationale

Patch-first mutation supports review, dry-run, conflict detection, and auditability better than opaque full-file rewrites.

## Consequences

### Positive

```text
[+] Reviewable changes.
[+] Better audit trail.
[+] Supports dry-run preview.
[+] Supports revert metadata.
[+] Reduces accidental broad rewrites.
```

### Negative / Tradeoffs

```text
[-] Patch generation and application can be complex.
[-] Conflicts must be handled.
[-] Full-file write may still be needed for create/replace cases.
```

## Implementation Rules

```text
[ ] Do not implement mutation before permission engine.
[ ] Do not apply mutation before diff preview.
[ ] Default mutation permission is ask.
[ ] Record file change metadata.
[ ] Support revert where possible.
```

## Boundaries

`packages/diff` owns preview/apply/revert mechanics. `packages/tools` owns tool definitions. `packages/permissions` gates execution. TUI renders previews only.

## Risks

```text
[ ] Patch may apply incorrectly if context is stale.
[ ] Revert strategy remains unresolved.
[ ] Large diffs may harm token/UI clarity.
```

## Validation Checklist

```text
[ ] Diff preview exists.
[ ] Dry-run exists.
[ ] Permission gate exists.
[ ] Approval required by default.
[ ] Ledger records mutation.
```

## Notes for Future Agents

Do not allow model output to write files directly.
