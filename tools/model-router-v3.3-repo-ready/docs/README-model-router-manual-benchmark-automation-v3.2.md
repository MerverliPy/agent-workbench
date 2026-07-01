# Model Router v3.2 Manual Benchmark Automation

## Purpose

This package helps run the real benchmark workflow for `model-router-fixed-v3.2.md` without pretending the script can call the router automatically.

It automates the manual parts:

- validate required files
- export copy/paste-ready prompt files
- initialize a response JSONL file
- collect pasted router outputs case by case
- track missing responses
- run the v3.2 grader after responses are filled

## Required files

Place these files in the same folder:

- `model-router-fixed-v3.2.md`
- `model-router-bench-tests-v3.2.jsonl`
- `model_router_grader_v3_2.py`
- `collect_model_router_benchmark_v3_2.py`

## Recommended command sequence

```bash
python collect_model_router_benchmark_v3_2.py all
```

This validates the setup, creates a blank response file, exports prompt files, and shows progress.

Then collect each router output:

```bash
python collect_model_router_benchmark_v3_2.py collect-next
```

Paste the router output, then finish with:

```text
<<<END>>>
```

Repeat `collect-next` until all cases are complete.

Check progress anytime:

```bash
python collect_model_router_benchmark_v3_2.py status
```

Run the real grader:

```bash
python collect_model_router_benchmark_v3_2.py grade
```

Expected outputs:

- `model-router-real-responses-v3.2.jsonl`
- `model-router-real-grade-report-v3.2.md`
- `model-router-real-grade-report-v3.2.json`
- `model-router-manual-prompts-v3.2/`

## Prompt export behavior

By default, exported prompt files include the full router prompt under test plus the benchmark case.

To create smaller prompt files that assume the router is already loaded elsewhere:

```bash
python collect_model_router_benchmark_v3_2.py export-prompts --no-router-in-prompts
```

## Collect a specific case

```bash
python collect_model_router_benchmark_v3_2.py collect --case-id MRV3-001
```

Overwrite a captured response:

```bash
python collect_model_router_benchmark_v3_2.py collect --case-id MRV3-001 --replace
```

## Important limitation

This is a manual benchmark-collection helper. It does not call OpenAI, opencode, Claude, Gemini, DeepSeek, or any other LLM provider. That is intentional. The goal is to preserve a clean, auditable response file that can be graded with `model_router_grader_v3_2.py`.
