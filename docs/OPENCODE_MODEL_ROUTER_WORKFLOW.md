# OpenCode Live-Provider Workflow for model-router v3.3

## Current environment

Generated from the local OpenCode diagnostic log.

- Target repo: `$REPO_ROOT` (repository root)
- Router package: `$REPO_ROOT/tools/model-router-v3.3-repo-ready`
- Default implementation model: `deepseek/deepseek-v4-flash`
- Small/cheap model: `opencode-go/deepseek-v4-flash`
- Router/planning model: `deepseek/deepseek-v4-pro`
- Build model: `deepseek/deepseek-v4-flash`
- Review model: `deepseek/deepseek-v4-pro`

## Available-provider interpretation

This setup assumes the currently connected live providers are:

- DeepSeek API
- OpenCode Go API
- GitHub Copilot OAuth

Direct OpenAI, Anthropic, Google, and OpenRouter were not treated as configured unless `opencode models` lists them.

Because Copilot is treated by the router as inline-helper-only for autonomous repo work, this workflow uses DeepSeek/OpenCode-Go models for router/build/review commands by default.

## Created files

```text
opencode.json
.opencode/commands/model-router.md
.opencode/commands/route-build.md
.opencode/commands/route-review.md
.opencode/commands/router-benchmark.md
docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md
```

## Safety config

`opencode.json` requires approval for:

- file edits
- shell commands
- web fetches

This keeps OpenCode aligned with model-router v3.3 approval gates.

## Daily workflow

Start from the repo root:

```bash
git status --short --branch
opencode
```

Inside OpenCode:

```text
/model-router Fix the failing test in the provider registry
```

Read the router output. If the route is acceptable:

```text
/route-build Use the approved route to fix the failing provider-registry test. Plan first and ask before edits.
```

After implementation:

```text
/route-review Review the completed diff for correctness, regression risk, and scope creep.
```

## Model selection notes

Use `/models` inside OpenCode when you want to manually switch models.

Recommended live mappings for this environment:

| Router purpose | Live OpenCode model |
|---|---|
| Normal implementation | `deepseek/deepseek-v4-flash` |
| Cheap/small fallback | `opencode-go/deepseek-v4-flash` |
| Hard routing / planning | `deepseek/deepseek-v4-pro` |
| Final review | `deepseek/deepseek-v4-pro` |
| Copilot inline helper | GitHub Copilot models only for inline/help tasks |

## Benchmark workflow

The active benchmark file is:

```text
$REPO_ROOT/tools/model-router-v3.3-repo-ready/benchmarks/model-router-bench-tests-v3.2.jsonl
```

The active grader is:

```text
$REPO_ROOT/tools/model-router-v3.3-repo-ready/grader/model_router_grader.py
```

The v3.3 response template is:

```text
$REPO_ROOT/tools/model-router-v3.3-repo-ready/templates/model-router-real-responses-template-v3.3.jsonl
```

To validate the benchmark file:

```bash
python3 "$REPO_ROOT/tools/model-router-v3.3-repo-ready/grader/model_router_grader.py" \
  --benchmark "$REPO_ROOT/tools/model-router-v3.3-repo-ready/benchmarks/model-router-bench-tests-v3.2.jsonl" \
  --validate-benchmark
```

To grade collected v3.3 responses:

```bash
python3 "$REPO_ROOT/tools/model-router-v3.3-repo-ready/grader/model_router_grader.py" \
  --benchmark "$REPO_ROOT/tools/model-router-v3.3-repo-ready/benchmarks/model-router-bench-tests-v3.2.jsonl" \
  --grade model-router-real-responses-v3.3.jsonl \
  --report "$REPO_ROOT/tools/model-router-v3.3-repo-ready/reports/model-router-real-grade-report-v3.3.md" \
  --json "$REPO_ROOT/tools/model-router-v3.3-repo-ready/reports/model-router-real-grade-report-v3.3.json"
```

## Git workflow

Before using OpenCode:

```bash
git status --short --branch
```

After changes:

```bash
git diff --stat
git diff
```

Commit only after review:

```bash
git add opencode.json .opencode/commands docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md
git commit -m "Add OpenCode model-router workflow"
```

## Important caution

Your diagnostic log showed existing modified source files before this setup. Review the current diff before committing these config/workflow files.
