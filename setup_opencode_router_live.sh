#!/usr/bin/env bash
set -euo pipefail
set +x
umask 077

# OpenCode + model-router v3.3 live-provider setup
# Run from the target repo root:
#   bash setup_opencode_router_live.sh

ROUTER_DIR="${ROUTER_DIR:-$HOME/agent-workbench/tools/model-router-v3.3-repo-ready}"
TARGET_REPO="${TARGET_REPO:-$(pwd)}"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$TARGET_REPO/.opencode/router-setup-backup-$TS"

DEFAULT_MODEL="${DEFAULT_MODEL:-deepseek/deepseek-v4-flash}"
SMALL_MODEL="${SMALL_MODEL:-opencode-go/deepseek-v4-flash}"
ROUTER_MODEL="${ROUTER_MODEL:-deepseek/deepseek-v4-pro}"
BUILD_MODEL="${BUILD_MODEL:-deepseek/deepseek-v4-flash}"
REVIEW_MODEL="${REVIEW_MODEL:-deepseek/deepseek-v4-pro}"

say() {
  printf '\n==> %s\n' "$1"
}

backup_file() {
  local f="$1"
  if [ -e "$f" ]; then
    mkdir -p "$BACKUP_DIR"
    cp -a "$f" "$BACKUP_DIR/"
    echo "Backed up: $f -> $BACKUP_DIR/"
  fi
}

say "Checking target repo"
cd "$TARGET_REPO"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: Run this from a Git repository root."
  echo "Current directory: $TARGET_REPO"
  exit 1
fi

say "Checking router package"
for f in \
  "$ROUTER_DIR/prompts/model-router.md" \
  "$ROUTER_DIR/grader/model_router_grader.py" \
  "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl" \
  "$ROUTER_DIR/templates/model-router-real-responses-template-v3.3.jsonl"
do
  if [ ! -f "$f" ]; then
    echo "ERROR: Missing required router file:"
    echo "$f"
    exit 1
  fi
done

say "Checking OpenCode"
if ! command -v opencode >/dev/null 2>&1; then
  echo "ERROR: opencode was not found on PATH."
  exit 1
fi

opencode --version || true

say "Checking required live models"
MODELS="$(opencode models 2>/dev/null || true)"

for m in "$DEFAULT_MODEL" "$SMALL_MODEL" "$ROUTER_MODEL" "$BUILD_MODEL" "$REVIEW_MODEL"; do
  if printf '%s\n' "$MODELS" | grep -Fxq "$m"; then
    echo "FOUND: $m"
  else
    echo "WARNING: model not listed by 'opencode models': $m"
    echo "You can override before running, for example:"
    echo "  ROUTER_MODEL=opencode-go/deepseek-v4-pro bash setup_opencode_router_live.sh"
  fi
done

say "Creating directories"
mkdir -p .opencode/commands docs

say "Backing up existing generated files if present"
backup_file opencode.json
backup_file .opencode/commands/model-router.md
backup_file .opencode/commands/route-build.md
backup_file .opencode/commands/route-review.md
backup_file .opencode/commands/router-benchmark.md
backup_file docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md

say "Writing opencode.json"
cat > opencode.json <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "$DEFAULT_MODEL",
  "small_model": "$SMALL_MODEL",
  "permission": {
    "edit": "ask",
    "bash": "ask",
    "webfetch": "ask"
  }
}
EOF

say "Writing .opencode/commands/model-router.md"
cat > .opencode/commands/model-router.md <<EOF
---
description: Route a task through model-router v3.3 before implementation
agent: plan
model: $ROUTER_MODEL
---

Use the model-router v3.3 policy from:

$ROUTER_DIR/prompts/model-router.md

You are routing this task only.

Hard constraints:
- Do not edit files.
- Do not run shell commands.
- Do not implement the task.
- Do not claim to have inspected files unless the user provided them or explicitly asked for repo inspection.
- Return the complete required model-router v3.3 output skeleton.
- If implementation is recommended, include the exact live OpenCode model choice when possible.
- Avoid Copilot as a primary autonomous repo-work route.
- Require approval for destructive, auth, secrets, CI/CD, database, production, or broad multi-file changes.

Task to route:

\$ARGUMENTS
EOF

say "Writing .opencode/commands/route-build.md"
cat > .opencode/commands/route-build.md <<EOF
---
description: Implement only after accepting a model-router route
agent: build
model: $BUILD_MODEL
---

Follow the approved model-router v3.3 route.

Implementation constraints:
- Plan first.
- Edit only files required by the approved route.
- Ask before edits if scope is unclear.
- Ask before destructive commands.
- Ask before dependency changes.
- Ask before lockfile changes.
- Ask before CI/CD, auth, secrets, database, permissions, deployment, or production-facing changes.
- Do not use Copilot as the primary autonomous executor.
- Preserve existing behavior unless the approved task requires a change.
- Show changed files and a concise diff summary before finalizing.

Task:

\$ARGUMENTS
EOF

say "Writing .opencode/commands/route-review.md"
cat > .opencode/commands/route-review.md <<EOF
---
description: Review completed changes after routed implementation
agent: plan
model: $REVIEW_MODEL
---

Review only. Do not edit files.

Use the model-router v3.3 safety expectations from:

$ROUTER_DIR/prompts/model-router.md

Check:
1. Correctness
2. Regression risk
3. Security risk
4. Missing tests
5. Scope creep
6. Mismatch against the approved router route
7. Whether the selected model/workflow was appropriate
8. Whether approval gates were respected

Required output:
- Verdict: pass / pass with concerns / fail
- Issues found
- Required fixes
- Suggested tests
- Final recommendation

Task or diff to review:

\$ARGUMENTS
EOF

say "Writing .opencode/commands/router-benchmark.md"
cat > .opencode/commands/router-benchmark.md <<EOF
---
description: Produce one benchmarkable model-router v3.3 response
agent: plan
model: $ROUTER_MODEL
---

Use the model-router v3.3 policy from:

$ROUTER_DIR/prompts/model-router.md

Produce one benchmarkable router response for this benchmark case.

Hard constraints:
- Do not implement the task.
- Do not edit files.
- Return the complete model-router v3.3 output skeleton.
- Preserve all required sections.
- Make the route safe for live OpenCode providers available in this environment.

Benchmark case or task:

\$ARGUMENTS
EOF

say "Writing docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md"
cat > docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md <<EOF
# OpenCode Live-Provider Workflow for model-router v3.3

## Current environment

Generated from the local OpenCode diagnostic log.

- Target repo: \`$TARGET_REPO\`
- Router package: \`$ROUTER_DIR\`
- Default implementation model: \`$DEFAULT_MODEL\`
- Small/cheap model: \`$SMALL_MODEL\`
- Router/planning model: \`$ROUTER_MODEL\`
- Build model: \`$BUILD_MODEL\`
- Review model: \`$REVIEW_MODEL\`

## Available-provider interpretation

This setup assumes the currently connected live providers are:

- DeepSeek API
- OpenCode Go API
- GitHub Copilot OAuth

Direct OpenAI, Anthropic, Google, and OpenRouter were not treated as configured unless \`opencode models\` lists them.

Because Copilot is treated by the router as inline-helper-only for autonomous repo work, this workflow uses DeepSeek/OpenCode-Go models for router/build/review commands by default.

## Created files

\`\`\`text
opencode.json
.opencode/commands/model-router.md
.opencode/commands/route-build.md
.opencode/commands/route-review.md
.opencode/commands/router-benchmark.md
docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md
\`\`\`

## Safety config

\`opencode.json\` requires approval for:

- file edits
- shell commands
- web fetches

This keeps OpenCode aligned with model-router v3.3 approval gates.

## Daily workflow

Start from the repo root:

\`\`\`bash
git status --short --branch
opencode
\`\`\`

Inside OpenCode:

\`\`\`text
/model-router Fix the failing test in the provider registry
\`\`\`

Read the router output. If the route is acceptable:

\`\`\`text
/route-build Use the approved route to fix the failing provider-registry test. Plan first and ask before edits.
\`\`\`

After implementation:

\`\`\`text
/route-review Review the completed diff for correctness, regression risk, and scope creep.
\`\`\`

## Model selection notes

Use \`/models\` inside OpenCode when you want to manually switch models.

Recommended live mappings for this environment:

| Router purpose | Live OpenCode model |
|---|---|
| Normal implementation | \`$BUILD_MODEL\` |
| Cheap/small fallback | \`$SMALL_MODEL\` |
| Hard routing / planning | \`$ROUTER_MODEL\` |
| Final review | \`$REVIEW_MODEL\` |
| Copilot inline helper | GitHub Copilot models only for inline/help tasks |

## Benchmark workflow

The active benchmark file is:

\`\`\`text
$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl
\`\`\`

The active grader is:

\`\`\`text
$ROUTER_DIR/grader/model_router_grader.py
\`\`\`

The v3.3 response template is:

\`\`\`text
$ROUTER_DIR/templates/model-router-real-responses-template-v3.3.jsonl
\`\`\`

To validate the benchmark file:

\`\`\`bash
python3 "$ROUTER_DIR/grader/model_router_grader.py" \\
  --benchmark "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl" \\
  --validate-benchmark
\`\`\`

To grade collected v3.3 responses:

\`\`\`bash
python3 "$ROUTER_DIR/grader/model_router_grader.py" \\
  --benchmark "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl" \\
  --grade model-router-real-responses-v3.3.jsonl \\
  --report "$ROUTER_DIR/reports/model-router-real-grade-report-v3.3.md" \\
  --json "$ROUTER_DIR/reports/model-router-real-grade-report-v3.3.json"
\`\`\`

## Git workflow

Before using OpenCode:

\`\`\`bash
git status --short --branch
\`\`\`

After changes:

\`\`\`bash
git diff --stat
git diff
\`\`\`

Commit only after review:

\`\`\`bash
git add opencode.json .opencode/commands docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md
git commit -m "Add OpenCode model-router workflow"
\`\`\`

## Important caution

Your diagnostic log showed existing modified source files before this setup. Review the current diff before committing these config/workflow files.
EOF

say "Validating generated files"
test -f opencode.json
test -f .opencode/commands/model-router.md
test -f .opencode/commands/route-build.md
test -f .opencode/commands/route-review.md
test -f .opencode/commands/router-benchmark.md
test -f docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md

say "Generated file summary"
find .opencode/commands -maxdepth 1 -type f -print | sort
echo "opencode.json"
echo "docs/OPENCODE_MODEL_ROUTER_WORKFLOW.md"

say "Git status after setup"
git status --short --branch

cat <<EOF

DONE.

Next:
1. Start OpenCode:
   opencode

2. In OpenCode, test the router command:
   /model-router Add a safe README note explaining this repo's OpenCode workflow

3. Then test build route:
   /route-build Use the approved route. Plan first and ask before edits.

4. Then test review:
   /route-review Review the current diff.

EOF
