# Model Router v3.2 Benchmark Upgrade Package

This package implements the selected next steps:

- A. Upgrade grader for v3.2 registry fields.
- B. Add expanded-LLM benchmark cases.
- D. Run real benchmark workflow setup.

## Included files

- `model_router_grader_v3_2.py`
- `model-router-bench-tests-v3.2.jsonl`
- `model-router-real-benchmark-workflow-v3.2.md`
- `model-router-benchmark-prompts-v3.2.md`
- `model-router-real-responses-template-v3.2.jsonl`
- `model-router-prompt-template-v3.2.jsonl`
- `model-router-v3.2-benchmark-upgrade-validation.json`
- `model-router-fixed-v3.2.md` when available in the same workspace

## Main commands

Validate benchmark:

```bash
python model_router_grader_v3_2.py --validate-benchmark --benchmark model-router-bench-tests-v3.2.jsonl
```

Create a fresh response template:

```bash
python model_router_grader_v3_2.py --write-response-template model-router-real-responses-template-v3.2.jsonl --benchmark model-router-bench-tests-v3.2.jsonl
```

Grade filled real responses:

```bash
python model_router_grader_v3_2.py --grade model-router-real-responses-v3.2.jsonl --benchmark model-router-bench-tests-v3.2.jsonl --report model-router-real-grade-report-v3.2.md --json model-router-real-grade-report-v3.2.json
```

## Benchmark status

The v3.2 benchmark contains 40 cases total: 25 inherited v3 cases and 15 expanded-LLM registry cases.

This package does not claim a real router score. It creates the workflow and tooling needed to produce one from actual router outputs.
