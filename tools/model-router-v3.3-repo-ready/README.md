# Model Router v3.3 Repo-Ready Package

This repository package contains the current `model-router` prompt system, benchmark assets, grader, validation files, and documentation for an opencode-oriented model-routing workflow.

## Current primary version

- Router prompt: `prompts/model-router.md`
- Grader: `grader/model_router_grader.py`
- Benchmark set: `benchmarks/model-router-bench-tests-v3.2.jsonl`
- Response template: `templates/model-router-real-responses-template-v3.3.jsonl`

## What this package is for

Use this package to evaluate and maintain a model router that chooses the best model/workflow route for coding, research, review, local/private, final-verification, and opencode-related tasks.

The router should route tasks. It should not execute the coding/research task itself.

## Quick start

From this repo root:

```bash
python grader/model_router_grader.py   --bench benchmarks/model-router-bench-tests-v3.2.jsonl   --responses templates/model-router-real-responses-template-v3.3.jsonl   --report reports/model-router-real-grade-report-v3.3.md   --json reports/model-router-real-grade-report-v3.3.json
```

The template is blank. Fill it with real router outputs before expecting a meaningful score.

## Recommended manual benchmark workflow

1. Open `prompts/model-router.md`.
2. Use each case from `manual-prompts/model-router-manual-prompts-v3.2/`.
3. Paste each router output into `templates/model-router-real-responses-template-v3.3.jsonl` or a copy named `model-router-real-responses-v3.3.jsonl`.
4. Run the grader.
5. Use failures to patch the next router version.

## Important validation note

The current v3.2.1 baseline report passed 40/40 in a ChatGPT-executed benchmark run. That is not an independent opencode-client run. For formal evidence, run the same prompts through the target opencode/client/model environment and grade those outputs.

## Suggested repo layout

```text
prompts/       Router prompts. `model-router.md` is the active prompt.
grader/        Grader script and versioned grader files.
benchmarks/    JSONL benchmark cases.
templates/     Blank response and prompt templates.
manual-prompts/ Copy/paste-ready individual benchmark prompts.
reports/       Pending and completed grade reports.
docs/          Design docs, registry plan, and improvement plans.
changelogs/    Version changelogs.
diffs/         Version diffs.
validation/    Structural validation JSON files.
scripts/       Manual collection helper scripts.
archives/      Prior generated ZIP packages.
```

## Next recommended work

- Add v3.3-specific benchmark cases.
- Run an independent opencode/client benchmark collection.
- Patch based on real failures.
- Only then create v3.4 or declare v3.3 stable.
