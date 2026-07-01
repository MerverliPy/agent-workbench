# model-router v3.3 Change Log

## Source

- Base router: `model-router-fixed-v3.2.md`
- Improvement plan: `model-router-v3.3-improvement-plan.md`
- Corrected grader baseline: `model-router-real-grade-report-v3.2.1-chatgpt-executed.md`

## Validation baseline

The corrected v3.2.1 grader report showed:

- Cases: 40
- Passed: 40
- Failed: 0
- Average score: 100/100

This was a ChatGPT-executed benchmark pass, not an independent opencode-client benchmark.

## Changes in v3.3

- Added mandatory pre-route classification before model selection.
- Added conflict-resolution order: safety, freshness, privacy, repo impact, task type, budget, user preference, provider availability.
- Added hard-fail pre-checks for Copilot-primary misuse, unsafe local-only final authority, missing current-research detection, missing approval gates, and output-schema drift.
- Added current-research and destructive-risk trigger lists.
- Added privacy-vs-risk matrix.
- Added internal candidate route scoring.
- Added v3.3 tie-break rules.
- Tightened confidence scoring definitions.
- Reworked required output format while preserving v3.2.1 grader-required sections.
- Added `Provider / Model Selection` and `Safety / Failure Checks` sections.
- Added `Forbidden Routes`, `Risk Ceiling Fit`, and `Availability Note` fields.
- Preserved expanded LLM registry and capability-tag routing from v3.2.

## Compatibility notes

- `model_router_grader_v3_2_1.py` remains compatible because v3.3 preserves all v3.2.1 required output sections.
- v3.3 adds fields that are not yet scored by v3.2.1. A future `model_router_grader_v3_3.py` should score these fields directly.
- v3.3 does not add new benchmark cases. Future v3.3 benchmark cases should focus on privacy conflicts, current model availability, Copilot-primary traps, OpenRouter access-layer handling, and research-to-implementation workflows.
