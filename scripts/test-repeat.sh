#!/usr/bin/env bash
# test-repeat.sh — Run the test suite N times, fail on first failure.
#
# Usage:
#   bash scripts/test-repeat.sh
#   TEST_REPEAT_COUNT=5 bash scripts/test-repeat.sh
#
# Exits 0 when all runs pass. Exits 1 on first failure.

set -euo pipefail

REPEAT_COUNT="${TEST_REPEAT_COUNT:-3}"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== test-repeat: running test suite ${REPEAT_COUNT} time(s) ==="

PASSES=0
FAILURES=0

for i in $(seq 1 "${REPEAT_COUNT}"); do
  echo ""
  echo "--- Run ${i}/${REPEAT_COUNT} ---"
  if (cd "${PROJECT_ROOT}/tests" && bun test); then
    PASSES=$((PASSES + 1))
    echo "--- Run ${i}: PASS ---"
  else
    FAILURES=$((FAILURES + 1))
    echo "--- Run ${i}: FAIL ---"
    echo ""
    echo "=== test-repeat: FAILED on run ${i} ==="
    echo "Passes: ${PASSES}, Failures: ${FAILURES}"
    exit 1
  fi
done

echo ""
echo "=== test-repeat: all ${REPEAT_COUNT} runs PASSED ==="
