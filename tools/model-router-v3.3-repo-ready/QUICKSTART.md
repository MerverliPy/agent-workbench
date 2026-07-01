# Quickstart

## 1. Use the active router

Use:

```text
prompts/model-router.md
```

as the active opencode model-router prompt.

## 2. Collect real outputs

Use the prompts in:

```text
manual-prompts/model-router-manual-prompts-v3.2/
```

Paste results into a copy of:

```text
templates/model-router-real-responses-template-v3.3.jsonl
```

## 3. Grade outputs

```bash
python grader/model_router_grader.py   --bench benchmarks/model-router-bench-tests-v3.2.jsonl   --responses model-router-real-responses-v3.3.jsonl   --report reports/model-router-real-grade-report-v3.3.md   --json reports/model-router-real-grade-report-v3.3.json
```
