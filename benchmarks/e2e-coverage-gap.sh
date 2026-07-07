#!/usr/bin/env bash
# e2e-coverage-gap.sh
# Benchmark: Coverage gap analysis for Playwright E2E test suite vs skill spec
# Compares files described in the playwright-e2e-testing skill (v2.1.0) against
# what actually exists on disk under apps/mobile-web/e2e/.
#
# Usage: bash benchmarks/e2e-coverage-gap.sh
# Output: benchmarks/e2e-coverage-gap.json (also printed to stdout)

set -euo pipefail

BASE_DIR="/home/calvin/agent-workbench/apps/mobile-web/e2e"
OUTPUT="/home/calvin/agent-workbench/benchmarks/e2e-coverage-gap.json"

# ── Spec files (14) ──────────────────────────────────────────────────────
SPECS=(
  app-shell
  navigation
  chat
  settings
  workspace
  visual
  network
  auth
  accessibility
  performance
  cross-app
  error-boundary
  security-headers
  xss-injection
)

# ── Page object files (7) ────────────────────────────────────────────────
PAGES=(
  base-page
  chat-page
  settings-page
  auth-page
  workspace-page
  files-page
  activity-page
)

# ── Utility files (7) ────────────────────────────────────────────────────
UTILS=(
  screenshot-diff
  axe-runner
  mock-server
  network-conditions
  performance
  test-data
  helpers
)

# ── Helper: count test() blocks ──────────────────────────────────────────
count_tests() {
  local file="$1"
  if [[ -f "$file" ]]; then
    grep -cE '\btest\s*\(' "$file" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

# ── Helper: count lines ──────────────────────────────────────────────────
count_lines() {
  local file="$1"
  if [[ -f "$file" ]]; then
    wc -l < "$file"
  else
    echo 0
  fi
}

# ── Build JSON ───────────────────────────────────────────────────────────
now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
total_items=28
implemented=0

# Start JSON
cat > "$OUTPUT" <<JSON_HEADER
{
  "generated": "$now",
  "skill": "playwright-e2e-testing",
  "skill_version": "2.1.0",
  "base_path": "$BASE_DIR",
JSON_HEADER

# ── Specs array ──────────────────────────────────────────────────────────
echo '  "specs": [' >> "$OUTPUT"
spec_impl=0
spec_total=${#SPECS[@]}
first=true
for name in "${SPECS[@]}"; do
  filepath="$BASE_DIR/specs/$name.spec.ts"
  tests=$(count_tests "$filepath")
  lines=$(count_lines "$filepath")
  if [[ -f "$filepath" ]]; then
    status="implemented"
    spec_impl=$((spec_impl + 1))
    implemented=$((implemented + 1))
  else
    status="not-implemented"
  fi
  $first || printf ',\n' >> "$OUTPUT"
  first=false
  printf '    {"file": "specs/%s.spec.ts", "status": "%s", "test_count": %d, "lines": %d}' \
    "$name" "$status" "$tests" "$lines" >> "$OUTPUT"
done
printf '\n  ],\n' >> "$OUTPUT"

# ── Pages array ──────────────────────────────────────────────────────────
echo '  "pages": [' >> "$OUTPUT"
page_impl=0
page_total=${#PAGES[@]}
first=true
for name in "${PAGES[@]}"; do
  filepath="$BASE_DIR/pages/$name.ts"
  lines=$(count_lines "$filepath")
  if [[ -f "$filepath" ]]; then
    status="implemented"
    page_impl=$((page_impl + 1))
    implemented=$((implemented + 1))
  else
    status="not-implemented"
  fi
  $first || printf ',\n' >> "$OUTPUT"
  first=false
  printf '    {"file": "pages/%s.ts", "status": "%s", "lines": %d}' \
    "$name" "$status" "$lines" >> "$OUTPUT"
done
printf '\n  ],\n' >> "$OUTPUT"

# ── Utils array ──────────────────────────────────────────────────────────
echo '  "utils": [' >> "$OUTPUT"
util_impl=0
util_total=${#UTILS[@]}
first=true
for name in "${UTILS[@]}"; do
  filepath="$BASE_DIR/utils/$name.ts"
  lines=$(count_lines "$filepath")
  if [[ -f "$filepath" ]]; then
    status="implemented"
    util_impl=$((util_impl + 1))
    implemented=$((implemented + 1))
  else
    status="not-implemented"
  fi
  $first || printf ',\n' >> "$OUTPUT"
  first=false
  printf '    {"file": "utils/%s.ts", "status": "%s", "lines": %d}' \
    "$name" "$status" "$lines" >> "$OUTPUT"
done
printf '\n  ],\n' >> "$OUTPUT"

# ── Existing root-level smoke test ───────────────────────────────────────
root_spec="$BASE_DIR/app.spec.ts"
root_tests=$(count_tests "$root_spec")
root_lines=$(count_lines "$root_spec")

# ── Completion ───────────────────────────────────────────────────────────
completion_pct=$(awk "BEGIN { printf \"%.1f\", ($implemented / $total_items) * 100 }")

# Check which dirs exist
missing_dirs=""
existing_dirs=""
for d in specs pages utils; do
  if [[ -d "$BASE_DIR/$d" ]]; then
    existing_dirs="${existing_dirs:+$existing_dirs, }\"$d/\""
  else
    missing_dirs="${missing_dirs:+$missing_dirs, }\"$d/\""
  fi
done

cat >> "$OUTPUT" <<JSON_FOOTER
  "overall": {
    "total_items": $total_items,
    "implemented": $implemented,
    "not_implemented": $((total_items - implemented)),
    "completion_percent": $completion_pct
  },
  "existing_playwright_test": {
    "file": "app.spec.ts",
    "test_count": $root_tests,
    "lines": $root_lines,
    "note": "Pre-existing basic smoke test at e2e root — not part of the skill's 14 spec files"
  },
  "summary": {
    "specs_total": $spec_total,
    "specs_implemented": $spec_impl,
    "pages_total": $page_total,
    "pages_implemented": $page_impl,
    "utils_total": $util_total,
    "utils_implemented": $util_impl,
    "directories_missing": [$missing_dirs],
    "directories_existing": [$existing_dirs],
    "skill_status_note": "The skill (v2.1.0) explicitly states these are aspirational templates — only app.spec.ts and playwright.config.ts exist on disk. All 28 files described in the skill architecture are not yet implemented."
  }
}
JSON_FOOTER

# ── Print to stdout ──────────────────────────────────────────────────────
cat "$OUTPUT"
