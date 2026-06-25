# 14 — Dry-Run Model

Status: Phase 0 — Planning Docs  
Document type: agent-ready dry-run model  
Scope: previewing risky file and shell operations before execution

## 1. Purpose

This document defines the dry-run model for `agent-workbench`.

Dry-run is a safety and efficiency feature. It allows the system to preview risky operations before execution, especially file edits and shell commands.

Dry-run must not become an execution bypass.

## 2. Confirmed Direction

Dry-run support is required for:

```text
file edits
shell command preview
```

Confirmed optimization:

```text
File edits + shell command preview before risky execution.
```

## 3. Ownership

Future relevant folders:

```text
packages/diff/src/dry-run
packages/shell
packages/planner
packages/core
packages/storage
apps/tui/src/components/diff
apps/tui/src/components/permissions
```

Ownership split:

```text
planner: determines when dry-run is required
diff: produces file mutation dry-runs
shell: produces command preview/dry-run metadata
permissions: evaluates dry-run result where relevant
core: orchestrates dry-run lifecycle
storage: persists dry-run/ledger metadata
tui: renders dry-run result
```

The TUI must not execute dry-run logic directly.

## 4. Dry-Run Goals

Dry-run must:

```text
preview impact before execution
support user trust
reduce accidental destructive actions
support permission prompts
produce ledger records
avoid mutating project state
help model/user understand risk
```

## 5. Dry-Run Non-Goals

Dry-run does not guarantee:

```text
perfect prediction of shell side effects
perfect filesystem equivalence
safe execution by itself
approval of execution
sandbox isolation unless explicitly implemented later
```

Dry-run is a preview, not a sandbox unless a future phase explicitly implements sandboxing.

## 6. Dry-Run Types

## 6.1 File Mutation Dry-Run

Applies to:

```text
write
edit
apply_patch
delete if ever supported
rename if ever supported
```

Expected output:

```text
target path
change type
diff preview
before hash if available
after hash estimate if available
line additions
line deletions
risk level
conflict status
whether patch can apply cleanly
```

## 6.2 Shell Command Dry-Run

Applies to:

```text
bash
future shell-like tools
```

Expected output:

```text
raw command
normalized command
working directory
risk classification
matched risk rules
expected side effects if inferable
requires approval
timeout policy
environment policy summary
```

Important limitation:

```text
Shell dry-run is usually static analysis/preview, not actual execution.
```

## 7. File Dry-Run Flow

```text
1. Agent proposes file mutation.
2. Core routes mutation to planner/diff system.
3. Diff system validates target path.
4. Diff system creates patch preview.
5. Dry-run checks whether patch can apply.
6. Permission engine evaluates mutation with dry-run metadata.
7. Server emits preview/permission events.
8. TUI displays dry-run result.
9. User approves or denies if required.
10. Execution occurs only after approval.
11. Ledger records dry-run and final execution result.
```

## 8. Shell Dry-Run Flow

```text
1. Agent proposes shell command.
2. Core routes command to shell risk analyzer.
3. Command is parsed and normalized.
4. Risk classifier evaluates patterns.
5. Dry-run preview is generated.
6. Permission engine evaluates command.
7. TUI displays command preview and risk.
8. User approves or denies if ask-gated.
9. Command executes only after approval.
10. Ledger records dry-run and command result.
```

## 9. Dry-Run and Permissions

Dry-run must feed permission evaluation, but it must not replace permission evaluation.

Correct flow:

```text
dry-run preview
  ↓
permission evaluation
  ↓
approval if required
  ↓
execution
```

Incorrect flow:

```text
dry-run preview
  ↓
execution
```

## 10. Required Dry-Run Metadata

A dry-run result should include:

```text
id
session_id
run_id
operation_type
tool_name
risk_level
summary
target_paths
command if any
diff_preview_id if any
can_apply if file mutation
requires_permission
created_at
metadata_json
```

Exact schema is deferred to protocol/data model implementation.

## 11. TUI Requirements

The TUI should render:

```text
dry-run summary
risk level
target path or command
diff preview if file mutation
matched risk rules if command
approval/deny controls when required
clear indication that no mutation has happened yet
```

The TUI must not:

```text
apply patch from dry-run result
run command from dry-run result directly
alter risk classification
hide dry-run limitations
```

## 12. Ledger Requirements

Ledger must record:

```text
dry_run.created
dry_run.displayed if useful
dry_run.approved if approval tied to dry-run
dry_run.rejected
dry_run.failed
execution.started
execution.completed
execution.failed
```

Exact event names are provisional.

## 13. File Dry-Run Safety Rules

File dry-run must:

```text
[ ] Never write to target file.
[ ] Validate patch applicability.
[ ] Identify conflicting context.
[ ] Preserve original file state.
[ ] Respect path permission policy.
[ ] Avoid reading denied sensitive files.
```

## 14. Shell Dry-Run Safety Rules

Shell dry-run must:

```text
[ ] Never execute the command.
[ ] Parse and classify command statically where possible.
[ ] Show working directory.
[ ] Show timeout policy.
[ ] Show risky tokens/patterns.
[ ] Show known destructive indicators.
```

Shell dry-run cannot guarantee a command is safe.

## 15. Relationship to Planner

The pre-run planner should require dry-run before mutation.

Confirmed optimization:

```text
required execution plan before mutation
```

Planner responsibilities:

```text
[ ] Identify mutation steps.
[ ] Require dry-run for mutation steps.
[ ] Reject mutation plans without preview.
[ ] Surface risk before execution.
```

## 16. Relationship to Cache

Dry-run may invalidate or bypass cache.

Rules:

```text
[ ] File dry-run alone should not invalidate cache.
[ ] Actual file mutation must invalidate related cache entries.
[ ] Dry-run should use current file state, not stale cache, when correctness matters.
```

## 17. Relationship to Token Health

Dry-run output can be large.

Requirements:

```text
[ ] Diff previews should be summarized when large.
[ ] Shell previews should be concise.
[ ] Full dry-run metadata should not automatically enter model context.
[ ] Token-health system may compress dry-run summaries.
```

## 18. Acceptance Criteria

Dry-run design is valid when:

```text
[ ] File mutation dry-run is defined.
[ ] Shell command preview is defined.
[ ] Dry-run is separate from execution.
[ ] Dry-run feeds permission evaluation.
[ ] TUI displays dry-run clearly.
[ ] Ledger records dry-run events.
[ ] Dry-run cannot mutate project state.
```

## 19. Phase Dependencies

Dry-run depends on:

```text
Phase 2 Protocol Contract
Phase 5 Storage
Phase 6 Core Runtime
Phase 8 Permission Engine
Phase 9 File Mutation Tools
Phase 10 Shell Execution
```

Do not implement dry-run execution code during Phase 0.

## 20. Anti-Patterns

Do not:

- Treat dry-run as approval.
- Let TUI apply dry-run changes.
- Let shell dry-run execute commands.
- Hide dry-run uncertainty.
- Use stale cache for patch applicability.
- Skip ledger entries for dry-run.
- Run mutation without dry-run when policy requires it.
- Present shell preview as guaranteed safe.

## 21. Open Questions

| ID | Question | Status |
|---|---|---|
| DRY-001 | Exact dry-run schema | Unresolved |
| DRY-002 | Exact shell parser | Unresolved |
| DRY-003 | Whether true sandbox dry-run is needed later | Deferred |
| DRY-004 | Maximum diff preview size | Unresolved |
| DRY-005 | Dry-run retention policy | Unresolved |
| DRY-006 | Whether dry-run IDs persist separately from ledger | Unresolved |

## 22. Agent Instructions

Future agents must:

1. Keep dry-run separate from execution.
2. Do not implement shell execution as dry-run.
3. Use dry-run metadata in permission prompts.
4. Ledger dry-run creation and result.
5. Mark shell dry-run limitations clearly.
6. Preserve no-mutation guarantee.

## 23. Validation Checklist

```text
[ ] Dry-run purpose is clear.
[ ] File dry-run is documented.
[ ] Shell preview is documented.
[ ] Permission relationship is documented.
[ ] TUI requirements are documented.
[ ] Ledger requirements are documented.
[ ] Open questions are marked.
```
