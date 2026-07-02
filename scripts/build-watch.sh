#!/usr/bin/env bash
# build-watch.sh — Watch packages for changes and auto-rebuild.
#
# Monitors packages/* for changes using bun's built-in --watch,
# then triggers a full workspace rebuild. Designed for development
# workflows where tests import from dist/ instead of src/.
#
# Usage:
#   bash scripts/build-watch.sh          # Watch all packages
#   bash scripts/build-watch.sh core     # Watch a specific package
#
# Phase 31 (post-roadmap): integrate into `bun run dev` via
# concurrent watchers for server + build.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET="${1:-all}"

if [ "$TARGET" = "all" ]; then
  echo "🔍 Watching all packages for changes..."
  echo "   Auto-rebuild triggered on any src/ change."
  echo ""

  # Use bun's --watch on each package. We run builds in sequence to
  # avoid concurrent tsc/linker contention.
  cd "$REPO_ROOT"

  # Start a single watcher using entr (if available) or fall back to
  # a simple inotify loop.
  if command -v entr &>/dev/null; then
    find packages/*/src -name '*.ts' 2>/dev/null | entr -r bash -c "
      echo '=== [$(date +%H:%M:%S)] Change detected — rebuilding ==='
      bash $SCRIPT_DIR/build-all.sh
      echo '=== [$(date +%H:%M:%S)] Rebuild complete ==='
    "
  elif command -v inotifywait &>/dev/null; then
    while inotifywait -q -r -e modify,create,delete,move packages/*/src/ 2>/dev/null; do
      echo "=== [$(date +%H:%M:%S)] Change detected — rebuilding ==="
      bash "$SCRIPT_DIR/build-all.sh"
      echo "=== [$(date +%H:%M:%S)] Rebuild complete ==="
    done
  else
    echo "⚠️  No file watcher found. Install 'entr' or 'inotify-tools'."
    echo "   Falling back to polling (every 5s)..."
    while true; do
      find packages/*/src -name '*.ts' -newer "$REPO_ROOT/.build-timestamp" 2>/dev/null | head -1 | grep -q . && {
        echo "=== [$(date +%H:%M:%S)] Change detected — rebuilding ==="
        bash "$SCRIPT_DIR/build-all.sh"
        touch "$REPO_ROOT/.build-timestamp"
        echo "=== [$(date +%H:%M:%S)] Rebuild complete ==="
      }
      sleep 5
    done
  fi
else
  echo "🔍 Watching packages/$TARGET/src/ for changes..."
  if command -v entr &>/dev/null; then
    find "packages/$TARGET/src" -name '*.ts' 2>/dev/null | entr -r bash -c "
      echo '=== [$(date +%H:%M:%S)] $TARGET changed — rebuilding ==='
      (cd $REPO_ROOT && bun run build --filter=@agent-workbench/$TARGET)
      echo '=== [$(date +%H:%M:%S)] Rebuild complete ==='
    "
  else
    echo "⚠️  Install 'entr' for efficient watching. Polling every 5s..."
    while true; do
      find "packages/$TARGET/src" -name '*.ts' -newer "$REPO_ROOT/.build-timestamp" 2>/dev/null | head -1 | grep -q . && {
        echo "=== [$(date +%H:%M:%S)] $TARGET changed — rebuilding ==="
        (cd "$REPO_ROOT" && bun run build --filter="@agent-workbench/$TARGET")
        touch "$REPO_ROOT/.build-timestamp"
        echo "=== [$(date +%H:%M:%S)] Rebuild complete ==="
      }
      sleep 5
    done
  fi
fi
