# Model Router Grader v3.3 Package

This package upgrades the corrected v3.2.1 grader to target `model-router-fixed-v3.3.md`.

## Files

- `model_router_grader_v3_3.py` — v3.3-aware grader.
- `model-router-grader-v3.2.1-to-v3.3.diff` — exact diff from v3.2.1.
- `model-router-grader-v3.3-change-log.md` — summary of changes.
- `model-router-grader-v3.3-validation.json` — validation results.
- `model-router-real-responses-template-v3.3-grader.jsonl` — blank response template.
- `model-router-prompt-template-v3.3-grader.jsonl` — prompt template for collecting router outputs.
- `model-router-real-grade-report-v3.3-PENDING.md` — placeholder until actual v3.3 responses are collected.

## Validate benchmark

```bash
python model_router_grader_v3_3.py   --validate-benchmark   --benchmark model-router-bench-tests-v3.2.jsonl
```

## Grade real v3.3 responses

```bash
python model_router_grader_v3_3.py   --benchmark model-router-bench-tests-v3.2.jsonl   --grade model-router-real-responses-v3.3.jsonl   --report model-router-real-grade-report-v3.3.md   --json model-router-real-grade-report-v3.3.json
```

## Important

This grader is stricter than v3.2.1. It expects actual v3.3 router outputs to include the v3.3 safety/schema contract, especially:

- `Provider / Model Selection`
- `Safety / Failure Checks`
- `Provider Registry Match`
- `Forbidden Routes`
