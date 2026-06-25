# 05 — Permission Model

Status: Phase 0 — Planning Docs  
Document type: agent-ready permission model  
Scope: safety posture, decisions, policies, risk classes, approval flow

## 1. Purpose

This document defines the permission model for `agent-workbench`.

The permission system is mandatory. It exists to ensure that file mutation, shell execution, and other risky operations cannot occur unless allowed by deterministic policy and, when required, approved by the user.

## 2. Core Permission Decisions

The permission engine must support exactly these decision classes:

```text
allow
ask
deny
```

### allow

The action may execute without prompting the user.

### ask

The action must pause and request explicit user approval.

### deny

The action must not execute.

## 3. Default Permission Posture

The confirmed default posture is:

```text
read: allow
grep: allow
glob: allow
edit: ask
write: ask
apply_patch: ask
bash: ask
destructive commands: deny unless explicitly configured
```

## 4. Permission Ownership

Future folder:

```text
packages/permissions
```

This package owns:

- Permission policy.
- Permission evaluation.
- Risk classification integration.
- Tool-level decisions.
- Path-level decisions.
- Command-level decisions.
- Agent-level decisions.
- Session override evaluation.
- Permission request construction.

It must not own:

- TUI modals.
- Shell execution.
- File patch application.
- Model calls.
- Storage schema.
- HTTP route definitions.

## 5. Required Permission Granularity

The selected granularity is:

```text
tool-level
path-level
command-level
agent-level
session override
```

### Tool-Level Examples

```text
read: allow
grep: allow
glob: allow
edit: ask
write: ask
apply_patch: ask
bash: ask
```

### Path-Level Examples

Provisional examples:

```text
docs/**: allow edit after approval
src/**: ask edit
.env: deny read/write unless explicitly configured
.git/**: deny mutation
node_modules/**: deny mutation
```

Exact patterns are unresolved.

### Command-Level Examples

Provisional examples:

```text
git status: allow
bun test: allow after configured
npm test: allow after configured
rm -rf *: deny
git push: ask
package install: ask
curl | sh: deny or ask with high risk
```

Exact command policy is unresolved.

### Agent-Level Examples

Initial agent posture:

| Agent | Read | Edit/Patch | Bash | Notes |
|---|---|---|---|---|
| Build | allow | ask | ask | Main implementation agent |
| Plan | allow | deny or ask | ask | Planning-first, restricted mutation |

The exact Plan edit/bash posture must be finalized during agent model design.

## 6. Permission Evaluation Flow

```text
1. Core receives tool request.
2. Tool input is validated.
3. Permission request is created.
4. Permission engine evaluates:
   - tool rule
   - path rule
   - command rule
   - agent rule
   - session override
   - risk classification
5. Engine returns allow, ask, or deny.
6. If allow, execution proceeds.
7. If ask, runtime pauses and emits permission request event.
8. TUI displays approval modal.
9. User approves or denies.
10. Decision is persisted.
11. Ledger records request and decision.
12. Runtime continues or blocks action.
```

## 7. Permission Request Requirements

A permission request must include, at minimum:

```text
request id
session id
run id
agent id
tool name
action type
risk level
reason
target paths if any
command if any
normalized command if any
diff summary if any
dry-run summary if any
created timestamp
```

Exact schema is deferred to `docs/07_API_CONTRACT_PLAN.md`.

## 8. Permission Decision Requirements

A permission decision must include, at minimum:

```text
decision id
request id
decision: allow | deny
decided by: user | policy | system
scope: once | session | project | global
optional reason
created timestamp
```

Exact schema is deferred to `docs/07_API_CONTRACT_PLAN.md`.

## 9. Risk Levels

Provisional risk levels:

```text
low
medium
high
critical
```

### Low Risk

Examples:

```text
read project file
grep project files
glob file paths
git status
```

### Medium Risk

Examples:

```text
run tests
edit non-sensitive project file
write docs
install package
```

### High Risk

Examples:

```text
modify source files
run migration
delete files
change lockfiles
run command with network side effects
```

### Critical Risk

Examples:

```text
rm -rf
delete project directory
exfiltrate env files
curl pipe shell
git push
change auth/secrets files
```

Exact risk classification is unresolved.

## 10. Destructive Command Policy

Destructive commands must default to deny unless explicitly configured.

Potential destructive patterns:

```text
rm -rf
sudo rm
chmod -R
chown -R
mkfs
dd
git reset --hard
git clean -fd
git push --force
truncate
shred
```

This list is provisional and must be expanded in Phase 10.

## 11. Sensitive Path Policy

Sensitive paths should be denied or ask-gated.

Provisional sensitive paths:

```text
.env
.env.*
*.pem
*.key
*.p12
*.sqlite
*.db
.git/**
.ssh/**
node_modules/**
dist/**
build/**
coverage/**
```

Exact path rules are unresolved.

## 12. TUI Approval Rules

The TUI may render:

- Tool name.
- Risk level.
- Reason.
- Command preview.
- Path preview.
- Diff preview.
- Dry-run summary.
- Approval buttons.
- Deny buttons.
- Scope options if supported later.

The TUI may not:

- Compute the permission result.
- Change the risk level.
- Hide risk details.
- Execute the action.
- Persist the decision directly.
- Override backend policy.

## 13. Audit Requirements

Every permission flow must write ledger records for:

```text
permission_requested
permission_decided
permission_denied
permission_expired if applicable
permission_overridden if applicable
```

Exact ledger event names are provisional.

## 14. Session Overrides

Session-level permission overrides are allowed as a future feature, but they must be explicit and ledgered.

Examples:

```text
allow bun test for this session
allow edits under docs/ for this session
deny all bash for this session
```

Session overrides must not silently become global policy.

## 15. Global and Project Policy

Future config may include:

```text
global user policy
project policy
runtime overrides
session overrides
```

Recommended precedence:

```text
hard denies
  ↓
session overrides
  ↓
project policy
  ↓
global policy
  ↓
defaults
```

This precedence is provisional and must be confirmed in config design.

## 16. Acceptance Criteria

The permission model is valid when:

```text
[ ] Every risky tool request is evaluated.
[ ] File mutation cannot bypass permissions.
[ ] Shell execution cannot bypass permissions.
[ ] TUI cannot decide permissions.
[ ] Denied actions never execute.
[ ] Ask-gated actions pause runtime.
[ ] Decisions are persisted.
[ ] Ledger records permission requests and decisions.
```

## 17. Exit Gate for Phase 8

Phase 8 is complete only when:

```text
[ ] PermissionEngine exists.
[ ] Tool-level rules exist.
[ ] Path-level rules exist.
[ ] Command-level rules exist.
[ ] Agent-level rules exist.
[ ] Permission events exist.
[ ] TUI approval flow exists.
[ ] Storage persists permission requests and decisions.
[ ] Deny is enforced.
[ ] Ask pauses execution.
```

## 18. Anti-Patterns

Do not:

- Let the model decide whether a command is safe.
- Treat approval prompts as optional for ask-gated actions.
- Let TUI compute policy.
- Let route handlers bypass permission engine.
- Allow bash by default.
- Allow file mutation by default.
- Persist broad approvals silently.
- Apply session overrides globally.
- Hide critical-risk details from the user.

## 19. Open Questions

| ID | Question | Status |
|---|---|---|
| PERM-001 | Exact policy file syntax | Unresolved |
| PERM-002 | Exact precedence order | Provisional |
| PERM-003 | Exact risk levels | Provisional |
| PERM-004 | Exact sensitive path list | Unresolved |
| PERM-005 | Exact destructive command list | Unresolved |
| PERM-006 | Whether approval scopes include once/session/project/global initially | Unresolved |

## 20. Agent Instructions

Future agents must:

1. Implement permissions before mutation tools.
2. Implement permissions before shell execution.
3. Keep permission logic outside the TUI.
4. Persist all permission decisions.
5. Ledger all permission requests.
6. Prefer conservative defaults.
7. Mark policy uncertainties as unresolved.

## 21. Validation Checklist

```text
[ ] allow/ask/deny are defined.
[ ] Default posture is documented.
[ ] Tool/path/command/agent granularity is documented.
[ ] TUI limitations are documented.
[ ] Ledger requirements are documented.
[ ] Open questions are marked.
```
