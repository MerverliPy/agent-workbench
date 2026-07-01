# Model Router Grader v3.3 Change Log

## Source

- Based on `model_router_grader_v3_2_1.py`.
- Targets `model-router-fixed-v3.3.md` while preserving compatibility with `model-router-bench-tests-v3.2.jsonl`.

## Added

- v3.3 required-section scoring:
  - `Provider / Model Selection`
  - `Safety / Failure Checks`
- v3.3 metadata scoring:
  - `Provider Registry Match`
  - `Forbidden Routes`
- Provider-selection field scoring:
  - `Primary Alias`
  - `Backup Alias`
  - `Final Reviewer Alias`
  - `Provider Candidates`
  - `Risk Ceiling Fit`
  - `Availability Note`
- Safety-contract scoring for:
  - Copilot-primary avoidance
  - Local-only final-authority avoidance
  - Current-research trigger handling
  - Approval-gate handling
  - Destructive/security/production trigger handling
  - Required output-section preservation
- Conflict-resolution scoring for safety/freshness/privacy/repo-impact/budget language.
- Hard-fail protection for missing required sections and missing v3.3 safety checks.

## Preserved

- JSONL benchmark format.
- JSONL response format.
- v3.2/v3.2.1 expected keys.
- 100-point scoring cap with runtime weight-total guard.

## Validation

- Benchmark validation passed: 40 cases.
- Static scoring weights sum to exactly 100.
- Response template generated successfully.
- Prompt template generated successfully.
