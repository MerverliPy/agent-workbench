# Test Verification Guide

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

6. **Revert every intentional break before final validation**
   ```bash
   git checkout .
   bun run test
   ```

**Important**: Intentional source mutation checks are manual unless a future opt-in script is explicitly approved.
Do not commit mutated source. Always verify clean state after verification.
