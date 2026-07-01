# Model Router Grader v3.2.1 Change Log

## Purpose

Fix the v3.2 grader scoring-weight bug while preserving the existing v3.2 benchmark and response schema.

## Bug Fixed

- **Issue:** v3.2 static scoring weights summed to 110 points while reports labeled scores as `/100`.
- **Impact:** Fully passing responses could show raw scores above 100, creating misleading grade reports.
- **Fix:** Rebalanced scoring categories so static weights sum to exactly 100 points.
- **Guardrail Added:** Runtime assertion raises an error if future weight edits do not sum to 100.

## New Weight Distribution

| Category | Points |
|---|---:|
| Format and schema | 18 |
| Core route correctness | 29 |
| Context/risk classification | 18 |
| Expanded registry/capability checks | 19 |
| Safety and benchmark-specific requirements | 16 |
| **Total** | **100** |

## Compatibility

- Keeps the same benchmark JSONL format.
- Keeps the same response JSONL format.
- Keeps hard-fail checks for approval, forbidden content, risk-level mismatch, and current-research mismatch.
- Keeps v3.2 registry/capability checks.

## Validation Result

- Benchmark cases: 40
- Passed: 40
- Failed: 0
- Average score: 100/100
- Weight total: 100

## Limitation

The included validation report grades the ChatGPT-executed filled response file from this session. It does not replace an independent opencode-client benchmark collection run.
