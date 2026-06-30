#!/usr/bin/env bash
set -u
set +x
umask 077

LOG="${1:-$HOME/model-router-opencode-diagnostic-$(date +%Y%m%d-%H%M%S).log}"
ROUTER_DIR="${ROUTER_DIR:-$HOME/agent-workbench/tools/model-router-v3.3-repo-ready}"
TARGET_REPO="${TARGET_REPO:-$(pwd)}"

redact() {
  sed -E \
    -e 's/(sk-[A-Za-z0-9_-]{12,})/[REDACTED_OPENAI_STYLE_KEY]/g' \
    -e 's/(sk-ant-[A-Za-z0-9_-]{12,})/[REDACTED_ANTHROPIC_STYLE_KEY]/g' \
    -e 's/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/[REDACTED_EMAIL]/g' \
    -e 's#(https?://)([^/@[:space:]]+):([^/@[:space:]]+)@#\1[REDACTED_USER]:[REDACTED_TOKEN]@#g' \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._~+\/=-]+/\1[REDACTED_BEARER]/Ig' \
    -e 's/((api[_-]?key|apikey|token|secret|password|passwd|authorization|auth_token|access_token|refresh_token)[[:space:]]*[:=][[:space:]]*)[^[:space:]}",]+/\1[REDACTED]/Ig'
}

section() {
  {
    echo
    echo "============================================================"
    echo "$1"
    echo "============================================================"
  } | tee -a "$LOG" >/dev/null
}

run_cmd() {
  local label="$1"
  local cmd="$2"

  section "$label"
  {
    echo "\$ $cmd"
    timeout 90 bash -lc "$cmd" 2>&1
    echo "exit_code=$?"
  } | redact | tee -a "$LOG" >/dev/null
}

safe_cat() {
  local label="$1"
  local file="$2"

  section "$label"
  if [ -f "$file" ]; then
    {
      echo "FILE: $file"
      sed -n '1,240p' "$file"
    } | redact | tee -a "$LOG" >/dev/null
  else
    echo "MISSING: $file" | tee -a "$LOG" >/dev/null
  fi
}

: > "$LOG"

section "LOG INFO"
{
  echo "log_file=$LOG"
  echo "generated_at=$(date -Is)"
  echo "script=$0"
  echo "router_dir=$ROUTER_DIR"
  echo "target_repo=$TARGET_REPO"
  echo "pwd=$(pwd)"
} | redact | tee -a "$LOG" >/dev/null

section "SYSTEM INFO"
{
  echo "user=$(whoami)"
  echo "home=$HOME"
  echo "shell=${SHELL:-unknown}"
  echo "path=$PATH"
  echo
  uname -a || true
  echo
  if [ -f /etc/os-release ]; then cat /etc/os-release; fi
  echo
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "wsl_detected=yes"
  else
    echo "wsl_detected=no_or_unknown"
  fi
} | redact | tee -a "$LOG" >/dev/null

section "DIRECTORY CHECKS"
{
  echo "TARGET_REPO exists?"
  [ -d "$TARGET_REPO" ] && echo "yes" || echo "no"

  echo
  echo "ROUTER_DIR exists?"
  [ -d "$ROUTER_DIR" ] && echo "yes" || echo "no"

  echo
  echo "ROUTER_DIR tree depth 2:"
  if [ -d "$ROUTER_DIR" ]; then
    find "$ROUTER_DIR" -maxdepth 2 -type f | sort
  fi
} | redact | tee -a "$LOG" >/dev/null

run_cmd "OPENCode BINARY" "command -v opencode || true"
run_cmd "OPENCode VERSION" "opencode --version || true"
run_cmd "OPENCode HELP" "opencode --help | sed -n '1,220p' || true"

run_cmd "OPENCode AUTH HELP" "opencode auth --help | sed -n '1,220p' || true"
run_cmd "OPENCode AUTH LIST" "opencode auth list || true"

run_cmd "OPENCode MODELS HELP" "opencode models --help | sed -n '1,220p' || true"
run_cmd "OPENCode MODELS REFRESH" "opencode models --refresh || true"
run_cmd "OPENCode MODELS ALL" "opencode models || true"
run_cmd "OPENCode MODELS OPENAI" "opencode models openai || true"
run_cmd "OPENCode MODELS ANTHROPIC" "opencode models anthropic || true"
run_cmd "OPENCode MODELS DEEPSEEK" "opencode models deepseek || true"
run_cmd "OPENCode MODELS GOOGLE" "opencode models google || true"
run_cmd "OPENCode MODELS OPENROUTER" "opencode models openrouter || true"
run_cmd "OPENCode MODELS GITHUB" "opencode models github || true"
run_cmd "OPENCode MODELS OLLAMA" "opencode models ollama || true"

section "OPENCode CONFIG LOCATIONS"
{
  echo "OPENCODE_CONFIG_DIR=${OPENCODE_CONFIG_DIR:-unset}"
  echo
  echo "Candidate config paths:"
  for p in \
    "$TARGET_REPO/opencode.json" \
    "$TARGET_REPO/opencode.jsonc" \
    "$TARGET_REPO/.opencode" \
    "$HOME/.config/opencode" \
    "$HOME/.opencode" \
    "${OPENCODE_CONFIG_DIR:-/nonexistent-opencode-config-dir}"
  do
    if [ -e "$p" ]; then
      echo "EXISTS: $p"
      if [ -d "$p" ]; then
        find "$p" -maxdepth 3 -type f | sort
      fi
    else
      echo "MISSING: $p"
    fi
    echo
  done
} | redact | tee -a "$LOG" >/dev/null

safe_cat "TARGET opencode.json" "$TARGET_REPO/opencode.json"
safe_cat "TARGET opencode.jsonc" "$TARGET_REPO/opencode.jsonc"

section "TARGET .opencode FILES"
if [ -d "$TARGET_REPO/.opencode" ]; then
  find "$TARGET_REPO/.opencode" -maxdepth 4 -type f | sort | while read -r f; do
    safe_cat ".opencode file: $f" "$f"
  done
else
  echo "No .opencode directory found in target repo." | tee -a "$LOG" >/dev/null
fi

section "ROUTER PACKAGE FILE VALIDATION"
{
  for f in \
    "$ROUTER_DIR/prompts/model-router.md" \
    "$ROUTER_DIR/prompts/model-router-fixed-v3.3.md" \
    "$ROUTER_DIR/grader/model_router_grader.py" \
    "$ROUTER_DIR/grader/model_router_grader_v3_3.py" \
    "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl" \
    "$ROUTER_DIR/templates/model-router-real-responses-template-v3.3.jsonl" \
    "$ROUTER_DIR/QUICKSTART.md" \
    "$ROUTER_DIR/README.md" \
    "$ROUTER_DIR/TREE.txt"
  do
    if [ -f "$f" ]; then
      echo "FOUND: $f"
      wc -l "$f" || true
      sha256sum "$f" || true
    else
      echo "MISSING: $f"
    fi
    echo
  done
} | redact | tee -a "$LOG" >/dev/null

safe_cat "ROUTER QUICKSTART" "$ROUTER_DIR/QUICKSTART.md"
safe_cat "ROUTER README" "$ROUTER_DIR/README.md"
safe_cat "ROUTER TREE" "$ROUTER_DIR/TREE.txt"

section "ROUTER PROMPT HEADER"
if [ -f "$ROUTER_DIR/prompts/model-router.md" ]; then
  sed -n '1,180p' "$ROUTER_DIR/prompts/model-router.md" | redact | tee -a "$LOG" >/dev/null
else
  echo "Missing router prompt." | tee -a "$LOG" >/dev/null
fi

section "GRADER CHECK"
{
  python3 --version || true
  python --version || true
  echo
  if [ -f "$ROUTER_DIR/grader/model_router_grader.py" ]; then
    python3 "$ROUTER_DIR/grader/model_router_grader.py" --help || \
    python "$ROUTER_DIR/grader/model_router_grader.py" --help || true
  else
    echo "grader missing"
  fi
} 2>&1 | redact | tee -a "$LOG" >/dev/null

section "BENCHMARK COUNTS"
{
  if [ -f "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl" ]; then
    echo "benchmark_lines=$(wc -l < "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl")"
    echo "first_3_cases:"
    sed -n '1,3p' "$ROUTER_DIR/benchmarks/model-router-bench-tests-v3.2.jsonl"
  else
    echo "benchmark file missing"
  fi
} | redact | tee -a "$LOG" >/dev/null

section "TARGET GIT STATUS"
{
  if git -C "$TARGET_REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$TARGET_REPO" status --short --branch
    echo
    git -C "$TARGET_REPO" branch --show-current
    echo
    git -C "$TARGET_REPO" log --oneline -8
    echo
    git -C "$TARGET_REPO" remote -v
  else
    echo "Not a git repository: $TARGET_REPO"
  fi
} | redact | tee -a "$LOG" >/dev/null

section "NODE / PACKAGE MANAGERS"
{
  node --version || true
  npm --version || true
  pnpm --version || true
  yarn --version || true
  bun --version || true
} 2>&1 | redact | tee -a "$LOG" >/dev/null

section "PYTHON / GO / RUST TOOLING"
{
  python3 --version || true
  pip3 --version || true
  go version || true
  rustc --version || true
  cargo --version || true
} 2>&1 | redact | tee -a "$LOG" >/dev/null

section "SAFE SUMMARY"
{
  echo "Created diagnostic log:"
  echo "$LOG"
  echo
  echo "Before sending it, review it with:"
  echo "less \"$LOG\""
  echo
  echo "Check for anything private with:"
  echo "grep -Ei 'key|token|secret|password|authorization|bearer|@' \"$LOG\" || true"
} | tee -a "$LOG" >/dev/null

echo
echo "DONE"
echo "Diagnostic log created at:"
echo "$LOG"
echo
echo "Review before sending:"
echo "less \"$LOG\""
echo
echo "Secret scan helper:"
echo "grep -Ei 'key|token|secret|password|authorization|bearer|@' \"$LOG\" || true"
