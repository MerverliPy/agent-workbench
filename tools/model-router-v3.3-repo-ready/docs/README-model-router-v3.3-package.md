# Model Router v3.3 Package

This package contains the conservative v3.3 router hardening patch.

## Primary file

- `model-router-fixed-v3.3.md`

## Support files

- `model-router-v3.3-change-log.md`
- `model-router-v3.2-to-v3.3.diff`
- `model-router-v3.3-validation.json`
- `model-router-real-responses-template-v3.3.jsonl`
- `model-router-prompt-template-v3.3.jsonl`

## Why v3.3 exists

v3.2 already passed the corrected v3.2.1 ChatGPT-executed benchmark. v3.3 does not rewrite the router. It hardens predictable weak points before an independent opencode-client benchmark:

- safety/freshness/privacy conflict handling
- approval-gate consistency
- Copilot-primary prevention
- local-only final-authority prevention
- required output schema preservation
- provider candidate scoring and tie-breaking

## Recommended next validation command

```bash
python model_router_grader_v3_2_1.py   --grade model-router-real-responses-v3.3.jsonl   --benchmark model-router-bench-tests-v3.2.jsonl   --report model-router-real-grade-report-v3.3.md   --json model-router-real-grade-report-v3.3.json
```

Use `model-router-real-responses-template-v3.3.jsonl` as the starting file for real response collection.
