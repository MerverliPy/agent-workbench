# 0013 — Pre-Run Planner Before Mutation

Status: Accepted  
Phase: Phase 0 — Planning Docs  
Decision type: Architecture Decision Record

## Context

Direct model-to-mutation flows can waste tool calls, increase risk, and reduce user trust. The user selected a required execution plan before mutation.

## Decision

Require an execution plan before mutation.

## Rationale

A planner gate makes risky work more predictable. It lets the system identify mutation steps, require dry-run/diff previews, and ask for permission before applying changes.

## Consequences

### Positive

```text
[+] Safer mutation workflows.
[+] Better user trust.
[+] Fewer wasted actions.
[+] Clearer run ledger.
[+] Enables mutation-specific approval.
```

### Negative / Tradeoffs

```text
[-] Adds planning overhead.
[-] May slow simple edits.
[-] Plan schema and validation remain unresolved.
```

## Implementation Rules

```text
[ ] Mutation plans must identify target files.
[ ] Mutation plans must identify risky steps.
[ ] File mutation requires dry-run/diff preview.
[ ] Risky plans require approval according to policy.
[ ] Planner must not execute tools directly.
```

## Boundaries

`packages/planner` owns plan structure and validation. Core orchestrates. Permissions decide approval. Diff/shell packages preview impacts.

## Risks

```text
[ ] Planner could become overcomplicated.
[ ] Agent may produce vague plans.
[ ] Plan validation schema is unresolved.
```

## Validation Checklist

```text
[ ] Plan object exists.
[ ] Mutation gate exists.
[ ] Unsafe plans can be rejected.
[ ] Plan events are ledgered.
[ ] Mutation does not bypass plan gate.
```

## Notes for Future Agents

Initial planner can be lightweight; do not build a full DAG system unless later confirmed.
