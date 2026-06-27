#!/usr/bin/env bash
# test-health.sh — Static health checks for the test harness.
#
# Usage:
#   bash scripts/test-health.sh
#
# Checks:
#   1. No test imports the runtime server entrypoint (only /public).
#   2. No test contains real provider/network call patterns.
#   3. No fixture files contain likely real secrets.
#   4. TUI boundary test exists.
#   5. No test imports restricted runtime packages from apps/tui/src.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; ERRORS=$((ERRORS + 1)); }

echo "=== test-health: static harness checks ==="

# ── 1. No test imports runtime server entrypoint ──────────────────────────
echo ""
echo "[1] Server import boundary"
SERVER_IMPORT_VIOLATIONS=$(grep -rn 'from\s*"@agent-workbench/server"' "${PROJECT_ROOT}/tests/" || true)
SERVER_IMPORT_VIOLATIONS2=$(grep -rn "from '@agent-workbench/server'" "${PROJECT_ROOT}/tests/" || true)
if [ -z "${SERVER_IMPORT_VIOLATIONS}" ] && [ -z "${SERVER_IMPORT_VIOLATIONS2}" ]; then
  pass "No test imports @agent-workbench/server entrypoint"
else
  fail "Test imports @agent-workbench/server entrypoint:"
  echo "${SERVER_IMPORT_VIOLATIONS}"
  echo "${SERVER_IMPORT_VIOLATIONS2}"
fi

# ── 2. No provider/network calls in tests ──────────────────────────────────
echo ""
echo "[2] No provider/network calls in tests"
NETWORK_PATTERNS=(
  "OPENAI_API_KEY"
  "ANTHROPIC_API_KEY"
  'fetch("https://'
  "fetch('https://"
  "Bun\.connect"
  "net\.connect"
)
FOUND_NETWORK=0
for pattern in "${NETWORK_PATTERNS[@]}"; do
  matches=$(grep -rn "${pattern}" "${PROJECT_ROOT}/tests/" 2>/dev/null || true)
  if [ -n "${matches}" ]; then
    fail "Pattern '${pattern}' found in tests:"
    echo "${matches}"
    FOUND_NETWORK=1
  fi
done
if [ "${FOUND_NETWORK}" -eq 0 ]; then
  pass "No provider/network call patterns in tests"
fi

# ── 3. No realistic secrets in fixtures ────────────────────────────────────
echo ""
echo "[3] No secrets in fixture files"
SECRET_PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'
  'ghp_[a-zA-Z0-9]{20,}'
  'AKIA[A-Z0-9]{16}'
  'eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}'
)
FOUND_SECRETS=0
for pattern in "${SECRET_PATTERNS[@]}"; do
  matches=$(grep -rnP "${pattern}" "${PROJECT_ROOT}/tests/fixtures/" 2>/dev/null || true)
  if [ -n "${matches}" ]; then
    fail "Likely secret pattern found in fixtures:"
    echo "${matches}"
    FOUND_SECRETS=1
  fi
done
if [ "${FOUND_SECRETS}" -eq 0 ]; then
  pass "No likely secrets in fixture files"
fi

# ── 4. TUI boundary test exists ────────────────────────────────────────────
echo ""
echo "[4] TUI boundary test exists"
if [ -f "${PROJECT_ROOT}/tests/e2e/boundary-tui-imports.test.ts" ]; then
  pass "TUI boundary test exists"
else
  fail "TUI boundary test is missing (tests/e2e/boundary-tui-imports.test.ts)"
fi

# ── 5. No test in apps/tui/src imports restricted packages ──────────────────
echo ""
echo "[5] TUI source does not import restricted packages"
RESTRICTED_PKGS=(
  "@agent-workbench/core"
  "@agent-workbench/tools"
  "@agent-workbench/shell"
  "@agent-workbench/storage"
  "@agent-workbench/permissions"
)
FOUND_TUI_VIOLATION=0
for pkg in "${RESTRICTED_PKGS[@]}"; do
  # Escape dots for regex
  escaped_pkg=$(echo "${pkg}" | sed 's/\./\\./g')
  matches=$(grep -rn "from\s*[\"']${escaped_pkg}" "${PROJECT_ROOT}/apps/tui/src/" 2>/dev/null || true)
  if [ -n "${matches}" ]; then
    fail "TUI source imports restricted package '${pkg}':"
    echo "${matches}"
    FOUND_TUI_VIOLATION=1
  fi
done
if [ "${FOUND_TUI_VIOLATION}" -eq 0 ]; then
  pass "TUI does not import restricted runtime packages"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
if [ "${ERRORS}" -eq 0 ]; then
  echo -e "${GREEN}=== test-health: ALL CHECKS PASSED ===${NC}"
  exit 0
else
  echo -e "${RED}=== test-health: ${ERRORS} check(s) FAILED ===${NC}"
  exit 1
fi
