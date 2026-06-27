# 16 — Testing Strategy

Status: Phase 15 complete
Document type: agent-ready testing strategy
Scope: unit, integration, e2e, security, boundary, storage, tool, fault injection, and contract tests

## 1. Purpose

This document defines the testing strategy for `agent-workbench`.

The system is safety-sensitive because it will eventually inspect files, modify files, and run shell commands. Testing must verify boundaries, permissions, storage, tool behavior, and runtime flows.

## 2. Confirmed Direction

Testing should be organized into:

```text
unit tests
integration tests
end-to-end tests
fixtures
boundary checks
security checks
phase exit validation
```

Testing files must not be created during Phase 0.

## 3. Future Test Tree

Target tree after implementation phases begin:

```text
tests/
├─ unit/
│  ├─ protocol/
│  ├─ permissions/
│  ├─ tools/
│  ├─ tokens/
│  ├─ planner/
│  ├─ cache/
│  └─ diff/
├─ integration/
│  ├─ server/
│  ├─ sdk/
│  ├─ storage/
│  ├─ core-runtime/
│  └─ shell/
├─ e2e/
│  ├─ tui-startup.test.ts
│  ├─ prompt-readonly-flow.test.ts
│  ├─ permission-approval-flow.test.ts
│  ├─ patch-preview-flow.test.ts
│  └─ token-health-flow.test.ts
└─ fixtures/
   ├─ sample-project/
   ├─ sample-diffs/
   ├─ sample-tool-results/
   └─ sample-sessions/
```

This tree is target-state only. Do not create it during Phase 0.

## 4. Testing Principles

Tests must verify:

```text
TUI is thin client
server validates API requests
core owns runtime
permissions gate risky actions
denied actions do not execute
ask-gated actions pause
file mutation requires diff preview
shell requires risk classification
ledger records risky actions
token-health controls large context
cache invalidates on mutation
```

## 5. Unit Tests

Unit tests should cover individual packages.

### Protocol Tests

Verify:

```text
schemas accept valid payloads
schemas reject invalid payloads
error envelopes are stable
event envelopes are stable
```

### Permission Tests

Verify:

```text
allow returns allow
ask creates permission request
deny blocks execution
path rules apply
command rules apply
agent rules apply
destructive commands deny by default
```

### Tool Tests

Verify:

```text
read respects path policy
grep returns structured matches
glob returns structured paths
large results compress
tool input validation works
tool failures are structured
```

### Diff Tests

Verify:

```text
patch preview works
patch apply works only after allowed flow
conflicts are detected
revert metadata is recorded
dry-run does not mutate files
```

### Token Tests

Verify:

```text
tool output truncation preserves metadata
context budget estimates usage
compaction suggestion triggers at threshold
summaries preserve required facts
```

### Cache Tests

Verify:

```text
read cache hits
grep cache hits
glob cache hits
cache invalidates after mutation
cache respects permission changes
```

## 6. Integration Tests

Integration tests should verify package interactions.

### Server + Protocol

```text
invalid request returns error envelope
valid request reaches handler
SSE stream opens
localhost binding is enforced
```

### SDK + Server

```text
SDK health call works
SDK session call works
SDK subscribes to events
SDK normalizes errors
```

### Core + Tools + Permissions

```text
read-only tool flow works
ask-gated tool pauses
denied tool does not execute
tool result is ledgered
```

### Storage + Core

```text
session persists
messages persist
tool calls persist
permission decisions persist
ledger entries persist
```

### Shell Integration

```text
command risk classification occurs
ask-gated command pauses
timeout aborts command
stdout/stderr stream
command result is ledgered
```

Shell integration tests must avoid destructive commands.

## 7. End-to-End Tests

E2E tests should validate user-visible flows.

Required E2E flows:

```text
TUI startup
server connection
prompt submission
read-only tool flow
permission approval flow
patch preview flow
shell approval flow later
token-health warning flow
run abort flow
```

TUI tests may require specialized tooling. Exact approach is unresolved.

## 8. Boundary Tests

Boundary checks are critical.

Required checks:

```text
TUI cannot import packages/tools
TUI cannot import packages/shell
TUI cannot import packages/storage
TUI cannot import permissions internals
server routes do not execute tools directly
tools do not bypass permissions
```

Potential tools:

```text
custom import checker
lint rules
dependency graph tool
package export restrictions
```

Exact tool is unresolved.

## 9. Security Tests

Security tests should verify:

```text
server binds localhost by default
CORS is restrictive by default
secrets are not returned by config/provider routes
sensitive paths are denied or ask-gated
destructive commands deny by default
ledger redacts known secret patterns
TUI cannot execute privileged actions
```

## 10. Fixture Strategy

Fixtures should include:

```text
small sample project
project with nested files
project with ignored files
project with fake sensitive files
sample grep outputs
sample diffs
sample shell outputs
sample session histories
```

Fake secrets must be clearly fake.

## 11. Model Provider Testing

Model provider tests should avoid depending on real provider calls by default.

Strategies:

```text
mock provider adapter
recorded fixtures if safe
local fake model responder
contract tests for provider adapter interface
```

Do not require real API keys for normal test suite.

## 12. Test Data Safety

Test data must not include:

```text
real API keys
real private source code
real personal data
real SSH keys
real environment files
```

## 13. Phase-Based Test Gates

### Phase 2

```text
[ ] Protocol schemas tested.
```

### Phase 3

```text
[ ] Server health route tested.
[ ] SSE route tested.
[ ] Request validation tested.
```

### Phase 4

```text
[ ] TUI startup smoke test planned or implemented.
```

### Phase 5

```text
[ ] Storage repositories tested.
```

### Phase 6

```text
[ ] Core prompt flow tested.
[ ] Abort tested.
```

### Phase 7

```text
[ ] read/grep/glob tested.
```

### Phase 8

```text
[ ] allow/ask/deny tested.
```

### Phase 9

```text
[ ] diff preview and patch apply tested.
```

### Phase 10

```text
[ ] command runner timeout/abort tested.
```

### Phase 11

```text
[ ] Build/Plan selection tested.
```

### Phase 12

```text
[ ] token-health status and compaction suggestion tested.
```

### Phase 13

```text
[ ] Plan validation tested.
[ ] Plan gate enforcement tested.
[ ] Plan permission integration tested.
[ ] Plan-level deny prevents execution.
```

### Phase 14A

```text
[ ] Session runner tested.
[ ] Tool dispatch tested.
[ ] Permission engine tested.
[ ] Path safety tested.
[ ] Diff preview tested.
[ ] Shell deny tested.
[ ] Boundary enforcement tested.
[ ] All tests use mock providers and temp resources.
```

### Phase 14B

```text
[ ] Regression tests for session-runner, plan gate, tool interaction paths.
[ ] Security tests for path safety, shell deny, plan-gate enforcement.
[ ] Fault injection tests for model faults, tool faults, abort scenarios.
[ ] Contract tests for SDK/transport, API error envelopes, protocol/Zod schemas.
[ ] Manual intentional-break verification procedures documented.
[ ] Test-repeat passes at default 3 runs.
[ ] Test-health passes all static checks.
```

### Phase 15

```text
[x] Unit tests for OpenAI-compatible provider adapter (text mapping, tool calls, error handling, abort, redaction).
[x] Unit tests for provider configuration parsing (env vars, missing key, defaults).
[x] Unit tests for secret redaction utilities (API keys, auth headers, error chains).
[x] Integration tests for provider routes (schema validation, secrets not exposed, 404 errors).
[x] All provider tests use fake fetch/mock HTTP only.
[x] No tests require OPENAI_API_KEY or network access.
[x] Existing Phase 14B fault/contract tests continue to pass.
[x] Test-repeat passes at default 3 runs.
[x] Test-health passes all static checks.
```

## 14. Acceptance Criteria

Testing strategy is valid when:

```text
[ ] Unit test targets are documented.
[ ] Integration test targets are documented.
[ ] E2E flows are documented.
[ ] Boundary tests are documented.
[ ] Security tests are documented.
[ ] Fixtures are documented.
[ ] Phase gates include test expectations.
```

## 15. Anti-Patterns

Do not:

- Test only happy paths.
- Require real model provider keys for normal tests.
- Use real secrets in fixtures.
- Skip boundary tests.
- Skip denied-action tests.
- Test TUI as if it owns runtime state.
- Implement shell tests with destructive commands.
- Let tests create Phase 0 implementation files.

## 16. Open Questions

| ID | Question | Status |
|---|---|---|
| TEST-001 | Exact test runner | Unresolved |
| TEST-002 | Exact TUI testing approach | Unresolved |
| TEST-003 | Exact boundary enforcement tool | Unresolved |
| TEST-004 | Real provider integration test policy | Unresolved |
| TEST-005 | Snapshot testing policy | Unresolved |
| TEST-006 | CI environment | Unresolved |

## 17. Agent Instructions

Future agents must:

1. Add tests with each implementation phase.
2. Test denied and ask-gated paths, not only allowed paths.
3. Use fake provider adapters.
4. Avoid real secrets in fixtures.
5. Preserve import-boundary tests.
6. Mark unresolved tooling choices before creating test infrastructure.

## 18. Validation Checklist

```text
[ ] Test categories are clear.
[ ] Package-level tests are described.
[ ] Security tests are described.
[ ] Boundary tests are described.
[ ] E2E flows are described.
[ ] Open questions are marked.
```
