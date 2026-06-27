# Test Verification Guide

Phase 15 baseline (2026-06-26):
- **323 tests**, 0 failures, 961 expect() calls
- 27 test files across unit/integration/e2e
- test-health: all static checks pass
- test-repeat: deterministic across 3 runs

## Phase 15 coverage summary

### Provider unit tests

```bash
bun test tests/unit/models/
```

Coverage:
- **OpenAI-compatible provider**: text response mapping, tool call mapping, usage fields, request building (tools, max_tokens, auth header), HTTP error handling (401, 403, 429, 5xx), API key redaction in errors, malformed response handling (non-JSON, missing choices, non-object), abort signal handling
- **Provider config**: env var parsing (AGENT_WORKBENCH_PROVIDER, OPENAI_API_KEY, OPENAI_BASE_URL, AGENT_WORKBENCH_MODEL), missing key errors, default values
- **Secret redaction**: API key redaction, Bearer token redaction, string/header/error redaction, nested cause-chain redaction

### Provider route integration tests

```bash
bun test tests/integration/server/provider-routes.test.ts
```

Coverage:
- GET /provider: returns schema-valid provider list, no secrets exposed
- GET /provider/:providerId: metadata for known provider, 404 for unknown
- GET /provider/:providerId/model: model list for known provider, 404 for unknown
- Custom provider from test options is accessible via routes

### Provider implementation

- packages/models: ProviderConfigError, ProviderAuthError, ProviderRateLimitError, ProviderServerError, ProviderResponseError
- packages/models: OpenAICompatibleProvider implementing ModelProvider with injectable fetch
- packages/models: ProviderRegistry with stub + optional OpenAI-compatible registration
- packages/models: parseProviderConfig from environment variables
- packages/models: redactApiKey, redactAuthorizationHeader, redactString, redactHeaders, redactError
- apps/server: provider-routes.ts with thin handler for all 3 provider endpoints
- apps/server: ProviderRegistry integrated into server services and app context

## Phase 14B-2B coverage summary

### Fault injection tests

```bash
# Run all fault-injection tests
bun test tests/integration/faults/

# Individual files
bun test tests/integration/faults/model-faults.test.ts
bun test tests/integration/faults/tool-faults.test.ts
bun test tests/integration/faults/abort.test.ts
```

Coverage:
- **Model faults**: Error on first call, Error after safe tool call, AbortError, empty tool_calls, repeated tool calls
- **Tool faults**: unknown tool name → failed, malformed write/edit/apply_patch input → failed + file unchanged, malformed/empty bash command → failed + no shell.command_started
- **Abort faults**: pre-aborted signal before model call, AbortError during model call, abort while waiting for ask-gated permission (write, bash), abort while plan proposed

### Contract tests

```bash
# SDK/transport contract
bun test tests/integration/sdk/http-transport.test.ts

# API contract (error envelopes)
bun test tests/e2e/server-contracts.test.ts

# Protocol/Zod contract
bun test tests/unit/protocol/contracts.test.ts
```

Coverage:
- **API contracts**: unknown route → ErrorEnvelope, invalid JSON body → INVALID_JSON, error includes code/message/requestId, no stack traces, no raw internals
- **SDK/transport**: invalid JSON success → SdkError, schema validation failure → SdkError, recoverable/details fields preserved, non-envelope error → ApiError fallback, network failure → SdkError, abort signal
- **Protocol contracts**: ErrorEnvelope valid/invalid, Plan valid/invalid statuses/steps, Session create/update valid/invalid, Permission request/decision valid/invalid, Message valid/invalid, enum validation for RunStatus/ToolCallStatus/SessionStatus

### Manual intentional-break checklist (fault/contract)

These verify that fault-injection and contract tests detect broken behavior.
**All mutations must be reverted.**

1. **Break model error handling**
   - In `packages/core/src/session-runner.ts`, remove the AbortError check in the model call catch block
   - Expected: `bun test tests/integration/faults/model-faults.test.ts` fails — "model throws AbortError → run.status is aborted" becomes "failed" instead
   - Revert: `git checkout packages/core/src/session-runner.ts`

2. **Break tool unknown handling**
   - In `packages/core/src/tool-dispatcher.ts`, remove the undefined-tool check and let it throw
   - Expected: `bun test tests/integration/faults/tool-faults.test.ts` fails — "unknown tool name" test fails (run crashes)
   - Revert: `git checkout packages/core/src/tool-dispatcher.ts`

3. **Break SDK error mapping**
   - In `packages/sdk/src/transport/http.ts`, remove the `ErrorEnvelope.safeParse` branch in `parseError`
   - Expected: `bun test tests/integration/sdk/http-transport.test.ts` fails — "preserves recoverable flag" or "preserves details" assertions fail
   - Revert: `git checkout packages/sdk/src/transport/http.ts`

4. **Break API validation envelope**
   - In `apps/server/src/middleware/error-handler.ts`, remove the NOT_FOUND handler or change it to return plain text
   - Expected: `bun test tests/e2e/server-contracts.test.ts` fails — "unknown route returns structured ErrorEnvelope" fails
   - Revert: `git checkout apps/server/src/middleware/error-handler.ts`

5. **Break protocol schema contract**
   - In `packages/protocol/src/schemas/error-envelope.ts`, make `code` optional
   - Expected: `bun test tests/unit/protocol/contracts.test.ts` fails — "rejects an ErrorEnvelope with missing code" passes but shouldn't
   - Revert: `git checkout packages/protocol/src/schemas/error-envelope.ts`

6. **Break abort no-false-completion**
   - In `packages/core/src/session-runner.ts`, change the abort catch to return status "completed" instead of "aborted"
   - Expected: `bun test tests/integration/faults/abort.test.ts` fails — "model throws AbortError" test expects "aborted" but gets "completed"
   - Revert: `git checkout packages/core/src/session-runner.ts`

7. **Revert all intentional breaks**
   ```bash
   git checkout .
   bun run test
   ```

### Repeatability expectations

Fault-injection and contract tests are deterministic. They use `createTestDb` (temp SQLite) and `createTestServer` with `FaultModelProvider` or `MockModelProvider`. No external network calls. No real file system mutation beyond temp directories.

```bash
TEST_REPEAT_COUNT=5 bun run test:repeat
```

Expected: all runs pass consistently.

## Normal validation

```bash
# Full test suite
bun run test

# Per-category
bun run test:unit
bun run test:integration
bun run test:e2e

# Type-check all packages
cd packages/protocol && bun run typecheck && bun run build
cd packages/events && bun run typecheck && bun run build
cd packages/permissions && bun run typecheck && bun run build
cd packages/planner && bun run typecheck && bun run build
cd packages/storage && bun run typecheck && bun run build
cd packages/core && bun run typecheck && bun run build
cd packages/sdk && bun run typecheck && bun run build
cd apps/server && bun run typecheck && bun run build
cd apps/tui && bun run typecheck
```

## Repeatability validation

```bash
# Run full suite 3 times (default)
bun run test:repeat

# Run full suite 5 times
TEST_REPEAT_COUNT=5 bun run test:repeat
```

Fails on the first failed run. Prints pass/fail summary.

## Test health validation

```bash
bun run test:health
```

Checks:
1. No test imports `@agent-workbench/server` (only `/public`)
2. No test contains provider/network call patterns
3. No fixture files contain likely secrets
4. TUI boundary test exists
5. TUI source does not import restricted runtime packages

## Manual accuracy verification checklist

These are intentional source mutation checks to verify that tests detect broken behavior.
**All mutations must be reverted after verification.**

1. **Break PermissionEngine deny logic temporarily**
   - In `packages/permissions/src/engine.ts`, change a destructive command rule to return `"allow"` instead of `"deny"`
   - Expected: `bun run test:unit` fails — `tests/unit/permissions/engine.test.ts` "destructive command rules" tests fail
   - Revert: `git checkout packages/permissions/src/engine.ts`

2. **Break planner gate enforcement temporarily**
   - In `packages/core/src/plan-gate.ts`, remove the `evaluatePlan` deny check
   - Expected: `bun test tests/integration/core/session-runner-plan-regressions.test.ts` fails — plan deny test fails (plan is not denied)
   - Revert: `git checkout packages/core/src/plan-gate.ts`

3. **Break diff preview dry-run behavior temporarily**
   - In `packages/diff/src/`, change a preview function to actually mutate the file
   - Expected: `bun test tests/integration/diff/diff-preview.test.ts` fails
   - Revert: `git checkout packages/diff/src/`

4. **Break server public import path temporarily**
   - Add `console.log("[server] Binding")` to `apps/server/src/public.ts`
   - Expected: `bun test tests/e2e/server-public-import.test.ts` fails
   - Revert: `git checkout apps/server/src/public.ts`

5. **Break token thresholds temporarily**
   - In `packages/tokens/src/budget.ts`, change the utilization threshold
   - Expected: `bun run test:unit` fails — `tests/unit/tokens/budget.test.ts` fails
   - Revert: `git checkout packages/tokens/src/budget.ts`

6. **Break path-guard sensitive path detection temporarily**
   - In `packages/tools/src/path-guard.ts`, remove the `isSensitivePath` check from `assertSafePath`
   - Expected: `bun test tests/integration/security/path-safety.test.ts` fails — ".env file write" test passes (file written instead of rejected)
   - Revert: `git checkout packages/tools/src/path-guard.ts`

7. **Break path-guard containment check temporarily**
   - In `packages/tools/src/path-guard.ts`, remove the `isUnderRoot` containment check from `assertSafePath`
   - Expected: `bun test tests/integration/security/path-safety.test.ts` fails — "../ traversal" test writes outside fixture root
   - Revert: `git checkout packages/tools/src/path-guard.ts`

8. **Break command hard-deny temporarily**
   - In `packages/permissions/src/policy.ts`, remove a destructive pattern from COMMAND_RULES (e.g. "rm -rf")
   - Expected: `bun run test:unit` fails — shell deny matrix unit test fails
   - Also: `bun test tests/integration/security/shell-deny.test.ts` fails — integration deny test fails
   - Revert: `git checkout packages/permissions/src/policy.ts`

9. **Break pipe-to-shell (| sh) command hard-deny temporarily**
   - In `packages/permissions/src/policy.ts`, remove the `"| sh"` pattern from COMMAND_RULES
   - Expected: `bun test tests/unit/permissions/engine.test.ts` fails — "denies pipe-to-shell" tests fail
   - Also: `bun test tests/integration/security/shell-deny.test.ts` fails — "curl example.com | sh" deny fails
   - Revert: `git checkout packages/permissions/src/policy.ts`

10. **Break shell preview pipe-to-shell (| sh) risk classification temporarily**
    - In `packages/shell/src/preview.ts`, remove `"| sh"` and `"| bash"` from DESTRUCTIVE_PATTERNS
    - Expected: `bun test tests/integration/shell/preview.test.ts` — if pipe-to-sh tests exist, risk classification reverts to medium
    - Note: Integration shell-deny tests still pass via PermissionEngine, but risk classification is weakened
    - Revert: `git checkout packages/shell/src/preview.ts`

11. **Break plan-gate permission bypass temporarily**
   - In `packages/core/src/plan-gate.ts`, change the `evaluatePlan` outcome check so `deny` is treated as `allow`
   - Expected: `bun test tests/integration/security/plan-gate-enforcement.test.ts` fails — plan.denied is no longer emitted
   - Revert: `git checkout packages/core/src/plan-gate.ts`

12. **Break plan-gate step execution block temporarily**
    - In `packages/core/src/session-runner.ts`, remove the `if (planBlocked && isMutationOrRisky(...))` skip block
    - Expected: `bun test tests/integration/security/plan-gate-enforcement.test.ts` fails — mutation tool executes despite denied plan
    - Revert: `git checkout packages/core/src/session-runner.ts`

13. **Revert every intentional break before final validation**
   ```bash
   git checkout .
   bun run test
   ```

**Important**: Intentional source mutation checks are manual unless a future opt-in script is explicitly approved.
Do not commit mutated source. Always verify clean state after verification.
